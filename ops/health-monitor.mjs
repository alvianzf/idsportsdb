#!/usr/bin/env node
/**
 * Uptime monitor for the KONI Batam API. Run from cron on the VPS.
 *
 * Checks `/health/ready` — the readiness probe that actually queries the
 * database — rather than `/health`, which stays 200 during a DB outage by
 * design. This exists because the 2026-07-19 database outage ran for ten days
 * unnoticed: every route was 500ing while `/health` reported OK.
 *
 * Alerts on TRANSITIONS only (healthy -> down, down -> healthy), after
 * `FAILURE_THRESHOLD` consecutive failures, so a single blip or a deploy restart
 * does not page anyone and an ongoing outage does not mail every two minutes.
 *
 * Usage:  node ops/health-monitor.mjs
 * Env:    ALERT_EMAIL (comma-separated recipients; required to send mail)
 *         HEALTH_URL  (default https://api.simo-konibatam.com/health/ready)
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

const API_ENV = path.join(process.env.HOME ?? os.homedir(), "inasportdb", "apps", "api", ".env");
if (fs.existsSync(API_ENV)) dotenv.config({ path: API_ENV });

const HEALTH_URL = process.env.HEALTH_URL ?? "https://api.simo-konibatam.com/health/ready";
const ALERT_EMAIL = process.env.ALERT_EMAIL ?? "";
const STATE_FILE = path.join(process.env.HOME ?? os.homedir(), ".koni-health-state.json");
const FAILURE_THRESHOLD = 2;
const TIMEOUT_MS = 15_000;
// Backup DB sync backlog: pendingFailures is rows in ops._sync_failures that
// the retry cron (every 5min) hasn't been able to push to the remote yet.
// A handful is normal transient lag; a pile-up means the remote is down or
// the retry cron itself broke.
const PENDING_FAILURES_THRESHOLD = 10;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { down: false, consecutiveFailures: 0 };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

function log(message) {
  process.stdout.write(`${new Date().toISOString()} ${message}\n`);
}

/** Turns the /health/ready payload into a one-line human summary. */
function summarise(payload) {
  if (!payload || typeof payload !== "object") return "";
  const db = payload.checks?.database;
  const storage = payload.checks?.storage;
  const parts = [];
  if (db) parts.push(`db ${db.status}${db.code ? ` (${db.code})` : ""} ${db.latencyMs}ms`);
  if (storage) {
    parts.push(
      storage.writable === false
        ? "storage NOT WRITABLE"
        : `disk ${storage.freePercent}% free (${storage.freeMb}MB)`,
    );
  }
  if (payload.uptimeSeconds != null) parts.push(`up ${Math.round(payload.uptimeSeconds / 60)}m`);
  if (payload.version) parts.push(`v${payload.version}`);
  const redundancy = payload.checks?.redundancy;
  if (redundancy) {
    parts.push(
      `backup ${redundancy.status}${redundancy.code ? ` (${redundancy.code})` : ""}` +
        (redundancy.pendingFailures != null ? `, ${redundancy.pendingFailures} pending` : ""),
    );
  }
  return parts.join(", ");
}

/**
 * Resolves to `{ failure, detail, payload }` — `failure` is a short reason
 * when unhealthy or null when healthy, `detail` is the parsed summary either
 * way so a warning (disk filling up) is visible even while the check still
 * passes, `payload` is the parsed body (or null) for callers that need a
 * specific field (e.g. redundancy backlog).
 */
async function probe() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    const body = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(body);
    } catch {
      /* not JSON — fall back to the raw body below */
    }
    const detail = summarise(payload);
    if (res.status !== 200) {
      return {
        failure: `HTTP ${res.status}${detail ? ` — ${detail}` : ` — ${body.slice(0, 200)}`}`,
        detail,
        payload,
      };
    }
    // 200 with database:"down" should never happen (the route 503s), but treat
    // the body as authoritative rather than trusting the status alone.
    if (payload?.database === "down") return { failure: `database down — ${detail}`, detail, payload };
    return { failure: null, detail, payload };
  } catch (err) {
    const reason = err.name === "AbortError" ? `timeout after ${TIMEOUT_MS}ms` : err.message;
    return { failure: `unreachable — ${reason}`, detail: "", payload: null };
  } finally {
    clearTimeout(timer);
  }
}

async function sendAlert(subject, text) {
  if (!ALERT_EMAIL || !process.env.SMTP_HOST) {
    log(`ALERT NOT SENT (ALERT_EMAIL or SMTP_HOST unset): ${subject}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"KONI Batam Monitor" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: ALERT_EMAIL,
    subject,
    text,
  });
  log(`alert sent to ${ALERT_EMAIL}: ${subject}`);
}

/**
 * Same transition-only alerting as the main API check, applied to the backup
 * DB sync backlog: alert once when pendingFailures crosses the threshold for
 * `FAILURE_THRESHOLD` consecutive checks, alert once when it drops back down.
 * Only evaluated when the main probe succeeded — no point double-alerting a
 * backlog reading pulled from an API that's already down.
 */
async function checkRedundancyBacklog(state, payload) {
  const pending = payload?.checks?.redundancy?.pendingFailures ?? null;
  const rStatus = payload?.checks?.redundancy?.status;
  const piling = pending != null && pending >= PENDING_FAILURES_THRESHOLD;

  if (piling || rStatus === "down") {
    state.redundancyFailures = (state.redundancyFailures ?? 0) + 1;
    if (!state.redundancyDown && state.redundancyFailures >= FAILURE_THRESHOLD) {
      state.redundancyDown = true;
      state.redundancySince = new Date().toISOString();
      await sendAlert(
        "[KONI] BACKUP DB TERTUNDA",
        `Sinkronisasi ke database cadangan bermasalah.\n\n` +
          `Status: ${rStatus}\nPending: ${pending}\nWaktu: ${state.redundancySince}\n\n` +
          `Langkah cek di VPS:\n` +
          `  sudo -u postgres psql -d rendang5018_sport_db -c "SELECT * FROM ops._sync_failures ORDER BY occurred_at DESC LIMIT 20;"\n` +
          `  sudo -u postgres psql -d rendang5018_sport_db -c "SELECT ops.check_remote_health();"\n` +
          `  sudo cat /var/lib/postgresql/retry_sync_failures.log | tail -20\n` +
          `  nc -z dbts.sidra.id 65433   # database cadangan dapat dihubungi?\n`,
      ).catch((e) => log(`redundancy alert failed: ${e.message}`));
    }
  } else {
    if (state.redundancyDown) {
      await sendAlert(
        "[KONI] BACKUP DB PULIH",
        `Sinkronisasi ke database cadangan kembali normal.\n` +
          `Mulai bermasalah: ${state.redundancySince ?? "tidak tercatat"}\nPulih: ${new Date().toISOString()}\n`,
      ).catch((e) => log(`redundancy recovery alert failed: ${e.message}`));
    }
    state.redundancyDown = false;
    state.redundancyFailures = 0;
    delete state.redundancySince;
  }
}

const state = readState();
const { failure, detail, payload } = await probe();

if (!failure) await checkRedundancyBacklog(state, payload);

if (failure) {
  state.consecutiveFailures += 1;
  log(`DOWN (${state.consecutiveFailures}/${FAILURE_THRESHOLD}) ${HEALTH_URL} — ${failure}`);
  if (!state.down && state.consecutiveFailures >= FAILURE_THRESHOLD) {
    state.down = true;
    state.since = new Date().toISOString();
    await sendAlert(
      "[KONI] API TIDAK SEHAT",
      `${HEALTH_URL} gagal ${state.consecutiveFailures}x berturut-turut.\n\n` +
        `Penyebab: ${failure}\nWaktu: ${state.since}\n\n` +
        `Langkah cek di VPS:\n` +
        `  pm2 status\n  pm2 logs koni-api --err --lines 50\n` +
        `  nc -z dbts.sidra.id 65433   # database dapat dihubungi?\n` +
        `  df -h                       # disk penuh?\n`,
    ).catch((e) => log(`alert failed: ${e.message}`));
  }
} else {
  log(`OK ${HEALTH_URL}${detail ? ` — ${detail}` : ""}`);
  if (state.down) {
    await sendAlert(
      "[KONI] API PULIH",
      `${HEALTH_URL} kembali normal.\nMulai bermasalah: ${state.since ?? "tidak tercatat"}\nPulih: ${new Date().toISOString()}\n`,
    ).catch((e) => log(`recovery alert failed: ${e.message}`));
  }
  state.down = false;
  state.consecutiveFailures = 0;
  delete state.since;
}

writeState(state);

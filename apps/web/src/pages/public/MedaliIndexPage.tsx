import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Medal as MedalIcon, Trophy, CalendarDays, X } from "lucide-react";
import { COMPETITION_LEVEL_CHOICES, competitionLevelLabel, type CompetitionLevel } from "@inasportdb/shared-types";
import { Card } from "../../components/ui";
import { api } from "../../lib/api";
import { PublicShell } from "./PublicShell";
import { RekapMedaliTable, type RekapMedaliRow } from "./RekapMedaliTable";

interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

/** One (Tingkat, Tahun) cell from `/public/medali-summary` — the raw matrix,
 * not pre-aggregated per dimension, so card totals can cross-filter by
 * whichever OTHER dimension is currently selected. */
type SummaryCell = MedalCounts & { tingkatKejuaraan: CompetitionLevel; tahun: number };

function sumCounts(cells: MedalCounts[]): MedalCounts {
  return cells.reduce(
    (acc, c) => ({ gold: acc.gold + c.gold, silver: acc.silver + c.silver, bronze: acc.bronze + c.bronze, total: acc.total + c.total }),
    { gold: 0, silver: 0, bronze: 0, total: 0 },
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-20px" },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

/** Mini Emas/Perak/Perunggu readout (colored dot + count) shared by both
 * filter-card grids — avoids ambiguous letter abbreviations. */
function MiniTally({ counts }: { counts: MedalCounts }) {
  return (
    <div className="mt-2 flex items-center gap-2.5 text-[11px] font-bold">
      <span className="flex items-center gap-1 text-gold">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {counts.gold}
      </span>
      <span className="flex items-center gap-1 text-silver">
        <span className="h-1.5 w-1.5 rounded-full bg-silver" /> {counts.silver}
      </span>
      <span className="flex items-center gap-1 text-bronze">
        <span className="h-1.5 w-1.5 rounded-full bg-bronze" /> {counts.bronze}
      </span>
    </div>
  );
}

/**
 * Public medal-tally hub — the centerpiece "Medali" menu. Full cabor table plus
 * Tingkat Kejuaraan / Tahun filter cards. See specs/024-rekap-medali-tally.
 */
export function MedaliIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const tingkat = searchParams.get("tingkat");
  const tahun = searchParams.get("tahun");

  const [summary, setSummary] = useState<SummaryCell[] | null>(null);
  const [rows, setRows] = useState<RekapMedaliRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<SummaryCell[]>("/public/medali-summary").then((res) => setSummary(res.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    setRows(null);
    setError(false);
    api
      .get<RekapMedaliRow[]>("/public/rekap-medali", { params: { tingkat: tingkat || undefined, tahun: tahun || undefined } })
      .then((res) => setRows([...res.data].sort((a, b) => b.total - a.total)))
      .catch(() => setError(true));
  }, [tingkat, tahun]);

  // Tingkat card totals cross-filter by the active Tahun (and vice versa), so
  // selecting both narrows each other's displayed counts — e.g. "Internasional"
  // shows only its 2025 tally once "2025" is also selected. Every tingkat/tahun
  // that has ever had a medal keeps its card even when the cross-filtered
  // count is 0 — cards never disappear, they just show 0.
  const tingkatCards = useMemo(() => {
    if (!summary) return [];
    const present = new Set(summary.map((c) => c.tingkatKejuaraan));
    return COMPETITION_LEVEL_CHOICES.filter((k) => present.has(k)).map((k) => ({
      tingkatKejuaraan: k,
      ...sumCounts(summary.filter((c) => c.tingkatKejuaraan === k && (!tahun || c.tahun === Number(tahun)))),
    }));
  }, [summary, tahun]);

  const tahunCards = useMemo(() => {
    if (!summary) return [];
    const years = Array.from(new Set(summary.map((c) => c.tahun))).sort((a, b) => b - a);
    return years.map((y) => ({
      tahun: y,
      ...sumCounts(summary.filter((c) => c.tahun === y && (!tingkat || c.tingkatKejuaraan === tingkat))),
    }));
  }, [summary, tingkat]);

  // Both filters can be active together (AND) — e.g. Internasional + 2025 —
  // so each toggle only ever touches its own param, leaving the other intact.
  function selectTingkat(key: CompetitionLevel) {
    const next = new URLSearchParams(searchParams);
    if (tingkat === key) next.delete("tingkat");
    else next.set("tingkat", key);
    setSearchParams(next);
  }
  function selectTahun(year: number) {
    const next = new URLSearchParams(searchParams);
    if (tahun === String(year)) next.delete("tahun");
    else next.set("tahun", String(year));
    setSearchParams(next);
  }

  const activeLabel = [tingkat ? competitionLevelLabel(tingkat as CompetitionLevel) : null, tahun ? `Tahun ${tahun}` : null]
    .filter((v): v is string => !!v)
    .join(" · ") || null;
  const grandTotal = summary ? sumCounts(summary).total : null;

  return (
    <PublicShell title="Perolehan Medali" description="Rekap medali seluruh cabang olahraga KONI Batam, per tingkat kejuaraan dan tahun.">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5c0000] via-[#990000] to-[#d92626] px-6 py-8 text-white shadow-lg"
      >
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-[#ffb199]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Trophy size={28} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Total Perolehan Medali</p>
            <p className="text-3xl font-extrabold tabular-nums">{grandTotal ?? "—"}</p>
            <p className="text-sm text-white/85">di seluruh cabang olahraga, semua tingkat &amp; tahun</p>
          </div>
        </div>
      </motion.div>

      {/* Tingkat Kejuaraan filter cards */}
      <motion.section {...fadeUp} className="mt-8">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-neutral-700">
          <Trophy size={15} className="text-primary" /> Tingkat Kejuaraan
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {tingkatCards.map((t) => {
            const active = tingkat === t.tingkatKejuaraan;
            return (
              <button
                key={t.tingkatKejuaraan}
                onClick={() => selectTingkat(t.tingkatKejuaraan)}
                className={`rounded-xl border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-primary bg-primary-50 ring-2 ring-primary/30" : "border-neutral-200 bg-white"
                }`}
              >
                <p className="truncate text-xs font-semibold text-neutral-700">{competitionLevelLabel(t.tingkatKejuaraan)}</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-neutral-900">{t.total}</p>
                <MiniTally counts={t} />
              </button>
            );
          })}
          {summary && tingkatCards.length === 0 && (
            <p className="col-span-full text-sm text-neutral-500">Belum ada perolehan medali.</p>
          )}
        </div>
      </motion.section>

      {/* Tahun filter cards */}
      <motion.section {...fadeUp} className="mt-8">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-neutral-700">
          <CalendarDays size={15} className="text-primary" /> Tahun
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {tahunCards.map((y) => {
            const active = tahun === String(y.tahun);
            return (
              <button
                key={y.tahun}
                onClick={() => selectTahun(y.tahun)}
                className={`rounded-xl border px-4 py-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-primary bg-primary-50 ring-2 ring-primary/30" : "border-neutral-200 bg-white"
                }`}
              >
                <p className="text-sm font-bold text-neutral-900">{y.tahun}</p>
                <MiniTally counts={y} />
              </button>
            );
          })}
          {summary && tahunCards.length === 0 && <p className="text-sm text-neutral-500">Belum ada perolehan medali.</p>}
        </div>
      </motion.section>

      {/* Table, filtered by the active card (if any) */}
      <motion.section {...fadeUp} className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-neutral-700">
            <MedalIcon size={15} className="text-primary" /> Rekap Medali per Cabor
          </h2>
          <AnimatePresence>
            {activeLabel && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setSearchParams({})}
                className="flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-100"
              >
                {activeLabel} <X size={13} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {error && <Card className="text-sm text-danger">Gagal memuat data.</Card>}
        {!error && rows === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
        {rows !== null && (
          <motion.div key={`${tingkat ?? ""}-${tahun ?? ""}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <RekapMedaliTable
              rows={rows}
              emptyMessage={activeLabel ? `Belum ada medali untuk ${activeLabel.toLowerCase()}.` : "Belum ada perolehan medali."}
              linkState={{ backTo: `/medali${location.search}`, backLabel: "Kembali ke Perolehan Medali" }}
            />
          </motion.div>
        )}
      </motion.section>
    </PublicShell>
  );
}

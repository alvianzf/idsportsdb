import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, QrCode, RefreshCw, ScanLine } from "lucide-react";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import {
  extractCardCode,
  isNativePlatform,
  startNativeScan,
  startWebScan,
  type StopFn,
} from "../lib/scanner";

type ScanState = "idle" | "scanning" | "processing" | "error";

interface VerifyResponse {
  valid: boolean;
  reason?: string;
  athlete?: { atletId: string };
}

const ERROR_LABELS: Record<string, string> = {
  NOT_FOUND: "Kartu tidak ditemukan.",
  REVOKED: "Kartu telah dicabut.",
  EXPIRED: "Kartu telah habis masa berlaku.",
  camera_denied: "Akses kamera ditolak. Izinkan kamera di pengaturan.",
  bad_qr: "QR code ini bukan kartu atlet KONI Batam.",
  network: "Gagal menghubungi server.",
};

const SHOW_RECORD_ANYWAY = new Set(["INACTIVE"]);

export function ScannerPage() {
  // ── All hooks unconditionally at top ──────────────────────────────────────
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const native = isNativePlatform();

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<StopFn | null>(null);
  const handledRef = useRef(false);

  const [state, setState] = useState<ScanState>(native ? "idle" : "scanning");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  // Auto-start web camera once user is confirmed
  useEffect(() => {
    if (!user || !DATA_ADMIN_ROLES.includes(user.role)) return;
    if (!native) startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user]);

  // ── Functions ─────────────────────────────────────────────────────────────
  async function handleRaw(raw: string) {
    if (handledRef.current) return;
    handledRef.current = true;

    stopRef.current?.();
    stopRef.current = null;

    const cardCode = extractCardCode(raw);
    if (!cardCode) { setErrorCode("bad_qr"); setState("error"); return; }

    setState("processing");
    try {
      const res = await api.get<VerifyResponse>(`/cards/verify/${cardCode}`);
      const { valid, reason, athlete } = res.data;

      if ((valid || (reason && SHOW_RECORD_ANYWAY.has(reason))) && athlete?.atletId) {
        navigate(`/atlet/${athlete.atletId}/rekam`, { replace: true });
      } else {
        setErrorCode(reason ?? "NOT_FOUND");
        setState("error");
      }
    } catch {
      setErrorCode("network");
      setState("error");
    }
  }

  async function startScan() {
    handledRef.current = false;
    setErrorCode(null);
    setState("scanning");

    if (native) {
      document.body.style.background = "transparent";
      document.documentElement.style.background = "transparent";
      document.body.classList.add("barcode-scanner-active");
      const rootEl = document.getElementById("root");
      if (rootEl) { rootEl.style.background = "transparent"; rootEl.style.backgroundColor = "transparent"; }
    }

    try {
      if (native) {
        stopRef.current = await startNativeScan(handleRaw);
      } else {
        if (!videoRef.current) return;
        stopRef.current = await startWebScan(videoRef.current, handleRaw);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setErrorCode(msg === "camera_denied" ? "camera_denied" : "network");
      setState("error");
      if (native) {
        document.body.style.background = "";
        document.documentElement.style.background = "";
        document.body.classList.remove("barcode-scanner-active");
        const rootEl = document.getElementById("root");
        if (rootEl) { rootEl.style.background = ""; rootEl.style.backgroundColor = ""; }
      }
    }
  }

  function handleBack() {
    stopRef.current?.();
    stopRef.current = null;
    navigate(-1);
  }

  // ── Auth guards — AFTER all hooks ─────────────────────────────────────────
  if (!user) return null;
  if (!DATA_ADMIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />;

  // ── Render ────────────────────────────────────────────────────────────────
  const showViewfinder = state === "scanning";

  // Viewfinder size: 60% of the shorter viewport dimension, clamped 240–420px
  const BOX = Math.max(240, Math.min(Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.6), 420));
  const HALF = Math.round(BOX / 2);

  const scanKeyframe = `@keyframes scan-line { 0% { top: 0 } 100% { top: 100% } }`;
  const scanLineStyle: CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0, height: 2,
    background: "#c8102e",
    animationName: "scan-line",
    animationDuration: "2s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  };

  const rootBg = native ? "transparent" : "#000";

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: rootBg }}>
      <style>{scanKeyframe}</style>

      {/* Header */}
      <div
        className="relative z-20 flex h-14 shrink-0 items-center justify-between px-4"
        style={{ background: "rgba(0,0,0,0.8)", paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          <ArrowLeft size={18} /> Kembali
        </button>
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Scan Kartu
        </span>
      </div>

      {/* Camera area
          isolation:isolate creates a new stacking context so the <video> GPU
          compositing layer is confined within it and cannot float above the
          overlay, which is also inside the same context. */}
      <div style={{ position: "relative", flex: 1, isolation: "isolate", background: native ? "transparent" : "#000" }}>

        {!native && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 1 }}
          />
        )}

        {showViewfinder && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
            {/* 4 dark rects leaving a transparent BOX×BOX hole in the centre */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: `calc(50% + ${HALF}px)`, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", top: `calc(50% + ${HALF}px)`, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", top: `calc(50% - ${HALF}px)`, bottom: `calc(50% - ${HALF}px)`, left: 0, right: `calc(50% + ${HALF}px)`, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "absolute", top: `calc(50% - ${HALF}px)`, bottom: `calc(50% - ${HALF}px)`, left: `calc(50% + ${HALF}px)`, right: 0, background: "rgba(0,0,0,0.6)" }} />

            {/* Corner brackets + scan line */}
            <div style={{ position: "absolute", top: `calc(50% - ${HALF}px)`, left: `calc(50% - ${HALF}px)`, width: BOX, height: BOX }}>
              <span style={{ position: "absolute", top: 0, left: 0, width: 36, height: 36, borderTop: "4px solid #fff", borderLeft: "4px solid #fff", borderRadius: "6px 0 0 0" }} />
              <span style={{ position: "absolute", top: 0, right: 0, width: 36, height: 36, borderTop: "4px solid #fff", borderRight: "4px solid #fff", borderRadius: "0 6px 0 0" }} />
              <span style={{ position: "absolute", bottom: 0, left: 0, width: 36, height: 36, borderBottom: "4px solid #fff", borderLeft: "4px solid #fff", borderRadius: "0 0 0 6px" }} />
              <span style={{ position: "absolute", bottom: 0, right: 0, width: 36, height: 36, borderBottom: "4px solid #fff", borderRight: "4px solid #fff", borderRadius: "0 0 6px 0" }} />
              <div style={scanLineStyle} />
            </div>
          </div>
        )}

        {native && state === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
              <QrCode size={48} style={{ color: "#fff" }} />
            </div>
            <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              Arahkan kamera ke QR code pada kartu atlet fisik
            </p>
            <button
              onClick={startScan}
              className="flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 active:scale-95"
              style={{ background: "#1a56db" }}
            >
              <ScanLine size={18} /> Mulai Scan
            </button>
          </div>
        )}

        {state === "processing" && (
          <div className="flex h-full flex-col items-center justify-center gap-4" style={{ zIndex: 20, position: "relative" }}>
            <div
              className="h-12 w-12 animate-spin rounded-full border-4"
              style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }}
            />
            <p className="text-sm font-medium text-white">Memeriksa kartu...</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-8" style={{ zIndex: 20, position: "relative" }}>
            <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "rgba(239,68,68,0.2)" }}>
              <QrCode size={40} style={{ color: "rgb(248,113,113)" }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">Scan Gagal</p>
              <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                {ERROR_LABELS[errorCode ?? ""] ?? "Terjadi kesalahan."}
              </p>
            </div>
            <button
              onClick={startScan}
              className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white transition"
              style={{ border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <RefreshCw size={16} /> Coba Lagi
            </button>
          </div>
        )}
      </div>

      {state === "scanning" && (
        <div
          className="relative z-20 flex shrink-0 flex-col items-center gap-1.5 pt-3"
          style={{ background: "rgba(0,0,0,0.8)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <ScanLine size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Arahkan ke QR code kartu atlet
          </p>
        </div>
      )}
    </div>
  );
}

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

// Reasons where we navigate to the record page even though valid=false
const SHOW_RECORD_ANYWAY = new Set(["INACTIVE"]);

export function ScannerPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const native = isNativePlatform();

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<StopFn | null>(null);
  const handledRef = useRef(false);

  const [state, setState] = useState<ScanState>(native ? "idle" : "scanning");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (!user) return <Navigate to="/login" replace />;
  if (!DATA_ADMIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

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

      // Navigate to record page if valid, OR if inactive (data still exists)
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
    }
  }

  useEffect(() => {
    if (!native) startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBack() {
    stopRef.current?.();
    stopRef.current = null;
    navigate(-1);
  }

  const showViewfinder = state === "scanning";

  // Inline keyframe so this page works even if index.css @keyframes isn't loaded
  const scanKeyframe = `@keyframes scan-line { 0% { top: 0 } 100% { top: 100% } }`;
  const scanLineStyle: CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0, height: 2,
    background: "#c8102e",
    animationName: "scan-line",
    animationDuration: "2s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  };

  // When native scanning, EVERY layer must be transparent so the native camera
  // (which renders behind the webview) shows through the transparent hole.
  // The dark surround comes from the overlay's rgba rects, not the root background.
  // On native: always transparent so ML Kit camera (behind webview) shows through.
  // Transparency is also set imperatively in startNativeScan before the camera starts.
  const rootBg = native ? "transparent" : "#000";

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: rootBg }}>
      {/* Inject scan-line keyframe scoped to this page */}
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

      {/* Camera area — transparent when native scanning so ML Kit camera shows through */}
      <div style={{ position: "relative", flex: 1, background: native ? "transparent" : "#000" }}>

        {/* Web only: own <video> element as camera feed */}
        {!native && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* Viewfinder overlay — shown on BOTH web and native.
            4 semi-transparent rects surround a transparent 240×240 hole.
            On native the camera renders behind the webview so the hole shows it.
            All inline styles — no Tailwind dependency. */}
        {showViewfinder && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
            {/* top */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "calc(50% + 120px)", background: "rgba(0,0,0,0.6)" }} />
            {/* bottom */}
            <div style={{ position: "absolute", top: "calc(50% + 120px)", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)" }} />
            {/* left */}
            <div style={{ position: "absolute", top: "calc(50% - 120px)", bottom: "calc(50% - 120px)", left: 0, right: "calc(50% + 120px)", background: "rgba(0,0,0,0.6)" }} />
            {/* right */}
            <div style={{ position: "absolute", top: "calc(50% - 120px)", bottom: "calc(50% - 120px)", left: "calc(50% + 120px)", right: 0, background: "rgba(0,0,0,0.6)" }} />

            {/* Corner brackets */}
            <div style={{ position: "absolute", top: "calc(50% - 120px)", left: "calc(50% - 120px)", width: 240, height: 240 }}>
              <span style={{ position: "absolute", top: 0, left: 0, width: 32, height: 32, borderTop: "4px solid #fff", borderLeft: "4px solid #fff", borderRadius: "6px 0 0 0" }} />
              <span style={{ position: "absolute", top: 0, right: 0, width: 32, height: 32, borderTop: "4px solid #fff", borderRight: "4px solid #fff", borderRadius: "0 6px 0 0" }} />
              <span style={{ position: "absolute", bottom: 0, left: 0, width: 32, height: 32, borderBottom: "4px solid #fff", borderLeft: "4px solid #fff", borderRadius: "0 0 0 6px" }} />
              <span style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderBottom: "4px solid #fff", borderRight: "4px solid #fff", borderRadius: "0 0 6px 0" }} />

              {/* Animated scan line */}
              {state === "scanning" && <div style={scanLineStyle} />}
            </div>
          </div>
        )}

        {/* Native idle */}
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

        {/* Processing */}
        {state === "processing" && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4"
              style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }}
            />
            <p className="text-sm font-medium text-white">Memeriksa kartu...</p>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
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

      {/* Bottom hint */}
      {state === "scanning" && (
        <div
          className="relative z-20 flex shrink-0 flex-col items-center gap-1.5 pt-3"
          style={{
            background: "rgba(0,0,0,0.8)",
            paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          }}
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

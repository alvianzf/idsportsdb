import { useEffect, useRef, useState } from "react";
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

const ERROR_LABELS: Record<string, string> = {
  NOT_FOUND: "Kartu tidak ditemukan.",
  REVOKED: "Kartu telah dicabut.",
  EXPIRED: "Kartu telah habis masa berlaku.",
  INACTIVE: "Status atlet tidak aktif.",
  camera_denied: "Akses kamera ditolak. Izinkan kamera di pengaturan.",
  bad_qr: "QR code ini bukan kartu atlet KONI Batam.",
  network: "Gagal menghubungi server.",
};

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

  // Always stop camera on unmount
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
      const res = await api.get<{ valid: boolean; reason?: string; athlete?: { atletId: string } }>(
        `/cards/verify/${cardCode}`,
      );
      if (res.data.valid && res.data.athlete?.atletId) {
        navigate(`/atlet/${res.data.athlete.atletId}/rekam`, { replace: true });
      } else {
        setErrorCode(res.data.reason ?? "NOT_FOUND");
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

  // Auto-start web scanner when component mounts
  useEffect(() => {
    if (!native) startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBack() {
    stopRef.current?.();
    stopRef.current = null;
    navigate(-1);
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Header */}
      <div className="relative z-20 flex h-14 shrink-0 items-center justify-between bg-black/80 px-4 pt-[env(safe-area-inset-top)]">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white"
        >
          <ArrowLeft size={18} /> Kembali
        </button>
        <span className="text-xs font-medium uppercase tracking-widest text-white/40">Scan Kartu</span>
      </div>

      {/* Camera / content area */}
      <div className="relative flex-1 overflow-hidden">

        {/* Web: native <video> fills the container */}
        {!native && (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Viewfinder overlay — 4-rect approach with transparent hole */}
        {!native && state === "scanning" && (
          <div className="pointer-events-none absolute inset-0">
            {/* top bar */}
            <div className="absolute inset-x-0 top-0 bg-black/55" style={{ bottom: "calc(50% + 120px)" }} />
            {/* bottom bar */}
            <div className="absolute inset-x-0 bottom-0 bg-black/55" style={{ top: "calc(50% + 120px)" }} />
            {/* left bar */}
            <div className="absolute bg-black/55" style={{ top: "calc(50% - 120px)", bottom: "calc(50% - 120px)", left: 0, right: "calc(50% + 120px)" }} />
            {/* right bar */}
            <div className="absolute bg-black/55" style={{ top: "calc(50% - 120px)", bottom: "calc(50% - 120px)", left: "calc(50% + 120px)", right: 0 }} />

            {/* Corner brackets */}
            <div
              className="absolute"
              style={{ top: "calc(50% - 120px)", left: "calc(50% - 120px)", width: 240, height: 240 }}
            >
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-white" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-white" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-white" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-white" />
              <div className="absolute inset-x-0 top-0 h-0.5 bg-primary animate-[scan_2s_linear_infinite]" />
            </div>
          </div>
        )}

        {/* Native idle */}
        {native && state === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
              <QrCode size={48} className="text-white" />
            </div>
            <p className="text-center text-sm text-white/60">
              Arahkan kamera ke QR code pada kartu atlet fisik
            </p>
            <button
              onClick={startScan}
              className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 active:scale-95"
            >
              <ScanLine size={18} /> Mulai Scan
            </button>
          </div>
        )}

        {/* Processing */}
        {state === "processing" && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            <p className="text-sm font-medium text-white">Memeriksa kartu...</p>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
              <QrCode size={40} className="text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">Scan Gagal</p>
              <p className="mt-2 text-sm text-white/60">{ERROR_LABELS[errorCode ?? ""] ?? "Terjadi kesalahan."}</p>
            </div>
            <button
              onClick={startScan}
              className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <RefreshCw size={16} /> Coba Lagi
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {state === "scanning" && (
        <div className="relative z-20 flex shrink-0 flex-col items-center gap-1.5 bg-black/80 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
          <ScanLine size={16} className="text-white/40" />
          <p className="text-xs text-white/40">Arahkan ke QR code kartu atlet</p>
        </div>
      )}
    </div>
  );
}

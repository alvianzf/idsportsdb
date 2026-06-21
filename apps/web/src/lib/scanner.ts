import { Capacitor } from "@capacitor/core";

export type OnResultFn = (raw: string) => void;
export type StopFn = () => void;

export function extractCardCode(raw: string): string | null {
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("verify");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch { /* not a URL */ }
  if (/^[A-Za-z0-9_-]{10,}$/.test(raw.trim())) return raw.trim();
  return null;
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// ---------------------------------------------------------------------------
// Web scanner — native getUserMedia + html5-qrcode file scan on canvas frames
// ---------------------------------------------------------------------------

export async function startWebScan(
  videoElement: HTMLVideoElement,
  onResult: OnResultFn,
): Promise<StopFn> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });

  videoElement.srcObject = stream;
  videoElement.setAttribute("playsinline", "true");
  await videoElement.play();

  let running = true;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Use BarcodeDetector (Chrome/Android) when available, otherwise jsQR
  const nativeBD = "BarcodeDetector" in window
    ? new (window as unknown as { BarcodeDetector: new (o: object) => { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ["qr_code"] })
    : null;

  async function tick() {
    if (!running) return;
    if (videoElement.readyState >= 2) {
      try {
        if (nativeBD) {
          const barcodes = await nativeBD.detect(videoElement);
          if (barcodes[0] && running) { onResult(barcodes[0].rawValue); return; }
        } else {
          const { default: jsQR } = await import("jsqr");
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          ctx.drawImage(videoElement, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height);
          if (code && running) { onResult(code.data); return; }
        }
      } catch { /* no QR in frame */ }
    }
    if (running) setTimeout(tick, 200);
  }

  setTimeout(tick, 200);

  return () => {
    running = false;
    stream.getTracks().forEach((t) => t.stop());
    videoElement.srcObject = null;
  };
}

// ---------------------------------------------------------------------------
// Native scanner — @capacitor-mlkit/barcode-scanning
// ---------------------------------------------------------------------------

export async function startNativeScan(onResult: OnResultFn): Promise<StopFn> {
  const { BarcodeScanner, BarcodeFormat } = await import(
    "@capacitor-mlkit/barcode-scanning"
  );

  const { camera } = await BarcodeScanner.checkPermissions();
  if (camera !== "granted") {
    const { camera: granted } = await BarcodeScanner.requestPermissions();
    if (granted !== "granted") throw new Error("camera_denied");
  }

  // Make the webview transparent so the native camera preview shows through.
  // Our overlay rects in the webview will provide the dark surround + corner brackets.
  document.documentElement.style.setProperty("--scanner-bg", "transparent");
  document.body.style.background = "transparent";
  document.documentElement.style.background = "transparent";

  let stopped = false;
  const listener = await BarcodeScanner.addListener("barcodesScanned", (event) => {
    const raw = event.barcodes[0]?.rawValue;
    if (!stopped && raw != null) onResult(raw);
  });

  await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode] });

  return () => {
    stopped = true;
    listener.remove();
    BarcodeScanner.stopScan();
    // Restore webview background
    document.body.style.background = "";
    document.documentElement.style.background = "";
  };
}

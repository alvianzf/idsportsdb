# Spec: Pemindai Kartu Atlet (In-App QR Card Scanner)

> **DIBATALKAN — Revisi klien 2026-07-12**: kartu atlet digital tidak
> diperlukan (`010-kartu-atlet-digital` dibatalkan), sehingga scanner QR kartu
> ikut dibatalkan. Spec dipertahankan sebagai arsip.
> See `specs/000-overview/revisi-2026-07-12.md`.

## 1. Overview

- **Purpose & scope**: A dedicated in-app QR code scanner that lets admins point their
  camera at a printed athlete card and immediately land on that athlete's full record
  (`/atlet/:id/rekam`). Replaces manually entering card codes or opening external camera
  apps. Works both in the Capacitor native shell (iOS/Android) and the web browser.

- **Glossary**:
  - `Pemindai` — Scanner
  - `Kartu Atlet Digital` — Digital/printed athlete card containing a QR code
  - `Kode Kartu` — Card code (opaque nanoid token encoded in the QR URL)

## 2. Data Model

No new database models. Scanner reads `AtletCard.qrPayloadUrl` (encoded in QR) and
calls the existing public verify endpoint to resolve it to an `atletId`.

## 3. API Contract

No new endpoints. Scanner reuses:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/cards/verify/:cardCode` | Public | Returns `{ valid, athlete: { atletId, ... } }` |

The `atletId` field was added to this response in spec `012-rekam-atlet`.

## 4. UI / Pages

### ScannerPage

- **Route**: `/scan` — registered **outside** `AppLayout` (full-screen, no shell chrome)
- **File**: `apps/web/src/pages/ScannerPage.tsx`
- **Auth**: Redirects to `/login` if unauthenticated. Admin roles only (`DATA_ADMIN_ROLES`).

#### States

| State | What the user sees |
|---|---|
| `idle` | "Ketuk untuk memindai" button (native only); video feed starting (web) |
| `scanning` | Live viewfinder with corner-bracket overlay; "Arahkan ke QR kartu atlet" hint |
| `processing` | Spinner; "Memeriksa kartu..." |
| `error` | Error message with retry button (card invalid/revoked/expired, camera denied) |

#### Layout (web)

```
┌─────────────────────────────────┐
│ ← Kembali           [platform]  │  ← fixed header (h-14, bg-black/80)
│                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│  │                             │ │
│  │    [live camera feed]       │ │  ← full viewport
│  │                             │ │
│  │  ┌───────────────────┐      │ │
│  │  │  corner brackets  │      │ │  ← 240×240 viewfinder overlay
│  │  │   (scan region)   │      │ │
│  │  └───────────────────┘      │ │
│  │                             │ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                 │
│  "Arahkan ke QR kartu atlet"    │  ← hint text (bottom)
└─────────────────────────────────┘
```

#### Layout (native / Capacitor)

The native MLKit scanner takes over the full screen with its own viewfinder UI.
`ScannerPage` shows only the "Mulai Scan" button; once tapped, the native scanner
launches. Results flow back into the same processing/error pipeline.

### Navigation entry points

1. **Sidebar** (desktop admin): nav item "Scan Kartu" with `ScanLine` icon.
2. **Bottom nav** (mobile admin): replaces "Prestasi" at position 3; Prestasi moves
   to sidebar-only. Bottom nav becomes: Dashboard · Atlet · **Scan** · Pelaporan.
3. **AtletDetailPage**: existing "Rekam Atlet" button links to `/atlet/:id/rekam`,
   not the scanner (scanner is for scanning unknown physical cards).

## 5. Platform Architecture

### Detection

```typescript
import { Capacitor } from '@capacitor/core';
const isNative = Capacitor.isNativePlatform(); // true on iOS/Android shell
```

### Native path — `@capacitor-mlkit/barcode-scanning@8.1.0`

Compatible with `@capacitor/core@^8`. Uses Android ML Kit and iOS Vision Framework.

```
ScannerPage
  └─ tap "Mulai Scan"
       └─ BarcodeScanner.checkPermissions() / requestPermissions()
       └─ BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode] })
       └─ addListener('barcodeScanned', ({ barcode }) => handleResult(barcode.rawValue))
       └─ on navigate away → BarcodeScanner.stopScan()
```

**Required native setup** (after `cap sync`):

*Android* — `android/app/build.gradle`:
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-mlkit-barcode-scanning:18.3.0'
}
```

*AndroidManifest.xml* — already included by plugin; verify camera permission is present:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

*iOS* — `ios/App/App/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Digunakan untuk memindai QR kartu atlet</string>
```

### Web path — `html5-qrcode@2.3.8`

Uses `getUserMedia` (camera) API. Works in Chromium/Safari desktop and in the
Capacitor WebView when the native plugin is not present (dev/web mode).

```
ScannerPage mounts <div id="qr-reader" />
  └─ Html5Qrcode("qr-reader").start(
       { facingMode: "environment" },
       { fps: 10, qrbox: 240 },
       onSuccess, onError
     )
  └─ on unmount → html5QrCode.stop()
```

### Shared result pipeline

Both paths call the same handler once a raw string is decoded:

```
rawValue (e.g. "https://app.koni-batam.go.id/verify/ABC123def456")
  └─ extractCardCode(rawValue)           // parse URL path → cardCode
  └─ GET /api/v1/cards/verify/:cardCode
       valid + atletId → navigate("/atlet/:atletId/rekam", { replace: true })
       invalid         → show error with reason label
```

`extractCardCode` accepts:
- Full verify URL: `**/verify/<code>` → extracts `<code>`
- Raw nanoid (21-char): treated directly as `cardCode` (forward-compat)

## 6. Scanner Abstraction (`apps/web/src/lib/scanner.ts`)

```typescript
export type OnResultFn = (raw: string) => void;
export type StopFn = () => void;

// Returns a stop function. Throws if permission denied.
export async function startWebScan(containerId: string, onResult: OnResultFn): Promise<StopFn>
export async function startNativeScan(onResult: OnResultFn): Promise<StopFn>
```

`ScannerPage` calls the appropriate function based on `Capacitor.isNativePlatform()`.

## 7. Role-Based Behavior

| Role | Can access `/scan` | Notes |
|---|---|---|
| SUPER_ADMIN_KONI | Yes | |
| ADMIN_KONI | Yes | |
| ADMIN_CABOR | Yes | Verify response is public; rekam page enforces cabor scoping via existing atlet API |
| ATLET | No | Redirected to `/me` |

## 8. Files Changed / Created

| File | Change |
|---|---|
| `apps/web/src/pages/ScannerPage.tsx` | New — scanner UI page |
| `apps/web/src/lib/scanner.ts` | New — platform-aware scanner abstraction |
| `apps/web/src/routes/AppRouter.tsx` | Add `/scan` route outside AppLayout |
| `apps/web/src/layouts/navConfig.ts` | Add "Scan Kartu" nav item |
| `apps/web/package.json` | Add `html5-qrcode`, `@capacitor-mlkit/barcode-scanning` |

## 9. Acceptance Criteria

- Given an admin opens `/scan` on web, when they allow camera access, then a live viewfinder appears.
- Given a valid KONI card QR is in the viewfinder, when decoded, then the user is navigated to `/atlet/:id/rekam` without pressing any button.
- Given an invalid/revoked/expired card QR is scanned, then an error message is shown with a retry option.
- Given the user opens `/scan` in the Capacitor native app, when they tap "Mulai Scan", then the native full-screen scanner launches.
- Given an `ATLET` role user navigates to `/scan`, then they are redirected away.
- Given the user denies camera permission, then a clear error with instructions is shown instead of a broken UI.

## 10. Dependencies

- `specs/010-kartu-atlet-digital/spec.md` — source of QR card format
- `specs/012-rekam-atlet/spec.md` — destination page (`/atlet/:id/rekam`) and `atletId` in verify response

## 11. Open Questions

- **Torch/flash**: MLKit plugin supports torch toggle on native; web `getUserMedia` does
  not expose flash reliably. Torch toggle is a nice-to-have for dimly-lit card scanning
  but out of scope for v1.
- **Multiple cameras**: Web scanner defaults to `facingMode: "environment"` (rear).
  Camera selector for desktop (multiple cameras) is out of scope for v1.
- **Offline verify**: Currently requires network call to verify. A future enhancement
  could embed minimal card data in the QR to allow offline verification.

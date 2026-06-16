# @inasportdb/web — KONI Batam SPA

React + Vite + Tailwind v4 frontend for the KONI Batam sports-management system.

## Development

```sh
npm run dev -w @inasportdb/web      # http://localhost:5173
npm run build -w @inasportdb/web    # production web build (apps/web/dist)
npm run lint -w @inasportdb/web
npm run typecheck -w @inasportdb/web
```

## Mobile app (Capacitor)

The SPA is wrapped for Android/iOS with [Capacitor](https://capacitorjs.com). The
`android/` and `ios/` platform projects are generated and gitignored — they are
not committed, only `capacitor.config.ts` is.

### One-time setup (already done, kept for reference if platforms are regenerated)

```sh
npx cap init "KONI Batam" "id.go.koni.batam.app" --web-dir=dist
npx cap add android
npx cap add ios
```

### Build & sync

Native builds must point at a network-reachable API origin (a phone/emulator
cannot reach the dev machine's `localhost`). Copy `.env.production.example`
(repo root) to `.env.production` and set `VITE_API_BASE_URL` to your LAN IP,
tunnel, or deployed API URL, then:

```sh
npm run cap:sync -w @inasportdb/web   # builds with --mode production and runs `cap sync`
npm run cap:open:android -w @inasportdb/web   # opens Android Studio
npm run cap:open:ios -w @inasportdb/web       # opens Xcode
```

From Android Studio / Xcode, run on a device or emulator as usual.

### Platform notes

- **Safe areas**: `index.html` sets `viewport-fit=cover`; `AppLayout` and
  `BottomNav` pad for `env(safe-area-inset-*)` so content clears notches/home
  indicators.
- **Uploads (camera/photo library)**: `AndroidManifest.xml` declares
  `CAMERA`, `READ_MEDIA_IMAGES`, and legacy `READ_EXTERNAL_STORAGE`
  permissions; `Info.plist` declares `NSCameraUsageDescription` and
  `NSPhotoLibrary*UsageDescription`. These back the native file-picker/camera
  sheet triggered by `<input type="file">` in `DokumenTab`/`PrestasiTab`.
- **HTTP API in dev**: `AndroidManifest.xml` sets
  `android:usesCleartextTraffic="true"` and `Info.plist` sets
  `NSAllowsArbitraryLoads`, so the app can reach a plain-HTTP API during
  development. Remove both once the API is served over HTTPS.

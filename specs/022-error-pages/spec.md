# Spec: 404 / Not-Found Pages & Logout

## 1. Overview

- **Purpose & scope**: Two distinct 404 experiences that match the two app
  shells (public vs authenticated admin), chosen by **context** not just auth
  state. Also fixes logout so it clears the server session.
- **PDF reference**: N/A — UX/correctness.

## 2. Data Model

None.

## 3. API

- `POST /api/v1/auth/logout` (existing) clears the httpOnly refresh cookie. The
  web logout now **calls it** (previously it did not — see §6 bug).

## 4. UI / Pages

- **File**: `apps/web/src/pages/NotFoundPage.tsx`.
- **`PublicNotFound`**: full-page 404 in the public/landing look — **KONI logo**,
  "404 / Halaman tidak ditemukan", link back to Beranda (`/`).
- **`DashboardNotFound`**: 404 rendered **inside `AppLayout`** (retains sidebar +
  topbar), with a **`FileQuestion` icon**, and a link to `/dashboard`.
- **`NotFoundPage`** (route element for the catch-all `path: "*"`): decides which
  to show:
  - **Logged in AND path is under an admin area** (`/dashboard`, `/atlet`,
    `/cabor`, `/pelatih`, `/prestasi`, `/monitoring`, `/events`, `/reports`,
    `/slider`, `/users`, `/audit`, `/me`, `/settings`) → `DashboardNotFound`
    wrapped in `<AppLayout>` (layout retained).
  - **Otherwise** (public path, or not authenticated) → `PublicNotFound`.
    This includes a **logged-in** user who lands on a public-side 404.
- **Router**: the catch-all is a single **top-level** `{ path: "*" }` (moved out
  of the `AppLayout` children so it isn't forced through the admin layout).
  `AppLayout` accepts an optional `children` prop and renders `{children ?? <Outlet/>}`.

## 5. Role-Based Behavior

- Dashboard 404 only appears for authenticated users on admin paths; everyone
  else gets the public 404. No role beyond authenticated/not.

## 6. Bug fixed — logout did not clear the session

- **Before**: the web logout only cleared the client store; it never called
  `POST /auth/logout`, so the httpOnly refresh cookie survived and the next
  `bootstrapAuth()` (on load) silently re-authenticated the user via `/refresh`
  — the user could still reach the dashboard after "logging out" (regression
  from the issue-#4 cookie work).
- **After**: a centralized `logout()` in `apps/web/src/lib/api.ts` calls
  `POST /auth/logout` first (clearing the cookie), then clears the client
  session; `AppLayout`'s Keluar button uses it.

## 7. Acceptance Criteria

- Given a logged-in admin, when they visit an unknown `/dashboard/...` (or other
  admin-area) URL, then a 404 renders **inside** the admin layout with an icon.
- Given a visitor (logged in or not) on an unknown public URL (e.g. a mistyped
  `/berita-x`), then the **public** 404 with the KONI logo renders.
- Given a logged-out visitor on any unknown URL, then the public 404 renders.
- Given a user clicks **Keluar (Logout)**, then the server refresh cookie is
  cleared and reloading the app does **not** re-authenticate them.

## 8. Dependencies

- Depends on: `001-auth-rbac` (auth/cookie flow), the `AppLayout` shell, and the
  public routes in `018-public-pages`.

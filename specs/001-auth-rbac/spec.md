# Spec: Auth & RBAC (Authentication & Role-Based Access Control)

## 1. Overview

- **Purpose & scope**: User authentication (login/refresh/logout), session
  management, and role-based access control underlying all other modules. Also
  covers user management (Module: "Hak Akses Pengguna" in the PDF).
- **PDF reference**: "HAK AKSES PENGGUNA" (page 4)
- **Glossary**:
  - `Super Admin KONI` — full system + user management access
  - `Admin KONI` — data entry/update + report management, all cabor
  - `Admin Cabang Olahraga` — data management scoped to own cabor
  - `Atlet` — self-service: own profile + digital card

## 2. Data Model

- **Entity**: `User` (`apps/api/prisma/schema.prisma`)
  - `id: String (uuid)`
  - `email: String @unique`
  - `passwordHash: String` — bcrypt
  - `role: Role` — `SUPER_ADMIN_KONI | ADMIN_KONI | ADMIN_CABOR | ATLET`
  - `fullName: String`
  - `isActive: Boolean @default(true)`
  - `cabangOlahragaId: String?` — **required** for `ADMIN_CABOR`, null otherwise
  - `athleteId: String? @unique` — links `ATLET` users to their `Atlet` record
  - `passwordResetToken: String? @unique` — hex token for password reset; null when not pending
  - `passwordResetExpiry: DateTime?` — token expiry (1 hour from issue); null when not pending
  - `createdAt`, `updatedAt`
- **Enums**: `Role` (`@inasportdb/shared-types` → `roles.ts`)
- **Relationships**: `User.cabangOlahragaId → CabangOlahraga.id`,
  `User.athleteId → Atlet.id` (one-to-one)
- **Indexes**: unique on `email`, unique on `athleteId`, index on `cabangOlahragaId`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | public | `{ email, password }` | `{ accessToken, refreshToken, user }` | bcrypt compare; 401 on failure |
| POST | `/api/v1/auth/refresh` | public (valid refresh token) | `{ refreshToken }` | `{ accessToken, refreshToken }` | rotates refresh token |
| POST | `/api/v1/auth/logout` | authenticated | - | `204` | stateless — client discards tokens |
| GET | `/api/v1/auth/me` | authenticated | - | `{ user }` | current session user |
| PATCH | `/api/v1/auth/me` | authenticated | `{ fullName?, email?, password? }` | `User` | self-service profile update; `isActive` field ignored (cannot self-deactivate) |
| POST | `/api/v1/auth/forgot-password` | public | `{ email }` | `204` | always 204 (anti-enumeration); generates reset token, sends email if user found |
| POST | `/api/v1/auth/reset-password` | public | `{ token, password }` | `204` | validates token + expiry, sets new password, clears token |
| GET | `/api/v1/users` | SUPER_ADMIN_KONI | `?role=&page=&pageSize=` | `{ items: User[], total }` | paginated, filter by role |
| POST | `/api/v1/users` | SUPER_ADMIN_KONI | `{ email, fullName, role, password, cabangOlahragaId?, athleteId? }` | `User` | auto-generated password if `password` omitted; sends welcome email |
| GET | `/api/v1/users/:id` | SUPER_ADMIN_KONI | - | `User` | |
| PATCH | `/api/v1/users/:id` | SUPER_ADMIN_KONI | partial `User` fields | `User` | |
| PATCH | `/api/v1/users/:id/role` | SUPER_ADMIN_KONI | `{ role, cabangOlahragaId?, athleteId? }` | `User` | dedicated endpoint since role change affects scoping fields |
| DELETE | `/api/v1/users/:id` | SUPER_ADMIN_KONI | - | `204` | soft delete via `isActive=false` |
| DELETE | `/api/v1/users/:id/permanent` | SUPER_ADMIN_KONI | - | `204` | hard delete — removes the `User` record entirely |
| POST | `/api/v1/users/:id/reset-password` | SUPER_ADMIN_KONI | - | `{ password }` | admin-initiated password reset; generates and returns a new random password, sends email to user |

- **Validation**: `apps/api/src/modules/auth/auth.schema.ts` (`loginSchema`,
  `createUserSchema`, `updateUserRoleSchema`) — `createUserSchema` requires
  `cabangOlahragaId` when `role === "ADMIN_CABOR"` and `athleteId` when
  `role === "ATLET"`.
- **Tokens**: access token (short-lived, `JWT_ACCESS_EXPIRES_IN`, default 15m),
  refresh token (`JWT_REFRESH_EXPIRES_IN`, default 7d). Both signed with
  separate secrets from `env`.

### Middleware (`apps/api/src/middleware/`)

- **`authenticate`** — verifies access token, attaches `req.user` (`{ id, role,
  cabangOlahragaId, athleteId }`).
- **`requireRole(roles: Role[])`** — 403 if `req.user.role` not in `roles`.
- **`scopeToCabor`** — for `ADMIN_CABOR`, sets `req.scopedCaborId =
  req.user.cabangOlahragaId`; route handlers must filter queries by this and
  reject (403) writes targeting a different cabor.
- **`requireSelfOrAdmin`** — for `/atlet/me*`-style routes, allows `ATLET` only
  when the target `atletId === req.user.athleteId`, or any `DATA_ADMIN_ROLES`.

## 4. UI / Pages

- **`/login`** — email/password form; "Lupa kata sandi?" link to `/forgot-password`; shows success banner when arriving with `?reset=1`.
- **`/forgot-password`** — email input; always shows "check your inbox" message after submit (anti-enumeration); calls `POST /auth/forgot-password`.
- **`/reset-password?token=…`** — new password + confirm form; calls `POST /auth/reset-password`; on success redirects to `/login?reset=1`; shows error if token is invalid or expired.
- **`/users`, `/users/new`, `/users/:id/edit`** — SUPER_ADMIN_KONI only, listed in
  `navConfig.ts` only for that role. List + create/edit form with role selector;
  conditionally shows cabor picker (role=ADMIN_CABOR) or athlete picker (role=ATLET).
- **Route guard**: `AppLayout` redirects to `/login` if `useAuthStore().user` is
  null (see `apps/web/src/layouts/AppLayout.tsx`). Per-route role checks performed
  via `navItemsForRole` (hides nav entries) — actual page-level guard to be added
  when each page is implemented (403 page if a non-permitted role hits a route
  directly).
- **Mobile**: login form centered, single column, max-width card (already
  implemented). User list/edit forms follow standard table/form patterns
  (stacked on mobile, `md:grid-cols-2` on desktop).

## 5. Role-Based Behavior

| Role | View Users | Create/Edit Users | Change Roles | Login |
|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ |
| ADMIN_KONI | ❌ | ❌ | ❌ | ✅ |
| ADMIN_CABOR | ❌ | ❌ | ❌ | ✅ |
| ATLET | ❌ | ❌ | ❌ | ✅ |

## 6. Acceptance Criteria

- Given valid credentials, when `POST /auth/login`, then response includes
  `accessToken`, `refreshToken`, and `user` with `role`, `cabangOlahragaId`,
  `athleteId`.
- Given an `ADMIN_CABOR` user, when they call any scoped endpoint (e.g.
  `GET /atlet?cabangOlahragaId=<other>`), then the API returns only their own
  cabor's data or `403` if they explicitly target another cabor's resource by id.
- Given an `ATLET` user, when they call `GET /atlet/me`, then they receive their
  own `Atlet` record; calling `GET /atlet/:otherId` returns `403`.
- Given a non-SUPER_ADMIN user, when they call any `/users*` endpoint, then `403`.
- Given an expired access token, when any authenticated request is made, then
  `401`, and the frontend `axios` interceptor calls `logout()` and redirects to
  `/login`.

## 7. Open Questions / Assumptions

- Refresh tokens: assumption is stateless JWT refresh tokens (no server-side
  revocation list) for v1; revisit if logout-everywhere is required.
- `ATLET` account provisioning: admins create the `User` record (with
  `athleteId` link) when entering athlete data; no self-registration flow.
- Refresh tokens are stateless JWTs (no server-side revocation list); revisit if logout-everywhere is required.

## 9. Email

Transactional email is sent via nodemailer (`apps/api/src/lib/email.ts`) using the Sumopod SMTP relay. From address: `no-reply@batam.koni.go.id`.

| Trigger | Template |
|---|---|
| User created (`POST /users`) | Welcome email with login URL + initial password |
| `POST /auth/forgot-password` (user found) | Password reset link (expires 1 hour) |

SMTP credentials are configured via environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Email sends are fire-and-forget — failures are logged but do not affect the API response.

## 8. Dependencies

- None (foundational spec). `003-cabang-olahraga` and `004-atlet` depend on this
  for `cabangOlahragaId`/`athleteId` linkage.

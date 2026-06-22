# Spec: Artikel & Berita (Article/News CMS)

## 1. Overview

- **Purpose & scope**: A simple CMS for KONI Batam news/announcements. Admins
  create, edit, and publish articles that appear in the "Artikel & Berita"
  section of the public landing page (`/`) and on individual article detail
  pages (`/artikel/:slug`).
- **PDF reference**: Not in original PDF — added per user request (2026-06-15).
- **Glossary**:
  - `Artikel` — article / news post
  - `Draf` — draft (unpublished)
  - `Diterbitkan` — published
  - `Slug` — URL-safe identifier auto-generated from title on creation; stable
    thereafter (PATCH does not regenerate it)
  - `Gambar Sampul` — cover image

## 2. Data Model

- **Entity**: `Article`
  - `id: String (uuid)`
  - `title: String` — article headline
  - `slug: String @unique` — auto-generated from title; used in public URLs
  - `excerpt: String?` — short summary shown in landing page cards
  - `content: String @db.Text` — full body
  - `coverImageUrl: String?` — `/uploads/artikel/<uuid>.ext` via the
    `uploader("artikel")` storage adapter
  - `published: Boolean @default(false)` — if `true`, visible to public
  - `publishedAt: DateTime?` — set automatically when `published` is first set
    to `true`; cleared when reverted to draft
  - `authorId: String` (FK → `User`) — the admin user who created it
  - `createdAt`, `updatedAt`
- **Relationships**: many-to-one → `User`
- **Indexes**: compound on `(published, publishedAt)`

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/artikel` | SUPER_ADMIN_KONI, ADMIN_KONI | `?search=`, `?published=` | `Article[]` (with author name) | returns all articles (drafts + published) |
| GET | `/api/v1/artikel/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `Article` | admin detail by id |
| POST | `/api/v1/artikel` | SUPER_ADMIN_KONI, ADMIN_KONI | `{ title, excerpt?, content, published? }` | `Article` | slug auto-generated; `publishedAt` set if `published: true` |
| PATCH | `/api/v1/artikel/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | partial fields | `Article` | publishing sets `publishedAt = now()`; reverting to draft clears it |
| POST | `/api/v1/artikel/:id/cover` | SUPER_ADMIN_KONI, ADMIN_KONI | `multipart/form-data file` | `Article` (with updated `coverImageUrl`) | stores under `uploads/artikel/`; updates `coverImageUrl` |
| POST | `/api/v1/artikel/images` | SUPER_ADMIN_KONI, ADMIN_KONI | `multipart/form-data file` (max 15 MB) | `{ url: string }` | uploads an inline image for the WYSIWYG editor; stored under `uploads/artikel-images/`; returns a public URL to embed in article `content` |
| DELETE | `/api/v1/artikel/:id` | SUPER_ADMIN_KONI, ADMIN_KONI | - | `204` | |
| GET | `/api/v1/public/artikel` | public (no auth) | `?limit=` (default 6, max 50) | summary fields only | published only, newest first |
| GET | `/api/v1/public/artikel/:slug` | public (no auth) | - | full article | 404 if not found or not published |

- **Validation**: `apps/api/src/modules/artikel/artikel.schema.ts`

## 4. UI / Pages

**Admin (inside `AppLayout`, roles SUPER_ADMIN_KONI/ADMIN_KONI):**
- **`/artikel`** (`ArtikelListPage`) — list of all articles (draft + published).
  Each row shows cover thumbnail, title, author, date, status badge
  (Diterbitkan/Draf), and action buttons: "Terbitkan/Jadikan Draf" toggle,
  edit (pencil icon → `/artikel/:id/edit`), delete.
- **`/artikel/new`**, **`/artikel/:id/edit`** (`ArtikelFormPage`) — form:
  Judul (required), Ringkasan (textarea), Konten (required, large textarea),
  Gambar Sampul (file input — image files only), "Terbitkan ke halaman utama"
  checkbox. Submitting creates or patches the article; then if a cover file was
  selected, sends it via `POST /artikel/:id/cover`.

**Public (outside `AppLayout`, no auth):**
- **`/`** (LandingPage) — "Artikel & Berita" section shows up to 6 published
  articles as cards (cover, title, excerpt, date, "Baca selengkapnya" link).
- **`/artikel/:slug`** (`ArtikelPublicPage`) — full article body, cover image,
  title, date. Returns 404 via NotFoundPage if unpublished.

**Nav**: "Artikel" item in sidebar (SUPER_ADMIN_KONI/ADMIN_KONI only),
`Newspaper` icon, not in bottom nav.

## 5. Role-Based Behavior

| Role | View (admin list) | Create | Update | Delete |
|---|---|---|---|---|
| SUPER_ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ |
| ADMIN_KONI | ✅ all | ✅ | ✅ | ✅ |
| ADMIN_CABOR | ❌ | ❌ | ❌ | ❌ |
| ATLET | ❌ | ❌ | ❌ | ❌ |
| Public (no auth) | published only (via `/public/artikel`) | ❌ | ❌ | ❌ |

## 6. Acceptance Criteria

- Given SUPER_ADMIN_KONI, when `POST /artikel` with `{ title: "Hello", content: "...", published: false }`,
  then response has `slug: "hello"` and `published: false`, `publishedAt: null`.
- Given SUPER_ADMIN_KONI, when `PATCH /artikel/:id` with `{ published: true }`,
  then `publishedAt` is set to a current timestamp.
- Given SUPER_ADMIN_KONI, when `PATCH /artikel/:id` with `{ published: false }`,
  then `publishedAt` is cleared (`null`).
- Given a duplicate title, when `POST /artikel`, then a numeric suffix is
  appended to the slug (e.g. `hello-2`) to keep slugs unique.
- Given an unauthenticated user, when `GET /public/artikel`,
  then only articles where `published = true` are returned.
- Given an unauthenticated user, when `GET /public/artikel/:slug` for a draft,
  then `404`.

## 7. Open Questions / Assumptions

- Content format: plain text / line-break-sensitive for v1; no rich-text editor
  yet. Content is rendered `whitespace-pre-wrap` on the public detail page.
- Cover image is replaced on each upload (no history kept).
- No category/tag system yet.

## 8. Dependencies

- Depends on: `001-auth-rbac`. No dependencies on other sport-data modules.

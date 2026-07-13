# Spec: SEO, GEO/AIO & Sitemap

## 1. Overview

- **Purpose & scope**: Make the public site discoverable by traditional search
  engines (SEO) and by AI / generative answer engines (GEO / AIO — Generative
  Engine Optimization), and expose a machine-readable sitemap. Public surface
  only; authenticated admin areas stay out of scope for indexing.
- **PDF reference**: N/A — infrastructure/marketing requirement.
- **Glossary**:
  - `GEO / AIO` — Generative/AI Engine Optimization: making content legible and
    welcome to LLM-based crawlers (GPTBot, ClaudeBot, PerplexityBot, …).
  - `llms.txt` — emerging convention: a markdown file describing a site for LLMs.

## 2. Data Model

No new entities. The sitemap reads existing `Article` rows (`published`, `slug`,
`updatedAt`).

## 3. API / Served resources

| Path | Served by | Content | Notes |
|---|---|---|---|
| `/robots.txt` | static (`apps/web/public/robots.txt` → dist root) | crawler policy | Allows public content + AI bots; disallows auth-gated admin paths; points to the sitemap. |
| `/llms.txt` | static (`apps/web/public/llms.txt`) | markdown site description for LLMs | GEO/AIO entry point. |
| `/sitemap.xml` | **static file** in the web `dist` root (`/var/www/konibatam/sitemap.xml`) | `application/xml` urlset | Static public pages (`/`, `/data`, `/berita`, `/event`) + one `<url>` per **published** article (`/artikel/{slug}`, `lastmod` = `updatedAt`). |

- Public site base URL: `PUBLIC_SITE_URL` env (default `https://konibatam.alvianzf.id`).
- **Generation**: XML is produced by the shared `buildSitemapXml()` helper
  (`apps/api/src/lib/sitemap.ts`), which is DB-outage-safe (static pages only if
  articles can't be read). It runs **(a) at build/deploy time** — a step in the
  CI/CD deploy workflow (`npm run sitemap`, `apps/api/prisma/generate-sitemap.ts`)
  writes `sitemap.xml` into the web `dist` before it is rsynced to the server —
  and **(b) at runtime** — `regenerateSitemap()` rewrites the file (path from
  `SITEMAP_PATH`, e.g. `/var/www/konibatam/sitemap.xml`) fire-and-forget whenever
  a berita/article is created, updated, or deleted, so the sitemap stays current
  between deploys.
- **Accessibility (required)**: all three URLs resolve at the **site root**
  (`https://konibatam.alvianzf.id/...`) as static files under the SPA `dist`
  root, served directly by nginx before the SPA `try_files` fallback (no proxy
  needed).
- **Bilingual (ID + EN)**: `llms.txt`, the meta description, Open Graph, Twitter
  and JSON-LD content are written in both Indonesian and English, framed as
  **public information about KONI Kota Batam** (the sport council); the internal
  "Sistem Manajemen" is described only as the access-controlled backend.

## 4. UI / Pages

No UI. Existing `index.html` already carries `<title>`, description, Open Graph,
Twitter, and JSON-LD (Organization/WebSite) tags; per-route document titles are
handled separately (`useDocumentTitle`, spec follows the dashboard/titles work).

## 5. Role-Based Behavior

None — all resources are public and unauthenticated.

## 6. Acceptance Criteria

- Given a crawler, when it requests `https://konibatam.alvianzf.id/robots.txt`,
  then it receives a policy that allows public content, disallows admin paths,
  and lists `Sitemap: https://konibatam.alvianzf.id/sitemap.xml`.
- Given `https://konibatam.alvianzf.id/sitemap.xml`, then it returns valid
  `application/xml` listing `/`, `/data`, and every published article URL with
  `lastmod`.
- Given `https://konibatam.alvianzf.id/llms.txt`, then it returns the markdown
  site description.
- Given the DB is temporarily down, when `/sitemap.xml` is requested, then it
  still returns a valid sitemap with the static entries.

## 7. Open Questions / Assumptions

- Assumes AI crawlers should be **welcomed** (opt-in) for public content; the
  robots.txt explicitly Allows the major AI bots. Flip to `Disallow` per bot if
  the org later wants to opt out of AI training/answering.
- Per-article structured data (`Article` JSON-LD injected on
  `ArtikelPublicPage`) is a possible enhancement, not included here.
- The sitemap is not paginated; fine at city-scale article volume.

## 8. Dependencies

- Depends on: `011-artikel` (article slugs/publish state), `018-public-pages`
  (the `/` and `/data` public routes). Requires the nginx `location = /sitemap.xml`
  proxy on the `konibatam.alvianzf.id` server block (deploy/infra step, not in CI).

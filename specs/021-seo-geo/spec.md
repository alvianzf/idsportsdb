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
| `/sitemap.xml` | **API** `app.get("/sitemap.xml")` in `apps/api/src/server.ts`, proxied to the site root by nginx | `application/xml` urlset | Dynamic: static public pages (`/`, `/data`) + one `<url>` per **published** article (`/artikel/{slug}`, `lastmod` = `updatedAt`). Falls back to the static entries if the DB is unreachable. |

- Public site base URL: `PUBLIC_SITE_URL` env (default `https://konibatam.alvianzf.id`).
- **Accessibility (required)**: all three URLs must resolve at the **site root**
  (`https://konibatam.alvianzf.id/...`). `robots.txt` / `llms.txt` are static
  files in the SPA `dist` root (served directly by nginx before the SPA
  fallback). `sitemap.xml` is dynamic, so nginx adds `location = /sitemap.xml`
  proxying to the API (`127.0.0.1:4100`) ahead of the SPA `try_files` fallback.

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

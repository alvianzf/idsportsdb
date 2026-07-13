import { writeFile } from "node:fs/promises";
import { prisma } from "./prisma.js";

const BASE = (process.env.PUBLIC_SITE_URL ?? "https://konibatam.alvianzf.id").replace(/\/$/, "");
const STATIC_PATHS = ["/", "/data", "/berita", "/event"];

/** Builds the sitemap XML: static public pages + every published article. */
export async function buildSitemapXml(): Promise<string> {
  const entries: { loc: string; lastmod?: string }[] = STATIC_PATHS.map((p) => ({ loc: `${BASE}${p}` }));
  try {
    const articles = await prisma.article.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const a of articles) {
      entries.push({ loc: `${BASE}/artikel/${a.slug}`, lastmod: a.updatedAt.toISOString() });
    }
  } catch (err) {
    console.error("[sitemap] articles unavailable — static pages only:", (err as Error).message);
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map((e) => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`)
      .join("\n") +
    `\n</urlset>\n`
  );
}

/**
 * Regenerate the served sitemap file, if a target path is configured
 * (SITEMAP_PATH, e.g. /var/www/konibatam/sitemap.xml in production). Called
 * fire-and-forget when berita/articles change; failures are logged, never
 * thrown, so they can't break the triggering request.
 */
export async function regenerateSitemap(): Promise<void> {
  const path = process.env.SITEMAP_PATH;
  if (!path) return;
  try {
    await writeFile(path, await buildSitemapXml());
  } catch (err) {
    console.error("[sitemap] regenerate failed:", (err as Error).message);
  }
}

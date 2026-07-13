/**
 * Build-time sitemap generator. Run after the web build, before the dist is
 * deployed (wired into the CI/CD deploy workflow). Writes a static sitemap.xml
 * of the public pages + every published article. The XML is built by the shared
 * `buildSitemapXml` helper (also used at runtime when berita change).
 *
 *   npm run sitemap --workspace=apps/api           # → ../web/dist/sitemap.xml
 *   tsx prisma/generate-sitemap.ts <output-path>   # custom output
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { buildSitemapXml } from "../src/lib/sitemap.js";
import { prisma } from "../src/lib/prisma.js";

async function main(): Promise<void> {
  const xml = await buildSitemapXml();
  const out = process.argv[2] ?? "../web/dist/sitemap.xml";
  writeFileSync(out, xml);
  console.log(`[sitemap] wrote ${out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

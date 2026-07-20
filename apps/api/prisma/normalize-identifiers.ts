/**
 * One-off backfill: canonicalize existing athlete identifiers so pre-existing
 * rows match the on-write normalization (see src/lib/identifiers.ts). Run once
 * after deploying the canonicalization change:
 *
 *   npm run normalize:identifiers --workspace=apps/api
 *
 * It is safe to re-run (idempotent). If two existing rows would collapse to the
 * same canonical value it reports them and changes NOTHING — those are real
 * duplicate people to resolve by hand, not something a script should merge.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { canonicalIdentifier } from "../src/lib/identifiers.js";

const prisma = new PrismaClient();

function push(map: Map<string, string[]>, key: string, id: string): void {
  const ids = map.get(key);
  if (ids) ids.push(id);
  else map.set(key, [id]);
}

async function main(): Promise<void> {
  const atlets = await prisma.atlet.findMany({
    select: { id: true, nomorIndukAtlet: true, nomorRegistrasi: true },
  });

  // Detect canonical collisions before writing anything.
  const byInduk = new Map<string, string[]>();
  const byReg = new Map<string, string[]>();
  for (const a of atlets) {
    if (a.nomorIndukAtlet) push(byInduk, canonicalIdentifier(a.nomorIndukAtlet), a.id);
    push(byReg, canonicalIdentifier(a.nomorRegistrasi), a.id);
  }
  const collisions = [
    ...[...byInduk].filter(([, ids]) => ids.length > 1).map(([k, ids]) => `  Nomor induk "${k}": ${ids.join(", ")}`),
    ...[...byReg].filter(([, ids]) => ids.length > 1).map(([k, ids]) => `  Nomor registrasi "${k}": ${ids.join(", ")}`),
  ];
  if (collisions.length) {
    console.error("Aborted — these existing rows collapse to the same canonical id (resolve manually):");
    console.error(collisions.join("\n"));
    process.exitCode = 1;
    return;
  }

  let updated = 0;
  for (const a of atlets) {
    const nomorIndukAtlet = a.nomorIndukAtlet ? canonicalIdentifier(a.nomorIndukAtlet) : null;
    const nomorRegistrasi = canonicalIdentifier(a.nomorRegistrasi);
    if (nomorIndukAtlet !== a.nomorIndukAtlet || nomorRegistrasi !== a.nomorRegistrasi) {
      await prisma.atlet.update({ where: { id: a.id }, data: { nomorIndukAtlet, nomorRegistrasi } });
      updated += 1;
    }
  }
  console.log(`Canonicalized ${updated} of ${atlets.length} athlete(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

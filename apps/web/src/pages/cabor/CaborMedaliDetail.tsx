import { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Medal as MedalIcon } from "lucide-react";
import { competitionLevelLabel, MEDAL_LABELS, type CompetitionLevel, type Medal } from "@inasportdb/shared-types";
import { Card } from "../../components/ui";

export interface MedaliDetailRow {
  namaKejuaraan: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: number;
  medali: Medal;
  /** Admin view only (dashboard cabor detail) — withheld on public pages. */
  atletNama?: string;
}

const MEDAL_DOT: Record<string, string> = { GOLD: "bg-gold", SILVER: "bg-silver", BRONZE: "bg-bronze" };
const MEDAL_TEXT: Record<string, string> = { GOLD: "text-gold", SILVER: "text-silver", BRONZE: "text-bronze" };

/**
 * Interactive "Rincian Medali" tab — year-chip filter + a list of individual
 * medal records (kejuaraan, tingkat, tahun). Shared by the dashboard
 * (`CaborDetailPage`, with athlete name) and public (`CaborPublicPage`,
 * without) cabor detail pages. See specs/024-rekap-medali-tally/spec.md.
 */
export function CaborMedaliDetail({ rows, loading }: { rows: MedaliDetailRow[] | null; loading?: boolean }) {
  const [year, setYear] = useState<number | "all">("all");

  const years = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.tahun))).sort((a, b) => b - a),
    [rows],
  );
  const filtered = useMemo(
    () => (rows ?? []).filter((r) => year === "all" || r.tahun === year),
    [rows, year],
  );

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
        <MedalIcon size={15} className="text-primary" /> Rincian Medali
      </h2>

      {loading && <p className="text-sm text-neutral-500">Memuat data...</p>}

      {!loading && rows !== null && rows.length === 0 && (
        <p className="text-sm text-neutral-500">Belum ada perolehan medali.</p>
      )}

      {!loading && rows !== null && rows.length > 0 && (
        <LayoutGroup>
          {/* Year tabs */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["all", ...years] as const).map((y) => {
              const active = year === y;
              return (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`relative rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    active ? "text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="medali-tab-pill"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative">{y === "all" ? "Semua Tahun" : y}</span>
                </button>
              );
            })}
          </div>

          {/* Records */}
          <AnimatePresence mode="popLayout">
            <motion.ul key={year} initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="divide-y divide-neutral-100">
              {filtered.map((r, i) => (
                <motion.li
                  key={`${r.namaKejuaraan}-${r.tahun}-${i}`}
                  variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${MEDAL_DOT[r.medali]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{r.namaKejuaraan}</p>
                    <p className="text-xs text-neutral-500">
                      {competitionLevelLabel(r.tingkatKejuaraan)} · {r.tahun}
                      {r.atletNama && <> · {r.atletNama}</>}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${MEDAL_TEXT[r.medali]}`}>{MEDAL_LABELS[r.medali]}</span>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </LayoutGroup>
      )}
    </Card>
  );
}

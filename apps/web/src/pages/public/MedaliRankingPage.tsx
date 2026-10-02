import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Medal as MedalIcon } from "lucide-react";
import { Card } from "../../components/ui";
import { api } from "../../lib/api";
import { PublicShell } from "./PublicShell";

interface RekapMedaliRow {
  cabangOlahragaId: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

type Jenis = "emas" | "perak" | "perunggu";

const JENIS_META: Record<Jenis, { label: string; field: "gold" | "silver" | "bronze"; gradient: string; text: string; ring: string }> = {
  emas: { label: "Emas", field: "gold", gradient: "from-[#f7b500] to-[#e08700]", text: "text-gold", ring: "ring-gold/30" },
  perak: { label: "Perak", field: "silver", gradient: "from-[#9ca3af] to-[#6b7280]", text: "text-silver", ring: "ring-silver/30" },
  perunggu: { label: "Perunggu", field: "bronze", gradient: "from-[#c9793a] to-[#98501c]", text: "text-bronze", ring: "ring-bronze/30" },
};

/** Peringkat cabor per jenis medali — reached by clicking a medal figure on the
 * landing page's "Perolehan Medali" card. See specs/024-rekap-medali-tally. */
export function MedaliRankingPage() {
  const { jenis } = useParams<{ jenis: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RekapMedaliRow[] | null>(null);
  const [error, setError] = useState(false);

  const meta = jenis && jenis in JENIS_META ? JENIS_META[jenis as Jenis] : null;

  useEffect(() => {
    if (!meta) return;
    api
      .get<RekapMedaliRow[]>("/public/rekap-medali")
      .then((res) => setRows(res.data))
      .catch(() => setError(true));
  }, [meta]);

  if (!meta) {
    return (
      <PublicShell title="Peringkat Medali" description="Jenis medali tidak dikenal.">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <ArrowLeft size={16} /> Kembali ke beranda
        </Link>
      </PublicShell>
    );
  }

  const ranked = (rows ?? [])
    .filter((r) => r[meta.field] > 0)
    .sort((a, b) => b[meta.field] - a[meta.field]);
  const max = ranked.length > 0 ? ranked[0][meta.field] : 0;

  return (
    <PublicShell title={`Peringkat Medali ${meta.label}`} description="Cabang olahraga yang berhasil meraih medali, diurutkan dari perolehan terbanyak.">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft size={16} /> Kembali
      </button>

      {/* Hero banner, colored by medal type. */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br ${meta.gradient} px-6 py-8 text-white shadow-lg`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <MedalIcon size={28} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Medali {meta.label}</p>
            <p className="text-3xl font-extrabold tabular-nums">
              {ranked.reduce((sum, r) => sum + r[meta.field], 0)}
            </p>
            <p className="text-sm text-white/85">diraih oleh {ranked.length} cabang olahraga</p>
          </div>
        </div>
      </motion.div>

      {error && <Card className="text-sm text-danger">Gagal memuat data peringkat.</Card>}
      {!error && rows === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}

      {rows !== null && ranked.length === 0 && (
        <Card className="text-sm text-neutral-500">Belum ada cabang olahraga yang meraih medali {meta.label.toLowerCase()}.</Card>
      )}

      {ranked.length > 0 && (
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          className="space-y-2.5"
        >
          {ranked.map((r, i) => {
            const pct = max > 0 ? Math.max((r[meta.field] / max) * 100, 6) : 0;
            return (
              <motion.li
                key={r.cabangOlahragaId}
                variants={{ hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <Link
                  to={`/cabang-olahraga/${r.cabangOlahragaId}`}
                  className={`block rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${i === 0 ? `ring-2 ${meta.ring}` : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        i === 0
                          ? `bg-gradient-to-br ${meta.gradient} text-white`
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold text-neutral-900">{r.nama}</p>
                        <p className={`shrink-0 text-lg font-extrabold tabular-nums ${meta.text}`}>{r[meta.field]}</p>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 + i * 0.03 }}
                          className={`h-full rounded-full bg-gradient-to-r ${meta.gradient}`}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </PublicShell>
  );
}

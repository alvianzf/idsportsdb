import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Medal as MedalIcon, Printer, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import { competitionLevelLabel, type CompetitionLevel } from "@inasportdb/shared-types";
import { Button, Card, Combobox, DataTable, type Column } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";
import { PublicShell } from "./PublicShell";
import { RekapMedaliTable, type RekapMedaliRow } from "./RekapMedaliTable";

interface PerCaborRow {
  id: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

interface CaborOverviewRow {
  id: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

interface KontingenRow {
  id: string;
  nama: string;
  isOwn: boolean;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  caborTally: RekapMedaliRow[];
}

interface MedaliEventPayload {
  event: { id: string; nama: string; tahun: number; tingkatKejuaraan: CompetitionLevel; logoUrl: string | null };
  kontingen: KontingenRow[];
  cabors: { id: string; nama: string }[];
  grandTotal: number;
}

function MiniTally({ k }: { k: { gold: number; silver: number; bronze: number } }) {
  return (
    <div className="mt-2 flex items-center gap-2.5 text-[11px] font-bold">
      <span className="flex items-center gap-1 text-gold">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {k.gold}
      </span>
      <span className="flex items-center gap-1 text-silver">
        <span className="h-1.5 w-1.5 rounded-full bg-silver" /> {k.silver}
      </span>
      <span className="flex items-center gap-1 text-bronze">
        <span className="h-1.5 w-1.5 rounded-full bg-bronze" /> {k.bronze}
      </span>
    </div>
  );
}

/** Ad-hoc multi-kontingen event tally — at most one event exists. See
 * specs/025-medali-event-adhoc/spec.md. */
export function MedaliEventPublicPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<MedaliEventPayload | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"total" | "cabor">("total");
  const [selectedCabor, setSelectedCabor] = useState("");
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    setPrinting(true);
    try {
      const res = await api.get("/public/medali-event/pdf", { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rekap-medali-event.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mencetak rekap.");
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => {
    api.get<MedaliEventPayload | null>("/public/medali-event").then((res) => setData(res.data));
  }, []);

  const kontingenList = useMemo(() => data?.kontingen ?? [], [data]);

  // Cabor registered to the event, plus (defensively) any cabor a tally
  // already exists for — so the "Per Cabor" filter offers a sport before it
  // has a single medal recorded, not just after.
  const caborOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data?.cabors ?? []) map.set(c.id, c.nama);
    for (const k of kontingenList) for (const c of k.caborTally) map.set(c.cabangOlahragaId, c.nama);
    return Array.from(map, ([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [data, kontingenList]);

  // One row per Kota/Kab for the selected cabor — gold, then silver, then
  // bronze, descending (not total).
  const perCaborRows: PerCaborRow[] = useMemo(() => {
    if (!selectedCabor) return [];
    return kontingenList
      .map((k) => {
        const c = k.caborTally.find((t) => t.cabangOlahragaId === selectedCabor);
        return { id: k.id, nama: k.nama, gold: c?.gold ?? 0, silver: c?.silver ?? 0, bronze: c?.bronze ?? 0, total: c?.total ?? 0 };
      })
      .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
  }, [kontingenList, selectedCabor]);

  // Every registered cabor, summed across all Kabupaten/Kota — shown before
  // any cabor is picked, so the full list is visible (0s included) instead
  // of hiding behind the dropdown.
  const caborOverviewRows: CaborOverviewRow[] = useMemo(() => {
    return caborOptions
      .map((c) => {
        let gold = 0, silver = 0, bronze = 0;
        for (const k of kontingenList) {
          const t = k.caborTally.find((row) => row.cabangOlahragaId === c.id);
          if (t) { gold += t.gold; silver += t.silver; bronze += t.bronze; }
        }
        return { id: c.id, nama: c.nama, gold, silver, bronze, total: gold + silver + bronze };
      })
      // Gold, then silver, then bronze, each descending — not total.
      .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
  }, [caborOptions, kontingenList]);

  if (data === undefined) {
    return (
      <PublicShell title="Perolehan Medali" description="Memuat data...">
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      </PublicShell>
    );
  }

  if (!data) {
    return (
      <PublicShell title="Perolehan Medali" description="Belum ada event yang dikonfigurasi.">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700">
          <ArrowLeft size={16} /> Kembali
        </button>
        <Card className="text-sm text-neutral-500">Belum ada event medali yang dikonfigurasi.</Card>
      </PublicShell>
    );
  }

  const { event, kontingen, grandTotal } = data;
  const activeKontingen = kontingen.find((k) => k.id === selected) ?? null;

  const leaderboardColumns: Column<KontingenRow>[] = [
    { key: "nama", label: "Kontingen", mobile: true, render: (k) => <span className="font-medium text-neutral-900">{k.nama}</span> },
    { key: "gold", label: "Emas", mobile: true, render: (k) => <span className="text-gold">{k.gold}</span> },
    { key: "silver", label: "Perak", render: (k) => <span className="text-silver">{k.silver}</span> },
    { key: "bronze", label: "Perunggu", render: (k) => <span className="text-bronze">{k.bronze}</span> },
    { key: "total", label: "Total", mobile: true, render: (k) => <span className="font-semibold text-neutral-900">{k.total}</span> },
  ];

  // Same columns as the leaderboard, but rows are already sorted by
  // gold -> silver -> bronze (not total) by the caller, so no `sortable`.
  const perCaborColumns: Column<PerCaborRow>[] = [
    { key: "nama", label: "Kabupaten/Kota", mobile: true, render: (k) => <span className="font-medium text-neutral-900">{k.nama}</span> },
    { key: "gold", label: "Emas", mobile: true, render: (k) => <span className="text-gold">{k.gold}</span> },
    { key: "silver", label: "Perak", render: (k) => <span className="text-silver">{k.silver}</span> },
    { key: "bronze", label: "Perunggu", render: (k) => <span className="text-bronze">{k.bronze}</span> },
    { key: "total", label: "Total", mobile: true, render: (k) => <span className="font-semibold text-neutral-900">{k.total}</span> },
  ];

  // Every registered cabor, clickable to drill into its per-Kabupaten/Kota
  // breakdown (same as picking it from the Combobox above).
  const caborOverviewColumns: Column<CaborOverviewRow>[] = [
    {
      key: "nama",
      label: "Cabang Olahraga",
      mobile: true,
      sortable: true,
      getValue: (c) => c.nama,
      render: (c) => (
        <button onClick={() => setSelectedCabor(c.id)} className="font-medium text-primary hover:underline">
          {c.nama}
        </button>
      ),
    },
    { key: "gold", label: "Emas", mobile: true, sortable: true, getValue: (c) => c.gold, render: (c) => <span className="text-gold">{c.gold}</span> },
    { key: "silver", label: "Perak", sortable: true, getValue: (c) => c.silver, render: (c) => <span className="text-silver">{c.silver}</span> },
    { key: "bronze", label: "Perunggu", sortable: true, getValue: (c) => c.bronze, render: (c) => <span className="text-bronze">{c.bronze}</span> },
    { key: "total", label: "Total", mobile: true, sortable: true, getValue: (c) => c.total, render: (c) => <span className="font-semibold text-neutral-900">{c.total}</span> },
  ];

  return (
    <PublicShell title={`Perolehan Medali — ${event.nama}`} description={`${competitionLevelLabel(event.tingkatKejuaraan)} Tahun ${event.tahun}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700">
          <ArrowLeft size={16} /> Kembali
        </button>
        <Button variant="outline" onClick={handlePrint} disabled={printing}>
          <Printer size={16} /> {printing ? "Mencetak..." : "Cetak Rekap"}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#5c0000] via-[#990000] to-[#d92626] px-6 py-8 text-white shadow-lg"
      >
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          {event.logoUrl ? (
            <img src={resolveFileUrl(event.logoUrl)} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white/15 object-contain p-1.5 backdrop-blur" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Trophy size={28} />
            </div>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Total Perolehan Medali</p>
            <p className="text-3xl font-extrabold tabular-nums">{grandTotal}</p>
            <p className="text-sm text-white/85">
              {event.nama} · {competitionLevelLabel(event.tingkatKejuaraan)} {event.tahun}
            </p>
          </div>
        </div>
      </motion.div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-700">Kabupaten &amp; Kota</h2>
      <div className="mb-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {kontingen.map((k) => {
          const active = selected === k.id;
          return (
            <button
              key={k.id}
              onClick={() => {
                setView("total");
                setSelected(active ? null : k.id);
              }}
              className={`rounded-xl border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                active ? "border-primary bg-primary-50 ring-2 ring-primary/30" : "border-neutral-200 bg-white"
              }`}
            >
              <p className="truncate text-xs font-semibold text-neutral-700">{k.nama}</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-neutral-900">{k.total}</p>
              <MiniTally k={k} />
            </button>
          );
        })}
      </div>

      {/* Rekap vs. Per Cabor */}
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {(
          [
            { key: "total", label: "Rekap" },
            { key: "cabor", label: "Per Cabor" },
          ] as { key: "total" | "cabor"; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              view === t.key ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "total" && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-neutral-700">
              <MedalIcon size={15} className="text-primary" />
              {activeKontingen ? `Rekap Medali Cabor — Kontingen ${activeKontingen.nama}` : "Rekap"}
            </h2>
            <AnimatePresence>
              {activeKontingen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelected(null)}
                  className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-100"
                >
                  Kembali ke Rekap
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <motion.div key={selected ?? "total"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            {activeKontingen ? (
              <RekapMedaliTable
                rows={activeKontingen.caborTally}
                emptyMessage="Belum ada tally untuk kontingen ini."
                linkState={{ backTo: "/medali/event", backLabel: "Kembali ke Perolehan Medali" }}
              />
            ) : (
              <DataTable
                columns={leaderboardColumns}
                rows={[...kontingen].sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze)}
                emptyMessage="Belum ada kontingen."
              />
            )}
          </motion.div>
        </>
      )}

      {view === "cabor" && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {selectedCabor ? (
              <>
                <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-neutral-700">
                  <MedalIcon size={15} className="text-primary" />
                  Perolehan — {caborOptions.find((c) => c.id === selectedCabor)?.nama}
                </h2>
                <button
                  onClick={() => setSelectedCabor("")}
                  className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-100"
                >
                  Kembali ke Semua Cabor
                </button>
              </>
            ) : (
              <div className="max-w-xs flex-1">
                <Combobox
                  value={selectedCabor}
                  onChange={setSelectedCabor}
                  options={caborOptions.map((c) => ({ value: c.id, label: c.nama }))}
                  placeholder="Cari cabang olahraga"
                />
              </div>
            )}
          </div>
          <motion.div key={selectedCabor || "none"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            {!selectedCabor ? (
              <DataTable
                columns={caborOverviewColumns}
                rows={caborOverviewRows}
                emptyMessage="Belum ada cabor terdaftar di event ini."
              />
            ) : (
              <DataTable
                columns={perCaborColumns}
                rows={perCaborRows}
                emptyMessage="Belum ada tally untuk cabor ini."
              />
            )}
          </motion.div>
        </>
      )}
    </PublicShell>
  );
}

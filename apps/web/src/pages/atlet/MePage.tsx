import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import type { AtletDetail } from "./types";
import { BiodataTab } from "./tabs/BiodataTab";
import { DokumenTab } from "./tabs/DokumenTab";
import { PrestasiTab } from "./tabs/PrestasiTab";
import { MonitoringTab } from "./tabs/MonitoringTab";
import { KartuTab } from "./tabs/KartuTab";

const TABS = [
  { key: "biodata", label: "Biodata" },
  { key: "dokumen", label: "Dokumen" },
  { key: "prestasi", label: "Prestasi" },
  { key: "monitoring", label: "Monitoring" },
  { key: "kartu", label: "Kartu" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Module B — Atlet self-service profile. See specs/004-atlet/spec.md §5. */
export function MePage() {
  const [atlet, setAtlet] = useState<AtletDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("biodata");

  function load() {
    api
      .get<AtletDetail>("/atlet/me")
      .then((res) => setAtlet(res.data))
      .catch(() => setError("Gagal memuat data profil."));
  }

  useEffect(load, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!atlet) return <p className="text-sm text-neutral-500">Memuat data...</p>;

  return (
    <div>
      <PageHeader title="Profil Saya" description={`${atlet.nomorIndukAtlet} · ${atlet.cabangOlahraga.nama}`} />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "biodata" && <BiodataTab atlet={atlet} />}
      {tab === "dokumen" && (
        <DokumenTab atletId={atlet.id} documents={atlet.documents ?? []} canManage={false} onChange={load} />
      )}
      {tab === "prestasi" && <PrestasiTab atletId={atlet.id} canManage={false} />}
      {tab === "monitoring" && (
        <MonitoringTab atletId={atlet.id} canManage={false} currentCabangOlahragaId={atlet.cabangOlahragaId} />
      )}
      {tab === "kartu" && <KartuTab atletId={atlet.id} canManage={false} self />}
    </div>
  );
}

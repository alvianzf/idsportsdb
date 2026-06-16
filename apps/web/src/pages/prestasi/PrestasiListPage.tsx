import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMPETITION_LEVELS,
  COMPETITION_LEVEL_LABELS,
  MEDALS,
  MEDAL_LABELS,
  UNSCOPED_ADMIN_ROLES,
  type CompetitionLevel,
  type Medal,
} from "@inasportdb/shared-types";
import { Card, PageHeader, Input, Select, Badge, Pagination, Combobox } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface PrestasiRow {
  id: string;
  namaKejuaraan: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: number;
  medali: Medal;
  peringkat: number | null;
  atlet: {
    id: string;
    namaLengkap: string;
    cabangOlahragaId: string;
    cabangOlahraga: { id: string; nama: string };
  };
}

interface CaborOption {
  id: string;
  nama: string;
}

const MEDAL_TONE: Record<Medal, "gold" | "silver" | "bronze" | "neutral"> = {
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
  NONE: "neutral",
};

/** Module F — Prestasi Atlet list. See specs/007-prestasi-atlet/spec.md. */
export function PrestasiListPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role && UNSCOPED_ADMIN_ROLES.includes(role);

  const [items, setItems] = useState<PrestasiRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cabor, setCabor] = useState("");
  const [tahun, setTahun] = useState("");
  const [tingkat, setTingkat] = useState("");
  const [medali, setMedali] = useState("");
  const [page, setPage] = useState(1);
  const [cabors, setCabors] = useState<CaborOption[]>([]);
  const [error, setError] = useState(false);

  const pageSize = 20;

  useEffect(() => {
    if (!isUnscopedAdmin) return;
    api.get<CaborOption[]>("/cabor").then((res) => setCabors(res.data));
  }, [isUnscopedAdmin]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api
      .get("/prestasi", {
        params: {
          cabor: cabor || undefined,
          tahun: tahun || undefined,
          tingkat: tingkat || undefined,
          medali: medali || undefined,
          page,
          pageSize,
        },
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cabor, tahun, tingkat, medali, page]);

  return (
    <div>
      <PageHeader title="Prestasi Atlet" description="Daftar prestasi atlet KONI Batam" />

      <Card className="mb-4 flex flex-wrap items-center gap-3">
        {isUnscopedAdmin && (
          <Combobox
            value={cabor}
            onChange={(v) => {
              setPage(1);
              setCabor(v);
            }}
            options={[{ value: "", label: "Semua Cabor" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
            placeholder="Semua Cabor"
            className="w-48"
          />
        )}
        <Select
          value={tingkat}
          onChange={(e) => {
            setPage(1);
            setTingkat(e.target.value);
          }}
          className="w-auto"
        >
          <option value="">Semua Tingkat</option>
          {COMPETITION_LEVELS.map((l) => (
            <option key={l} value={l}>
              {COMPETITION_LEVEL_LABELS[l]}
            </option>
          ))}
        </Select>
        <Select
          value={medali}
          onChange={(e) => {
            setPage(1);
            setMedali(e.target.value);
          }}
          className="w-auto"
        >
          <option value="">Semua Medali</option>
          {MEDALS.map((m) => (
            <option key={m} value={m}>
              {MEDAL_LABELS[m]}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          placeholder="Tahun"
          value={tahun}
          onChange={(e) => {
            setPage(1);
            setTahun(e.target.value);
          }}
          className="w-28"
        />
      </Card>

      {error && <Card className="text-sm text-danger">Gagal memuat data.</Card>}

      {items === null ? (
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : items.length === 0 ? (
        <Card className="text-sm text-neutral-500">Belum ada data prestasi.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Atlet</th>
                <th className="px-4 py-3 font-medium">Cabor</th>
                <th className="px-4 py-3 font-medium">Kejuaraan</th>
                <th className="px-4 py-3 font-medium">Tingkat</th>
                <th className="px-4 py-3 font-medium">Tahun</th>
                <th className="px-4 py-3 font-medium">Hasil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link to={`/atlet/${p.atlet.id}`} className="font-medium text-primary hover:underline">
                      {p.atlet.namaLengkap}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{p.atlet.cabangOlahraga.nama}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.namaKejuaraan}</td>
                  <td className="px-4 py-3 text-neutral-600">{COMPETITION_LEVEL_LABELS[p.tingkatKejuaraan]}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.tahun}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={MEDAL_TONE[p.medali]}>{MEDAL_LABELS[p.medali]}</Badge>
                      {p.peringkat && <span className="text-neutral-500">Peringkat {p.peringkat}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import {
  COMPETITION_LEVELS,
  COMPETITION_LEVEL_LABELS,
  MEDALS,
  MEDAL_LABELS,
} from "@inasportdb/shared-types";
import { Input, Select } from "../../components/ui";
import { ReportPage } from "./ReportPage";

interface Row {
  namaKejuaraan: string;
  tingkatKejuaraan: string;
  tahun: number;
  medali: keyof typeof MEDAL_LABELS;
  peringkat: number | null;
  atlet: { namaLengkap: string; cabangOlahraga: { nama: string } };
}

/** specs/009-pelaporan/spec.md — report 5. */
export function PrestasiReportPage() {
  const [tahun, setTahun] = useState("");
  const [tingkat, setTingkat] = useState("");
  const [medali, setMedali] = useState("");

  return (
    <ReportPage<Row>
      title="Laporan Prestasi Atlet"
      description="Daftar prestasi atlet berdasarkan filter"
      endpoint="/reports/prestasi"
      params={{ tahun: tahun || undefined, tingkat: tingkat || undefined, medali: medali || undefined }}
      filenameBase="data-prestasi"
      filters={
        <>
          <Select
            value={tingkat}
            onChange={(v) => setTingkat(v)}
            options={[{ value: "", label: "Semua Tingkat" }, ...COMPETITION_LEVELS.map((l) => ({ value: l, label: COMPETITION_LEVEL_LABELS[l] }))]}
            className="w-44"
          />
          <Select
            value={medali}
            onChange={(v) => setMedali(v)}
            options={[{ value: "", label: "Semua Medali" }, ...MEDALS.map((m) => ({ value: m, label: MEDAL_LABELS[m] }))]}
            className="w-40"
          />
          <Input type="number" placeholder="Tahun" value={tahun} onChange={(e) => setTahun(e.target.value)} className="w-28" />
        </>
      }
      columns={[
        { header: "Atlet", render: (r) => r.atlet.namaLengkap },
        { header: "Cabang Olahraga", render: (r) => r.atlet.cabangOlahraga.nama },
        { header: "Kejuaraan", render: (r) => r.namaKejuaraan },
        { header: "Tingkat", render: (r) => COMPETITION_LEVEL_LABELS[r.tingkatKejuaraan as keyof typeof COMPETITION_LEVEL_LABELS] },
        { header: "Tahun", render: (r) => r.tahun },
        { header: "Medali", render: (r) => MEDAL_LABELS[r.medali] },
        { header: "Peringkat", render: (r) => r.peringkat ?? "-" },
      ]}
    />
  );
}

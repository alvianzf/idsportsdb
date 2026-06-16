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
          <Select value={tingkat} onChange={(e) => setTingkat(e.target.value)} className="w-auto">
            <option value="">Semua Tingkat</option>
            {COMPETITION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {COMPETITION_LEVEL_LABELS[l]}
              </option>
            ))}
          </Select>
          <Select value={medali} onChange={(e) => setMedali(e.target.value)} className="w-auto">
            <option value="">Semua Medali</option>
            {MEDALS.map((m) => (
              <option key={m} value={m}>
                {MEDAL_LABELS[m]}
              </option>
            ))}
          </Select>
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

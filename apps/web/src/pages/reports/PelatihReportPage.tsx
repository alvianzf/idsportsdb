import { useState } from "react";
import { Select } from "../../components/ui";
import { useCaborOptions } from "../../hooks/useCaborOptions";
import { ReportPage } from "./ReportPage";

interface Row {
  namaPelatih: string;
  nomorLisensi: string;
  tingkatanLisensi: string;
  cabangOlahraga: { nama: string };
}

/** specs/009-pelaporan/spec.md — report 4. */
export function PelatihReportPage() {
  const { cabors, isUnscopedAdmin } = useCaborOptions();
  const [cabor, setCabor] = useState("");

  return (
    <ReportPage<Row>
      title="Laporan Data Pelatih"
      description="Daftar pelatih beserta lisensi kepelatihan"
      endpoint="/reports/pelatih"
      params={{ cabor: cabor || undefined }}
      filenameBase="data-pelatih"
      filters={
        isUnscopedAdmin ? (
          <Select value={cabor} onChange={(e) => setCabor(e.target.value)} className="w-auto">
            <option value="">Semua Cabor</option>
            {cabors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama}
              </option>
            ))}
          </Select>
        ) : undefined
      }
      columns={[
        { header: "Nama Pelatih", render: (r) => r.namaPelatih },
        { header: "Cabang Olahraga", render: (r) => r.cabangOlahraga.nama },
        { header: "Nomor Lisensi", render: (r) => r.nomorLisensi },
        { header: "Tingkatan Lisensi", render: (r) => r.tingkatanLisensi },
      ]}
    />
  );
}

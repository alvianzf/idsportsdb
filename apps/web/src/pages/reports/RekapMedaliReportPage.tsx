import { useState } from "react";
import { Input, Select, Badge } from "../../components/ui";
import { useCaborOptions } from "../../hooks/useCaborOptions";
import { ReportPage } from "./ReportPage";

interface Row {
  cabangOlahragaId: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

/** specs/009-pelaporan/spec.md — report 6. */
export function RekapMedaliReportPage() {
  const { cabors, isUnscopedAdmin } = useCaborOptions();
  const [cabor, setCabor] = useState("");
  const [tahun, setTahun] = useState("");

  return (
    <ReportPage<Row>
      title="Rekap Medali"
      description="Rekapitulasi perolehan medali per cabang olahraga"
      endpoint="/reports/rekap-medali"
      params={{ cabor: cabor || undefined, tahun: tahun || undefined }}
      filenameBase="rekap-medali"
      filters={
        <>
          {isUnscopedAdmin && (
            <Select
              value={cabor}
              onChange={(v) => setCabor(v)}
              options={[{ value: "", label: "Semua Cabor" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
              className="w-full"
            />
          )}
          <Input type="number" placeholder="Tahun" value={tahun} onChange={(e) => setTahun(e.target.value)} className="w-full" />
        </>
      }
      columns={[
        { header: "Cabang Olahraga", render: (r) => r.nama },
        { header: "Emas", render: (r) => <Badge tone="gold">{r.gold}</Badge> },
        { header: "Perak", render: (r) => <Badge tone="silver">{r.silver}</Badge> },
        { header: "Perunggu", render: (r) => <Badge tone="bronze">{r.bronze}</Badge> },
        { header: "Total", render: (r) => r.total },
      ]}
    />
  );
}

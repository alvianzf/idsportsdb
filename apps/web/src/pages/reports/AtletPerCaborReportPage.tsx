import { useState } from "react";
import { ATHLETE_STATUSES, ATHLETE_STATUS_LABELS, GENDERS, GENDER_LABELS } from "@inasportdb/shared-types";
import { Select } from "../../components/ui";
import { useCaborOptions } from "../../hooks/useCaborOptions";
import { ReportPage } from "./ReportPage";

interface Row {
  cabangOlahragaId: string;
  nama: string;
  jumlahAtlet: number;
}

/** specs/009-pelaporan/spec.md — report 1. */
export function AtletPerCaborReportPage() {
  const { cabors, isUnscopedAdmin } = useCaborOptions();
  const [cabor, setCabor] = useState("");
  const [status, setStatus] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState("");

  return (
    <ReportPage<Row>
      title="Laporan Atlet per Cabang Olahraga"
      description="Jumlah atlet terdaftar pada setiap cabang olahraga"
      endpoint="/reports/atlet-per-cabor"
      params={{
        cabor: cabor || undefined,
        status: status || undefined,
        jenisKelamin: jenisKelamin || undefined,
      }}
      filenameBase="atlet-per-cabor"
      filters={
        <div className="grid gap-2 sm:grid-cols-3">
          {isUnscopedAdmin && (
            <Select
              value={cabor}
              onChange={(v) => setCabor(v)}
              options={[{ value: "", label: "Semua Cabor" }, ...cabors.map((c) => ({ value: c.id, label: c.nama }))]}
            />
          )}
          <Select
            value={status}
            onChange={(v) => setStatus(v)}
            options={[
              { value: "", label: "Semua Status" },
              ...ATHLETE_STATUSES.map((s) => ({ value: s, label: ATHLETE_STATUS_LABELS[s] })),
            ]}
          />
          <Select
            value={jenisKelamin}
            onChange={(v) => setJenisKelamin(v)}
            options={[
              { value: "", label: "Semua Jenis Kelamin" },
              ...GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] })),
            ]}
          />
        </div>
      }
      columns={[
        { header: "Cabang Olahraga", render: (r) => r.nama },
        { header: "Jumlah Atlet", render: (r) => r.jumlahAtlet },
      ]}
    />
  );
}

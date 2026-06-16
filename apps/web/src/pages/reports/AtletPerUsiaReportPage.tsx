import { useState } from "react";
import { Field, Input } from "../../components/ui";
import { ReportPage } from "./ReportPage";

interface Row {
  range: string;
  count: number;
}

/** specs/009-pelaporan/spec.md — report 2. */
export function AtletPerUsiaReportPage() {
  const [bucket, setBucket] = useState("5");

  return (
    <ReportPage<Row>
      title="Laporan Atlet per Usia"
      description="Distribusi jumlah atlet berdasarkan rentang usia"
      endpoint="/reports/atlet-per-usia"
      params={{ bucket }}
      filenameBase="atlet-per-usia"
      filters={
        <Field label="Rentang Usia (tahun)" htmlFor="bucket">
          <Input
            id="bucket"
            type="number"
            min={1}
            max={50}
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            className="w-24"
          />
        </Field>
      }
      columns={[
        { header: "Rentang Usia", render: (r) => `${r.range} tahun` },
        { header: "Jumlah Atlet", render: (r) => r.count },
      ]}
    />
  );
}

import { ReportPage } from "./ReportPage";

interface Row {
  kecamatan: string;
  count: number;
}

/** specs/009-pelaporan/spec.md — report 3. */
export function AtletPerKecamatanReportPage() {
  return (
    <ReportPage<Row>
      title="Laporan Atlet per Kecamatan"
      description="Distribusi jumlah atlet berdasarkan kecamatan domisili"
      endpoint="/reports/atlet-per-kecamatan"
      params={{}}
      filenameBase="atlet-per-kecamatan"
      columns={[
        { header: "Kecamatan", render: (r) => r.kecamatan },
        { header: "Jumlah Atlet", render: (r) => r.count },
      ]}
    />
  );
}

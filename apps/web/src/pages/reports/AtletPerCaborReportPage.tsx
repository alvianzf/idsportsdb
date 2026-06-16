import { ReportPage } from "./ReportPage";

interface Row {
  cabangOlahragaId: string;
  nama: string;
  jumlahAtlet: number;
}

/** specs/009-pelaporan/spec.md — report 1. */
export function AtletPerCaborReportPage() {
  return (
    <ReportPage<Row>
      title="Laporan Atlet per Cabang Olahraga"
      description="Jumlah atlet terdaftar pada setiap cabang olahraga"
      endpoint="/reports/atlet-per-cabor"
      params={{}}
      filenameBase="atlet-per-cabor"
      columns={[
        { header: "Cabang Olahraga", render: (r) => r.nama },
        { header: "Jumlah Atlet", render: (r) => r.jumlahAtlet },
      ]}
    />
  );
}

import { Link } from "react-router-dom";
import { FileBarChart } from "lucide-react";
import { Card, PageHeader } from "../../components/ui";

const REPORTS = [
  { to: "/reports/atlet-per-cabor", title: "Atlet per Cabang Olahraga", description: "Jumlah atlet pada setiap cabang olahraga" },
  { to: "/reports/atlet-per-usia", title: "Atlet per Usia", description: "Distribusi atlet berdasarkan rentang usia" },
  { to: "/reports/atlet-per-kecamatan", title: "Atlet per Kecamatan", description: "Distribusi atlet berdasarkan kecamatan" },
  { to: "/reports/pelatih", title: "Data Pelatih", description: "Daftar pelatih dan lisensi kepelatihan" },
  { to: "/reports/prestasi", title: "Prestasi Atlet", description: "Daftar prestasi atlet dengan filter" },
  { to: "/reports/rekap-medali", title: "Rekap Medali", description: "Rekapitulasi medali per cabang olahraga" },
];

/** Module H — Pelaporan index. See specs/009-pelaporan/spec.md. */
export function ReportsIndexPage() {
  return (
    <div>
      <PageHeader title="Pelaporan" description="Unduh laporan dalam format PDF atau Excel" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to}>
            <Card className="h-full transition-colors hover:border-primary">
              <FileBarChart className="mb-2 text-primary" size={24} />
              <h2 className="font-medium text-neutral-900">{r.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">{r.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

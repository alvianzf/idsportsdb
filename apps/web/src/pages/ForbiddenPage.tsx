import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-4xl font-bold text-primary">403</p>
      <h1 className="text-lg font-semibold text-neutral-900">Akses ditolak</h1>
      <p className="text-sm text-neutral-500">
        Anda tidak memiliki izin untuk mengakses halaman ini.
      </p>
      <Link to="/dashboard">
        <Button>Kembali ke Dashboard</Button>
      </Link>
    </div>
  );
}

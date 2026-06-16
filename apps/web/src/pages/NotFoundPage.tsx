import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-neutral-50 p-4 text-center">
      <p className="text-4xl font-bold text-primary">404</p>
      <h1 className="text-lg font-semibold text-neutral-900">Halaman tidak ditemukan</h1>
      <p className="text-sm text-neutral-500">Halaman yang Anda cari tidak tersedia.</p>
      <Link to="/">
        <Button>Kembali ke Beranda</Button>
      </Link>
    </div>
  );
}

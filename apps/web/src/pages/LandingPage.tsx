import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserCog, Building2, Medal as MedalIcon, CalendarDays } from "lucide-react";
import { Card, Button } from "../components/ui";
import { api, resolveFileUrl } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";

interface PublicStats {
  caborCount: number;
  activeAtletCount: number;
  pelatihCount: number;
  medals: { GOLD: number; SILVER: number; BRONZE: number };
}

interface PublicArtikel {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof Users;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-xl font-semibold text-neutral-900">{value}</p>
      </div>
    </Card>
  );
}

/** Public landing page (Module A subset). Fetches GET /public/stats, no auth required. */
export function LandingPage() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState(false);
  const [articles, setArticles] = useState<PublicArtikel[]>([]);

  const loadData = useCallback(() => {
    api
      .get<PublicStats>("/public/stats")
      .then((res) => setStats(res.data))
      .catch(() => setError(true));
    api
      .get<PublicArtikel[]>("/public/artikel", { params: { limit: 6 } })
      .then((res) => setArticles(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("atlet:change", loadData);
    socket.on("prestasi:change", loadData);
    socket.on("artikel:change", loadData);
    return () => {
      socket.off("atlet:change", loadData);
      socket.off("prestasi:change", loadData);
      socket.off("artikel:change", loadData);
    };
  }, [loadData]);

  const totalMedali = stats
    ? stats.medals.GOLD + stats.medals.SILVER + stats.medals.BRONZE
    : null;

  return (
    <div className="min-h-svh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-semibold leading-tight text-neutral-900">KONI Batam</p>
              <p className="text-xs leading-tight text-neutral-500">Sistem Informasi Manajemen Atlet</p>
            </div>
          </div>
          {user ? (
            <Link to={user.role === "ATLET" ? "/me" : "/dashboard"}>
              <Button>Buka Dashboard</Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button>Masuk</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-neutral-900 md:text-3xl">
            Komite Olahraga Nasional Indonesia &mdash; Batam
          </h1>
          <p className="mt-2 text-sm text-neutral-500 md:text-base">
            Data atlet, pelatih, cabang olahraga, dan prestasi KONI Batam.
          </p>
        </div>

        {error && (
          <Card className="mt-6 text-center text-sm text-danger">
            Gagal memuat statistik. Coba muat ulang halaman.
          </Card>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard label="Cabang Olahraga" value={stats?.caborCount ?? "—"} icon={Building2} />
          <StatCard label="Atlet Aktif" value={stats?.activeAtletCount ?? "—"} icon={Users} />
          <StatCard label="Pelatih" value={stats?.pelatihCount ?? "—"} icon={UserCog} />
          <StatCard label="Total Medali" value={totalMedali ?? "—"} icon={MedalIcon} />
        </div>

        {stats && (
          <Card className="mt-4 md:mt-6">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Perolehan Medali</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-gold">{stats.medals.GOLD}</p>
                <p className="text-xs text-neutral-500">Emas</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-silver">{stats.medals.SILVER}</p>
                <p className="text-xs text-neutral-500">Perak</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-bronze">{stats.medals.BRONZE}</p>
                <p className="text-xs text-neutral-500">Perunggu</p>
              </div>
            </div>
          </Card>
        )}
        {articles.length > 0 && (
          <section className="mt-8 md:mt-10">
            <h2 className="mb-4 text-base font-semibold text-neutral-900">Artikel &amp; Berita</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {articles.map((a) => (
                <Link
                  key={a.id}
                  to={`/artikel/${a.slug}`}
                  className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {a.coverImageUrl ? (
                    <img
                      src={resolveFileUrl(a.coverImageUrl)}
                      alt=""
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="h-36 bg-neutral-100" />
                  )}
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="text-sm font-medium text-neutral-900 group-hover:text-primary line-clamp-2">
                      {a.title}
                    </p>
                    {a.excerpt && (
                      <p className="text-xs text-neutral-500 line-clamp-2">{a.excerpt}</p>
                    )}
                    {a.publishedAt && (
                      <p className="mt-auto flex items-center gap-1 pt-2 text-xs text-neutral-400">
                        <CalendarDays size={12} />
                        {new Date(a.publishedAt).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
          <div className="flex flex-col gap-1 text-xs text-neutral-500 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-neutral-700">KONI Kota Batam</p>
              <p>Kompleks Ruko KBC (Kuningan Business Centre) Blok A5 No. 1, Kel. Belian, Kec. Batam Kota, Kota Batam, Kepulauan Riau</p>
            </div>
            <div className="mt-2 md:mt-0 md:text-right">
              <a href="mailto:konikotabatam2024@gmail.com" className="hover:text-primary">
                konikotabatam2024@gmail.com
              </a>
              <p className="mt-0.5">© {new Date().getFullYear()} KONI Kota Batam</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

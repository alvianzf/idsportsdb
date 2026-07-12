import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { Card } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";
import { PublicShell } from "./PublicShell";

interface PublicArtikel {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

/** Public "Berita" menu (revisi 2026-07-12): all published articles. */
export function BeritaPage() {
  const [articles, setArticles] = useState<PublicArtikel[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<PublicArtikel[]>("/public/artikel", { params: { limit: 60 } })
      .then((res) => setArticles(res.data))
      .catch(() => setError(true));
  }, []);

  return (
    <PublicShell title="Berita" description="Berita dan pengumuman KONI Batam">
      {error && <Card className="text-sm text-danger">Gagal memuat berita.</Card>}
      {!error && articles === null && <Card className="text-sm text-neutral-500">Memuat berita...</Card>}
      {articles !== null && articles.length === 0 && (
        <Card className="text-sm text-neutral-500">Belum ada berita dipublikasikan.</Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {articles?.map((a) => (
          <Link
            key={a.id}
            to={`/artikel/${a.slug}`}
            className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {a.coverImageUrl ? (
              <img src={resolveFileUrl(a.coverImageUrl)} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="h-36 bg-neutral-100" />
            )}
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="text-sm font-medium text-neutral-900 group-hover:text-primary line-clamp-2">{a.title}</p>
              {a.excerpt && <p className="text-xs text-neutral-500 line-clamp-2">{a.excerpt}</p>}
              {a.publishedAt && (
                <p className="mt-auto flex items-center gap-1 pt-2 text-xs text-neutral-400">
                  <CalendarDays size={12} />
                  {new Date(a.publishedAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}

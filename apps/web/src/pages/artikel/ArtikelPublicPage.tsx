import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, ArrowLeft } from "lucide-react";
import DOMPurify from "dompurify";
import { api, resolveFileUrl } from "../../lib/api";
import { Card } from "../../components/ui";
import { PublicShell } from "../public/PublicShell";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

/** Public article detail page — no auth required. See specs/011-artikel/spec.md §4. */
export function ArtikelPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    api
      .get<Article>(`/public/artikel/${slug}`)
      .then((res) => setArticle(res.data))
      .catch(() => setArticle(null));
  }, [slug]);

  if (article === undefined) {
    return (
      <PublicShell title="Berita" description="Memuat artikel...">
        <Card className="text-sm text-neutral-500">Memuat...</Card>
      </PublicShell>
    );
  }

  if (article === null) {
    return (
      <PublicShell title="Berita" description="Artikel tidak ditemukan.">
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <ArrowLeft size={16} /> Kembali ke beranda
        </Link>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={article.title}>
      <div className="space-y-6">
        <Link to="/berita" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <ArrowLeft size={16} /> Kembali ke Berita
        </Link>

        {article.coverImageUrl && (
          <img
            src={resolveFileUrl(article.coverImageUrl)}
            alt=""
            className="h-56 w-full rounded-lg object-cover md:h-72"
          />
        )}
        {article.publishedAt && (
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            <CalendarDays size={13} />
            {new Date(article.publishedAt).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
        {article.excerpt && (
          <p className="text-sm font-medium text-neutral-600">{article.excerpt}</p>
        )}
        <div
          className="prose-article text-sm text-neutral-700"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
        />
      </div>
    </PublicShell>
  );
}

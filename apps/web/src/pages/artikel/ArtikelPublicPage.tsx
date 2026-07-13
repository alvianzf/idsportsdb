import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, ArrowLeft } from "lucide-react";
import DOMPurify from "dompurify";
import { api, resolveFileUrl } from "../../lib/api";

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
      <div className="min-h-svh bg-neutral-50">
        <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-neutral-500">Memuat...</div>
      </div>
    );
  }

  if (article === null) {
    return (
      <div className="min-h-svh bg-neutral-50">
        <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-neutral-500">
          Artikel tidak ditemukan.{" "}
          <Link to="/" className="text-primary hover:underline">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
            <ArrowLeft size={16} /> KONI Batam
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">
        {article.coverImageUrl && (
          <img
            src={resolveFileUrl(article.coverImageUrl)}
            alt=""
            className="mb-6 h-56 w-full rounded-lg object-cover md:h-72"
          />
        )}
        <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">{article.title}</h1>
        {article.publishedAt && (
          <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
            <CalendarDays size={13} />
            {new Date(article.publishedAt).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
        {article.excerpt && (
          <p className="mt-3 text-sm font-medium text-neutral-600">{article.excerpt}</p>
        )}
        <div
          className="prose-article mt-4 text-sm text-neutral-700"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
        />
      </main>
    </div>
  );
}

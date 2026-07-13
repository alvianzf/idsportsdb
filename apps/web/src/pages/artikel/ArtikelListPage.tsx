import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Card, PageHeader, Button, Badge } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";

interface ArtikelRow {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; fullName: string };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

/** Module — Artikel/Berita CMS. See specs/011-artikel/spec.md. */
export function ArtikelListPage() {
  const [items, setItems] = useState<ArtikelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<ArtikelRow[]>("/artikel")
      .then((res) => setItems(res.data))
      .catch(() => setError("Gagal memuat data artikel."));
  }

  useEffect(load, []);

  async function handleTogglePublish(item: ArtikelRow) {
    try {
      await api.patch(`/artikel/${item.id}`, { published: !item.published });
      toast.success(item.published ? "Artikel diubah menjadi draf." : "Artikel berhasil diterbitkan.");
      load();
    } catch {
      toast.error("Gagal mengubah status artikel.");
    }
  }

  async function handleDelete(item: ArtikelRow) {
    if (!(await confirmAction({ text: `Hapus artikel "${item.title}"?` }))) return;
    try {
      await api.delete(`/artikel/${item.id}`);
      toast.success("Pengumuman berhasil dihapus.");
      load();
    } catch {
      toast.error("Gagal menghapus artikel.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Pengumuman"
        description="Konten yang ditampilkan pada halaman utama publik"
        actions={
          <Link to="/artikel/new">
            <Button>
              <Plus size={16} /> Tambah Pengumuman
            </Button>
          </Link>
        }
      />

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {items === null ? (
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : items.length === 0 ? (
        <Card className="text-sm text-neutral-500">Belum ada artikel.</Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="flex items-center gap-3">
              {item.coverImageUrl ? (
                <img
                  src={resolveFileUrl(item.coverImageUrl)}
                  alt=""
                  className="h-16 w-24 flex-shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-16 w-24 flex-shrink-0 rounded-md bg-neutral-100" />
              )}
              <div className="flex-1">
                <p className="font-medium text-neutral-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {item.author.fullName} ·{" "}
                  {item.publishedAt ? formatDate(item.publishedAt) : formatDate(item.createdAt)}
                </p>
              </div>
              <Badge tone={item.published ? "success" : "neutral"}>
                {item.published ? "Diterbitkan" : "Draf"}
              </Badge>
              <div className="flex items-center gap-1">
                <Button variant="outline" onClick={() => handleTogglePublish(item)}>
                  {item.published ? "Jadikan Draf" : "Terbitkan"}
                </Button>
                <Link to={`/artikel/${item.id}/edit`}>
                  <button aria-label="Ubah" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
                    <Pencil size={16} />
                  </button>
                </Link>
                <button
                  onClick={() => handleDelete(item)}
                  aria-label="Hapus"
                  className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

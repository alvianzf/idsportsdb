import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Card, PageHeader, Button, Field, Input, Textarea, RichTextEditor } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";

interface ArtikelForm {
  title: string;
  excerpt: string;
  content: string;
  published: boolean;
}

const empty: ArtikelForm = { title: "", excerpt: "", content: "", published: false };

function extractError(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "fieldErrors" in (data as object)) {
    const fieldErrors = (data as { fieldErrors: Record<string, string[]> }).fieldErrors;
    const first = Object.values(fieldErrors).flat()[0];
    if (first) return first;
  }
  return "Gagal menyimpan artikel.";
}

/** Module — create/edit Artikel. See specs/011-artikel/spec.md. */
export function ArtikelFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<ArtikelForm>(empty);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the article ID assigned after create so inline image uploads have a context
  const articleIdRef = useRef<string | undefined>(id);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/artikel/${id}`)
      .then((res) => {
        const a = res.data;
        setForm({
          title: a.title ?? "",
          excerpt: a.excerpt ?? "",
          content: a.content ?? "",
          published: a.published ?? false,
        });
        setCoverImageUrl(a.coverImageUrl ?? null);
      })
      .catch(() => setError("Gagal memuat data artikel."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleImageUpload(file: File): Promise<string> {
    const MAX_MB = 15;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Ukuran gambar terlalu besar (maks. ${MAX_MB} MB).`);
      throw new Error("file too large");
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<{ url: string }>("/artikel/images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return resolveFileUrl(res.data.url);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        "Gagal mengunggah gambar.";
      toast.error(msg);
      throw err;
    }
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setCoverFile(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.content || form.content === "<p></p>") {
      setError("Konten artikel tidak boleh kosong.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        excerpt: form.excerpt || undefined,
        content: form.content,
        published: form.published,
      };

      let articleId = id;
      if (isEdit) {
        await api.patch(`/artikel/${id}`, payload);
      } else {
        const res = await api.post("/artikel", payload);
        articleId = res.data.id;
        articleIdRef.current = articleId;
      }

      if (coverFile && articleId) {
        const formData = new FormData();
        formData.append("file", coverFile);
        await api.post(`/artikel/${articleId}/cover`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      toast.success(isEdit ? "Artikel berhasil diubah." : "Artikel berhasil ditambahkan.");
      navigate("/artikel");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card className="text-sm text-neutral-500">Memuat data...</Card>;
  }

  return (
    <div>
      <PageHeader title={isEdit ? "Ubah Artikel" : "Tambah Artikel"} />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Judul" required htmlFor="title">
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="Ringkasan" htmlFor="excerpt">
            <Textarea
              id="excerpt"
              className="min-h-16"
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            />
          </Field>
          <Field label="Konten" required>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              onImageUpload={handleImageUpload}
            />
          </Field>
          <Field label="Gambar Sampul" htmlFor="cover">
            {coverImageUrl && !coverFile && (
              <img src={resolveFileUrl(coverImageUrl)} alt="" className="mb-2 h-32 w-auto rounded-md object-cover" />
            )}
            <input id="cover" type="file" accept="image/*" onChange={handleCoverChange} className="text-sm" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
            />
            Terbitkan ke halaman utama
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Batal
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

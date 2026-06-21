import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Eye, Trash2, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { Card, PageHeader, Button, Field, Input, Textarea, RichTextEditor, Modal } from "../../components/ui";
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
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showArticlePreview, setShowArticlePreview] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  function applyFile(file: File) {
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setCoverPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) applyFile(file);
    event.target.value = "";
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) applyFile(file);
  }

  function removeCover() {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverImageUrl(null);
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

      toast.success(isEdit ? "Pengumuman berhasil diubah." : "Pengumuman berhasil ditambahkan.");
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
      <PageHeader
        title={isEdit ? "Ubah Pengumuman" : "Tambah Pengumuman"}
        actions={
          <Button type="button" variant="outline" onClick={() => setShowArticlePreview(true)}>
            <Eye size={16} /> Pratinjau
          </Button>
        }
      />
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
          <Field label="Gambar Sampul">
            {/* Show thumbnail when an image exists (uploaded or staged) */}
            {(coverPreview || coverImageUrl) ? (
              <div className="flex items-start gap-3">
                {/* Thumbnail with action overlay */}
                <div className="group relative h-36 w-56 shrink-0 overflow-hidden rounded-lg border border-neutral-200">
                  <img
                    src={coverPreview ?? resolveFileUrl(coverImageUrl!)}
                    alt="Gambar sampul"
                    className="h-full w-full object-cover"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Lihat gambar"
                      onClick={() => setShowPreviewModal(true)}
                      className="rounded-full bg-white/90 p-2 text-neutral-800 hover:bg-white"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      title="Hapus gambar"
                      onClick={removeCover}
                      className="rounded-full bg-white/90 p-2 text-danger hover:bg-white"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {/* Replace button */}
                <div className="flex flex-col gap-2 text-sm text-neutral-500">
                  <p className="font-medium text-neutral-700">Gambar terpilih</p>
                  {coverFile && <p className="text-xs">{coverFile.name}</p>}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-primary hover:underline"
                  >
                    Ganti gambar
                  </button>
                </div>
              </div>
            ) : (
              /* Drag-and-drop drop zone */
              <div
                ref={dropRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
                  isDragging
                    ? "border-primary bg-primary-50"
                    : "border-neutral-300 bg-neutral-50 hover:border-primary hover:bg-primary-50"
                }`}
              >
                <Upload size={28} className={isDragging ? "text-primary" : "text-neutral-400"} />
                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-700">
                    Seret & lepas gambar di sini
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">atau klik untuk memilih file</p>
                  <p className="mt-1 text-xs text-neutral-400">PNG, JPG, WebP — maks. 15 MB</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
            />
          </Field>

          {/* Full-size preview modal */}
          {showPreviewModal && (coverPreview || coverImageUrl) && (
            <Modal title="Gambar Sampul" onClose={() => setShowPreviewModal(false)}>
              <img
                src={coverPreview ?? resolveFileUrl(coverImageUrl!)}
                alt="Gambar sampul"
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
            </Modal>
          )}
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

      {/* Full-page article preview overlay */}
      {showArticlePreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-50">
          {/* Sticky preview header bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm font-medium text-neutral-500">Pratinjau Pengumuman</span>
            <button
              type="button"
              onClick={() => setShowArticlePreview(false)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              <X size={16} /> Tutup Pratinjau
            </button>
          </div>

          {/* Article rendered exactly as it appears on the public page */}
          <main className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">
            {(coverPreview || coverImageUrl) && (
              <img
                src={coverPreview ?? resolveFileUrl(coverImageUrl!)}
                alt=""
                className="mb-6 h-56 w-full rounded-lg object-cover md:h-72"
              />
            )}
            <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">
              {form.title || <span className="italic text-neutral-400">Judul belum diisi</span>}
            </h1>
            <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
              <CalendarDays size={13} />
              {new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            {form.excerpt && (
              <p className="mt-3 text-sm font-medium text-neutral-600">{form.excerpt}</p>
            )}
            {form.content ? (
              <div
                className="prose-article mt-4 text-sm text-neutral-700"
                dangerouslySetInnerHTML={{ __html: form.content }}
              />
            ) : (
              <p className="mt-4 italic text-sm text-neutral-400">Konten belum diisi.</p>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

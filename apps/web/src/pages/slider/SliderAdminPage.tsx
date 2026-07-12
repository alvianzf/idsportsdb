import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Info, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, Card, DropZone, Field, Input, Modal, PageHeader } from "../../components/ui";
import { api, resolveFileUrl } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";

interface Slide {
  id: string;
  imageUrl: string;
  caption: string | null;
  linkUrl: string | null;
  order: number;
  isActive: boolean;
}

const MAX_SIZE_MB = 5;

/** Landing-page slider manager (superadmin only). See specs/019-landing-slider. */
export function SliderAdminPage() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  function load() {
    api
      .get<Slide[]>("/slider")
      .then((res) => setSlides(res.data))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  function closeUpload() {
    setShowUpload(false);
    setFile(null);
    setCaption("");
  }

  async function handleUpload() {
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${MAX_SIZE_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (caption) form.append("caption", caption);
      await api.post("/slider", form);
      toast.success("Foto slider berhasil diunggah.");
      closeUpload();
      load();
    } catch {
      toast.error("Gagal mengunggah foto.");
    } finally {
      setUploading(false);
    }
  }

  async function patchSlide(id: string, data: Partial<Pick<Slide, "caption" | "isActive" | "order">>) {
    try {
      await api.patch(`/slider/${id}`, data);
      load();
    } catch {
      toast.error("Gagal menyimpan perubahan.");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!slides) return;
    const target = slides[index + dir];
    const current = slides[index];
    if (!target) return;
    await Promise.all([
      api.patch(`/slider/${current.id}`, { order: target.order }),
      api.patch(`/slider/${target.id}`, { order: current.order }),
    ]).catch(() => toast.error("Gagal mengubah urutan."));
    load();
  }

  async function handleDelete(slide: Slide) {
    const confirmed = await confirmAction({
      text: "Hapus foto slider ini?",
      danger: true,
      confirmText: "Hapus",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/slider/${slide.id}`);
      toast.success("Foto slider dihapus.");
      load();
    } catch {
      toast.error("Gagal menghapus foto.");
    }
  }

  return (
    <div>
      <PageHeader title="Slider Beranda" description="Kelola foto slider full-width di halaman depan" />

      {/* Upload + size guide */}
      <Card className="mb-4 space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-info-light/60 p-3 text-xs text-info">
          <Info size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Panduan ukuran foto</p>
            <p className="mt-0.5">
              Rekomendasi <strong>1920 × 640 px</strong> (rasio 3:1), format JPG/PNG/WebP, maksimal {MAX_SIZE_MB} MB.
              Foto ditampilkan selebar layar; bagian tengah selalu terlihat, tepi atas/bawah dapat terpotong di layar kecil.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload size={16} /> Unggah Foto
        </Button>
      </Card>

      {showUpload && (
        <Modal title="Unggah Foto Slider" onClose={closeUpload}>
          <div className="space-y-4">
            <DropZone
              accept="image/*"
              value={file}
              onChange={setFile}
              label="Seret & lepas foto di sini"
              sublabel={`JPG/PNG/WebP, rekomendasi 1920 × 640 px, maks. ${MAX_SIZE_MB} MB`}
            />
            <Field label="Keterangan (opsional)" htmlFor="slide-caption">
              <Input
                id="slide-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Teks yang tampil di atas foto"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeUpload}>
                Batal
              </Button>
              <Button disabled={!file || uploading} onClick={() => void handleUpload()}>
                <Upload size={16} /> {uploading ? "Mengunggah..." : "Unggah"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {error && <Card className="text-sm text-danger">Gagal memuat data slider.</Card>}
      {!error && slides === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
      {slides !== null && slides.length === 0 && (
        <Card className="text-sm text-neutral-500">Belum ada foto slider. Unggah foto pertama di atas.</Card>
      )}

      <div className="space-y-3">
        {slides?.map((s, i) => (
          <Card key={s.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <img
              src={resolveFileUrl(s.imageUrl)}
              alt={s.caption ?? ""}
              className="h-20 w-full rounded-md object-cover sm:w-60"
            />
            <div className="min-w-0 flex-1">
              <Input
                defaultValue={s.caption ?? ""}
                placeholder="Keterangan (opsional)"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (s.caption ?? "")) void patchSlide(s.id, { caption: v || null });
                }}
              />
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Tayang" : "Disembunyikan"}</Badge>
                <span className="text-xs text-neutral-400">Urutan {i + 1}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="outline" disabled={i === 0} onClick={() => move(i, -1)} title="Naikkan">
                <ArrowUp size={14} />
              </Button>
              <Button variant="outline" disabled={i === slides.length - 1} onClick={() => move(i, 1)} title="Turunkan">
                <ArrowDown size={14} />
              </Button>
              <Button
                variant="outline"
                onClick={() => patchSlide(s.id, { isActive: !s.isActive })}
                title={s.isActive ? "Sembunyikan" : "Tayangkan"}
              >
                {s.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
              <Button variant="danger" onClick={() => handleDelete(s)} title="Hapus">
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

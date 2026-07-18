import { useState } from "react";
import { CheckCircle2, Eye, FileText, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "@inasportdb/shared-types";
import { Card, Badge, DropZone, Modal } from "../../../components/ui";
import { api, resolveFileUrl } from "../../../lib/api";
import { confirmAction } from "../../../lib/confirm";
import type { AtletDocument } from "../types";

interface DokumenTabProps {
  atletId: string;
  documents: AtletDocument[];
  canManage: boolean;
  onChange: () => void;
}

export function DokumenTab({ atletId, documents, canManage, onChange }: DokumenTabProps) {
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Revisi 2026-07-18: uploads go through a modal with a drag & drop zone + preview.
  const [pendingFile, setPendingFile] = useState<{ type: DocumentType; file: File | null } | null>(null);

  const byType = Object.fromEntries(
    DOCUMENT_TYPES.map((t) => [t, documents.filter((d) => d.type === t)]),
  ) as Record<DocumentType, AtletDocument[]>;

  // Count distinct document types that have at least one upload
  const uploadedTypeCount = DOCUMENT_TYPES.filter((t) => (byType[t]?.length ?? 0) > 0).length;
  const totalCount = DOCUMENT_TYPES.length;

  async function confirmUpload() {
    if (!pendingFile?.file) return;
    const { type, file } = pendingFile;
    setPendingFile(null);
    setError(null);
    setUploading(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      await api.post(`/atlet/${atletId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${DOCUMENT_TYPE_LABELS[type]} berhasil diunggah.`);
      onChange();
    } catch {
      setError(`Gagal mengunggah ${DOCUMENT_TYPE_LABELS[type]}.`);
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(doc: AtletDocument) {
    if (!(await confirmAction({ text: `Hapus ${DOCUMENT_TYPE_LABELS[doc.type]}? File akan dihapus secara permanen.`, danger: true, confirmText: "Hapus" }))) return;
    try {
      await api.delete(`/atlet/${atletId}/documents/${doc.id}`);
      toast.success("Dokumen berhasil dihapus.");
      onChange();
    } catch {
      toast.error("Gagal menghapus dokumen.");
    }
  }

  async function openDocument(doc: AtletDocument) {
    // Open the tab synchronously (still inside the click gesture) so it isn't
    // popup-blocked; we point it at the blob URL once the fetch resolves.
    const win = window.open("", "_blank");
    try {
      // Resolve to absolute URL (avoids axios prepending /api/v1 to /uploads/... paths)
      const res = await api.get(resolveFileUrl(doc.fileUrl), { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      if (win) win.location.href = url;
      else window.open(url, "_blank"); // popup was blocked despite the sync open
      // Revoke once the viewer has loaded the blob; a generous fallback covers
      // slow PDFs and viewers that never fire `load`.
      win?.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      win?.close();
      toast.error("Gagal membuka dokumen.");
    }
  }

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Dokumen</h2>
        <Badge tone={uploadedTypeCount === totalCount ? "success" : "neutral"}>
          {uploadedTypeCount}/{totalCount} jenis diunggah
        </Badge>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <ul className="divide-y divide-neutral-100">
        {DOCUMENT_TYPES.map((type) => {
          const docs = byType[type];
          const hasDoc = docs.length > 0;

          return (
            <li key={type} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
              {/* Status indicator + label */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {hasDoc
                  ? <CheckCircle2 size={16} className="shrink-0 text-success" />
                  : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-neutral-300" />}
                <span className="text-sm font-medium text-neutral-800">
                  {DOCUMENT_TYPE_LABELS[type]}
                  {type === "SERTIFIKAT_PRESTASI" && docs.length > 1 && (
                    <span className="ml-1 text-xs font-normal text-neutral-400">({docs.length})</span>
                  )}
                </span>
              </div>

              {/* Uploaded files + actions */}
              <div className="flex flex-col gap-1 sm:items-end">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => openDocument(doc)}
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      {isImage(doc.fileUrl) ? <Eye size={14} /> : <FileText size={14} />}
                      Lihat berkas
                    </button>
                    <span className="text-xs text-neutral-400">
                      {new Date(doc.uploadedAt).toLocaleDateString("id-ID")}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(doc)}
                        aria-label="Hapus"
                        className="rounded p-0.5 text-neutral-400 hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {canManage && (
                  <button
                    type="button"
                    disabled={!!uploading}
                    onClick={() => setPendingFile({ type, file: null })}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      uploading === type
                        ? "border-neutral-200 text-neutral-400"
                        : hasDoc && type !== "SERTIFIKAT_PRESTASI"
                        ? "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        : "border-primary/40 text-primary hover:border-primary"
                    }`}
                  >
                    <Upload size={13} />
                    {uploading === type
                      ? "Mengunggah..."
                      : hasDoc && type !== "SERTIFIKAT_PRESTASI"
                      ? "Ganti"
                      : "Unggah"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Drag & drop upload modal with preview (revisi 2026-07-18) */}
      {pendingFile && (
        <Modal title={`Unggah ${DOCUMENT_TYPE_LABELS[pendingFile.type]}`} onClose={() => setPendingFile(null)}>
          <div className="space-y-4">
            <DropZone
              accept=".pdf,image/*"
              value={pendingFile.file}
              onChange={(file) => setPendingFile((p) => (p ? { ...p, file } : p))}
              sublabel="PDF atau gambar"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmUpload}
                disabled={!pendingFile.file}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Unggah
              </button>
              <button
                onClick={() => setPendingFile(null)}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-primary-50"
              >
                Batal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}

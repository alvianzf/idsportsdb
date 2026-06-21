import { useState, type ChangeEvent } from "react";
import { CheckCircle2, FileText, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "@inasportdb/shared-types";
import { Card, Badge } from "../../../components/ui";
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

  const byType = Object.fromEntries(
    DOCUMENT_TYPES.map((t) => [t, documents.filter((d) => d.type === t)]),
  ) as Record<DocumentType, AtletDocument[]>;

  const uploadedCount = documents.length;
  const totalCount = DOCUMENT_TYPES.length;

  async function handleUpload(type: DocumentType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
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
      event.target.value = "";
    }
  }

  async function handleDelete(docId: string, type: DocumentType) {
    if (!(await confirmAction({ text: `Hapus ${DOCUMENT_TYPE_LABELS[type]}?` }))) return;
    try {
      await api.delete(`/atlet/${atletId}/documents/${docId}`);
      toast.success("Dokumen berhasil dihapus.");
      onChange();
    } catch {
      toast.error("Gagal menghapus dokumen.");
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Dokumen</h2>
        <Badge tone={uploadedCount === totalCount ? "success" : "neutral"}>
          {uploadedCount}/{totalCount} diunggah
        </Badge>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <ul className="divide-y divide-neutral-100">
        {DOCUMENT_TYPES.map((type) => {
          const docs = byType[type];
          const hasDoc = docs.length > 0;

          return (
            <li key={type} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
              {/* Type label + status */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {hasDoc
                  ? <CheckCircle2 size={16} className="shrink-0 text-success" />
                  : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-neutral-300" />}
                <span className="text-sm font-medium text-neutral-800">
                  {DOCUMENT_TYPE_LABELS[type]}
                </span>
              </div>

              {/* Uploaded files */}
              <div className="flex flex-col gap-1 sm:items-end">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm">
                    <a
                      href={resolveFileUrl(doc.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <FileText size={14} />
                      Lihat berkas
                    </a>
                    <span className="text-xs text-neutral-400">
                      {new Date(doc.uploadedAt).toLocaleDateString("id-ID")}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(doc.id, type)}
                        aria-label="Hapus"
                        className="rounded p-0.5 text-neutral-400 hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Upload button — always show for admins (allows replacing / adding extra) */}
                {canManage && (
                  <label className="cursor-pointer">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                        uploading === type
                          ? "border-neutral-200 text-neutral-400"
                          : hasDoc
                          ? "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                          : "border-primary/40 text-primary hover:border-primary"
                      }`}
                    >
                      <Upload size={13} />
                      {uploading === type
                        ? "Mengunggah..."
                        : hasDoc
                        ? "Ganti"
                        : "Unggah"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={!!uploading}
                      onChange={(e) => handleUpload(type, e)}
                    />
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

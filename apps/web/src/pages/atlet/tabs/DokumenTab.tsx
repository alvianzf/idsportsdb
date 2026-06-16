import { useState, type ChangeEvent } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "@inasportdb/shared-types";
import { Card, Button, Select } from "../../../components/ui";
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
  const [type, setType] = useState<DocumentType>("KTP");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      await api.post(`/atlet/${atletId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Dokumen berhasil diunggah.");
      onChange();
    } catch {
      setError("Gagal mengunggah dokumen.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDelete(docId: string) {
    if (!(await confirmAction({ text: "Hapus dokumen ini?" }))) return;
    try {
      await api.delete(`/atlet/${atletId}/documents/${docId}`);
      toast.success("Dokumen berhasil dihapus.");
      onChange();
    } catch {
      toast.error("Gagal menghapus dokumen.");
    }
  }

  return (
    <Card className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 p-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Jenis Dokumen</label>
            <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)} className="w-auto">
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <label>
            <Button variant="outline" type="button" disabled={uploading} className="cursor-pointer">
              <Upload size={16} /> {uploading ? "Mengunggah..." : "Unggah Berkas"}
            </Button>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">Belum ada dokumen.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <a
                href={resolveFileUrl(doc.fileUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <FileText size={16} />
                {DOCUMENT_TYPE_LABELS[doc.type]}
              </a>
              <div className="flex items-center gap-3 text-neutral-500">
                <span className="text-xs">{new Date(doc.uploadedAt).toLocaleDateString("id-ID")}</span>
                {canManage && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    aria-label="Hapus"
                    className="rounded-md p-1.5 hover:bg-neutral-100"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

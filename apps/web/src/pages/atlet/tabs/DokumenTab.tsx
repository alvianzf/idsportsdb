import { useState } from "react";
import { ChevronDown, ChevronRight, Download, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import {
  DOCUMENT_TYPE_LABELS,
  SUPPORTING_DOCUMENT_TYPES,
  type DocumentType,
} from "@inasportdb/shared-types";
import { Card, Badge, Button, DropZone, Modal } from "../../../components/ui";
import { api, resolveEmbedUrl, resolveFileUrl } from "../../../lib/api";
import { confirmAction } from "../../../lib/confirm";
import type { AtletDocument } from "../types";

interface DokumenTabProps {
  atletId: string;
  documents: AtletDocument[];
  canManage: boolean;
  onChange: () => void;
}

function isImage(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
}

/**
 * Revisi 2026-07-27: atlet only upload dokumen pendukung (pas foto + sertifikat
 * prestasi) — identity papers were dropped. Each file is an expandable row that
 * previews inline, matching the prestasi document rows.
 */
export function DokumenTab({ atletId, documents, canManage, onChange }: DokumenTabProps) {
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [pendingFile, setPendingFile] = useState<{ type: DocumentType; file: File | null } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const supporting = documents.filter((d) =>
    SUPPORTING_DOCUMENT_TYPES.includes(d.type as (typeof SUPPORTING_DOCUMENT_TYPES)[number]),
  );
  // Identity papers uploaded before the revisi — read-only, kept visible so
  // nothing silently disappears from an existing record.
  const legacy = documents.filter(
    (d) => !SUPPORTING_DOCUMENT_TYPES.includes(d.type as (typeof SUPPORTING_DOCUMENT_TYPES)[number]),
  );

  async function confirmUpload() {
    if (!pendingFile?.file) return;
    const { type, file } = pendingFile;
    setPendingFile(null);
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
      toast.error(`Gagal mengunggah ${DOCUMENT_TYPE_LABELS[type]}.`);
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(doc: AtletDocument) {
    if (
      !(await confirmAction({
        text: `Hapus ${DOCUMENT_TYPE_LABELS[doc.type]}? File akan dihapus secara permanen.`,
        danger: true,
        confirmText: "Hapus",
      }))
    )
      return;
    try {
      await api.delete(`/atlet/${atletId}/documents/${doc.id}`);
      toast.success("Dokumen berhasil dihapus.");
      onChange();
    } catch {
      toast.error("Gagal menghapus dokumen.");
    }
  }

  function renderRow(doc: AtletDocument, opts: { canDelete: boolean }) {
    const expanded = expandedId === doc.id;
    const image = isImage(doc.fileUrl);
    return (
      <li key={doc.id} className="border-b border-neutral-100 last:border-b-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
          <button
            type="button"
            onClick={() => setExpandedId(expanded ? null : doc.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-neutral-800 hover:text-primary"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown size={15} className="shrink-0 text-neutral-400" />
            ) : (
              <ChevronRight size={15} className="shrink-0 text-neutral-400" />
            )}
            {image ? (
              <ImageIcon size={15} className="shrink-0 text-neutral-400" />
            ) : (
              <FileText size={15} className="shrink-0 text-neutral-400" />
            )}
            <span className="truncate font-medium">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
          </button>
          <span className="shrink-0 text-xs text-neutral-400">
            {new Date(doc.uploadedAt).toLocaleDateString("id-ID")}
          </span>
          <a
            href={resolveFileUrl(doc.fileUrl)}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded p-1 text-neutral-400 hover:text-primary"
            aria-label="Unduh"
            title="Unduh"
          >
            <Download size={14} />
          </a>
          {opts.canDelete && (
            <button
              onClick={() => handleDelete(doc)}
              aria-label="Hapus"
              className="shrink-0 rounded p-1 text-neutral-400 hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {expanded && (
          <div className="mb-3 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {image ? (
              <img
                src={resolveFileUrl(doc.fileUrl)}
                alt={DOCUMENT_TYPE_LABELS[doc.type]}
                className="max-h-96 w-full object-contain"
              />
            ) : (
              <iframe
                src={resolveEmbedUrl(doc.fileUrl)}
                title={DOCUMENT_TYPE_LABELS[doc.type]}
                className="h-96 w-full"
              />
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Dokumen Pendukung</h2>
          <p className="text-xs text-neutral-500">Pas foto dan sertifikat prestasi</p>
        </div>
        <Badge tone={supporting.length > 0 ? "success" : "neutral"}>{supporting.length} berkas</Badge>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {SUPPORTING_DOCUMENT_TYPES.map((type) => (
            <Button
              key={type}
              variant="outline"
              disabled={!!uploading}
              onClick={() => setPendingFile({ type, file: null })}
            >
              <Upload size={15} />
              {uploading === type ? "Mengunggah..." : `Unggah ${DOCUMENT_TYPE_LABELS[type]}`}
            </Button>
          ))}
        </div>
      )}

      {supporting.length === 0 ? (
        <p className="text-sm text-neutral-500">Belum ada dokumen pendukung.</p>
      ) : (
        <ul>{supporting.map((doc) => renderRow(doc, { canDelete: canManage }))}</ul>
      )}

      {legacy.length > 0 && (
        <div className="pt-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Dokumen lama
          </h3>
          <ul className="mt-1">{legacy.map((doc) => renderRow(doc, { canDelete: canManage }))}</ul>
        </div>
      )}

      {pendingFile && (
        <Modal
          title={`Unggah ${DOCUMENT_TYPE_LABELS[pendingFile.type]}`}
          onClose={() => setPendingFile(null)}
        >
          <div className="space-y-4">
            <DropZone
              accept=".pdf,image/*"
              value={pendingFile.file}
              onChange={(file) => setPendingFile((p) => (p ? { ...p, file } : p))}
              sublabel="PDF atau gambar"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={confirmUpload} disabled={!pendingFile.file}>
                Unggah
              </Button>
              <Button variant="outline" onClick={() => setPendingFile(null)}>
                Batal
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}

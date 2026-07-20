import { useState } from "react";
import { Download, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { Button, DropZone, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { UNSCOPED_VIEW_ROLES } from "@inasportdb/shared-types";

interface ImportPreview {
  rows: { row: number; namaLengkap: string; nik: string; cabor: string; jenisKelamin: string; statusAtlet: string; error?: string }[];
  valid: number;
  invalid: number;
  summary?: { issue: string; count: number; examples: string[] }[];
}

interface ImportResult {
  imported: number;
  rejected: { row: number; error: string }[];
}

interface Props {
  /** Fired as soon as an import succeeds, so a list behind the modal can reload. */
  onImported?: (imported: number) => void;
  /**
   * Fired when the whole flow is over — the upload modal was cancelled, or the
   * result summary was dismissed. `imported` is 0 when nothing was written, so
   * callers can navigate only on success and otherwise stay put.
   */
  onClose: (imported: number) => void;
}

/**
 * Bulk athlete import (Revisi 2026-07-12), shared by the Data Atlet list and the
 * dashboard quick action. The dashboard opens it in place and only routes to the
 * list once an import actually succeeds — so a failed upload leaves you where
 * you were instead of dumping you on the list page.
 */
export function AtletImportModal({ onImported, onClose }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const isUnscopedAdmin = role && UNSCOPED_VIEW_ROLES.includes(role);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Sample files so users don't upload the wrong format.
  async function handleTemplateDownload(format: "xlsx" | "csv") {
    try {
      const res = await api.get("/atlet/import/template", { params: { format }, responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `template-impor-atlet.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh template.");
    }
  }

  // Parse+validate on the server without writing, to preview before upload.
  async function handleFileChange(next: File | null) {
    setFile(next);
    setPreview(null);
    if (!next) return;
    setPreviewing(true);
    try {
      const form = new FormData();
      form.append("file", next);
      const res = await api.post<ImportPreview>("/atlet/import?dryRun=1", form);
      setPreview(res.data);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(typeof message === "string" ? message : "Gagal membaca berkas.");
      setFile(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit() {
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<ImportResult>("/atlet/import", form);
      // Swap the upload modal for the result summary; the flow ends when that
      // summary is dismissed, so the counts aren't lost to an instant redirect.
      setFile(null);
      setPreview(null);
      setResult(res.data);
      if (res.data.imported > 0) onImported?.(res.data.imported);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(typeof message === "string" ? message : "Gagal mengimpor berkas.");
    } finally {
      setImporting(false);
    }
  }

  if (result) {
    return (
      <Modal title="Hasil Impor" onClose={() => onClose(result.imported)}>
        <div className="space-y-3 text-sm">
          <p className="text-neutral-700">
            <span className="font-semibold text-success">{result.imported}</span> atlet berhasil diimpor
            {result.rejected.length > 0 && (
              <>
                , <span className="font-semibold text-danger">{result.rejected.length}</span> baris ditolak
              </>
            )}
            .
          </p>
          {result.rejected.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
              {result.rejected.map((r) => (
                <li key={`${r.row}-${r.error}`}>
                  <span className="font-medium">Baris {r.row}:</span> {r.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Impor Data Atlet" onClose={() => onClose(0)}>
      <div className="space-y-4 text-sm">
        <div className="space-y-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
          <p className="font-semibold text-neutral-800">Ketentuan berkas</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Format <strong>Excel (.xlsx)</strong> atau <strong>CSV</strong>, maksimal 50 MB.</li>
            <li>Baris pertama harus berupa judul kolom. Kolom yang dikenali:
              Nomor Induk, Nomor Registrasi, Nama Lengkap, NIK, Jenis Kelamin,
              Cabang Olahraga, Status, Alamat, Kecamatan, Nomor HP, Email,
              Pendidikan Terakhir, Pekerjaan.</li>
            <li>Wajib diisi: Nomor Registrasi, Nama Lengkap, NIK (16 digit), Jenis Kelamin, Alamat. Nomor Induk opsional.</li>
            <li>Jenis Kelamin: <strong>L</strong> atau <strong>P</strong>; Status: <strong>Aktif</strong> / <strong>Tidak Aktif</strong> (kosong = Aktif).</li>
            {isUnscopedAdmin ? (
              <li>Kolom Cabang Olahraga diisi <strong>nama cabor</strong> persis seperti terdaftar.</li>
            ) : (
              <li>Seluruh baris diimpor ke cabor Anda — kolom Cabang Olahraga diabaikan.</li>
            )}
            <li>Semua baris harus valid. Jika ada baris bermasalah (mis. nama cabor salah), seluruh impor ditolak — perbaiki dahulu lalu unggah ulang.</li>
          </ul>
          <div className="space-y-2 pt-2">
            <p>Gunakan template agar format tidak salah:</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="px-4 py-1.5" onClick={() => void handleTemplateDownload("xlsx")}>
                <Download size={16} /> Excel
              </Button>
              <Button variant="outline" className="px-4 py-1.5" onClick={() => void handleTemplateDownload("csv")}>
                <Download size={16} /> CSV
              </Button>
            </div>
          </div>
        </div>

        <DropZone
          accept=".xlsx,.csv"
          value={file}
          onChange={(f) => void handleFileChange(f)}
          label="Seret & lepas berkas Excel/CSV di sini"
          sublabel=".xlsx atau .csv, maks. 50 MB"
        />

        {previewing && <p className="text-xs text-neutral-500">Membaca berkas...</p>}

        {preview && (
          <div>
            <p className="mb-2 text-xs text-neutral-600">
              Pratinjau: <span className="font-semibold text-success">{preview.valid} baris valid</span>
              {preview.invalid > 0 && (
                <>
                  , <span className="font-semibold text-danger">{preview.invalid} bermasalah</span> — perbaiki dahulu, impor akan ditolak
                </>
              )}
            </p>
            {preview.summary && preview.summary.length > 0 && (
              <div className="mb-2 space-y-2 rounded-lg border border-danger/30 bg-danger-light/30 p-3 text-xs">
                <p className="font-semibold text-danger">Yang perlu diperbaiki:</p>
                <ul className="space-y-2">
                  {preview.summary.map((s) => (
                    <li key={s.issue}>
                      <span className="font-medium text-neutral-800">{s.issue}</span>{" "}
                      <span className="text-danger">({s.count} baris)</span>
                      <ul className="mt-0.5 list-disc pl-5 text-neutral-600">
                        {s.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="max-h-56 overflow-auto rounded-lg border border-neutral-200">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="sticky top-0 bg-neutral-50">
                  <tr className="text-left text-neutral-500">
                    <th className="px-2.5 py-2">Baris</th>
                    <th className="px-2.5 py-2">Nama</th>
                    <th className="px-2.5 py-2">NIK</th>
                    <th className="px-2.5 py-2">Cabor</th>
                    <th className="px-2.5 py-2">JK</th>
                    <th className="px-2.5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {preview.rows.map((r) => (
                    <tr key={r.row} className={r.error ? "bg-danger-light/40" : undefined}>
                      <td className="px-2.5 py-1.5 text-neutral-500">{r.row}</td>
                      <td className="px-2.5 py-1.5 font-medium text-neutral-800">
                        {r.namaLengkap || "-"}
                        {r.error && <p className="font-normal text-danger">{r.error}</p>}
                      </td>
                      <td className="px-2.5 py-1.5 text-neutral-600">{r.nik || "-"}</td>
                      <td className="px-2.5 py-1.5 text-neutral-600">{r.cabor || "-"}</td>
                      <td className="px-2.5 py-1.5 text-neutral-600">{r.jenisKelamin || "-"}</td>
                      <td className="px-2.5 py-1.5 text-neutral-600">{r.statusAtlet || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            disabled={!file || importing || previewing || !preview || preview.invalid > 0 || preview.valid === 0}
            onClick={() => void handleSubmit()}
          >
            <Upload size={16} />
            {importing
              ? "Mengimpor..."
              : preview
                ? preview.invalid > 0
                  ? "Perbaiki baris bermasalah"
                  : `Impor ${preview.valid} Baris`
                : "Impor"}
          </Button>
          <Button variant="outline" onClick={() => onClose(0)}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

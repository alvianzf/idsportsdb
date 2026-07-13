import { useEffect, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import toast from "react-hot-toast";
import { Card, PageHeader, Button } from "../../components/ui";
import { api } from "../../lib/api";

export interface ReportColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
}

interface ReportPageProps<T> {
  title: string;
  description: string;
  endpoint: string;
  params: Record<string, string | number | undefined>;
  filters?: ReactNode;
  columns: ReportColumn<T>[];
  filenameBase: string;
}

async function downloadFile(endpoint: string, params: Record<string, unknown>, format: "pdf" | "excel", filename: string) {
  const res = await api.get(endpoint, { params: { ...params, format }, responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${format === "pdf" ? "pdf" : "xlsx"}`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Shared layout for Module H report pages. See specs/009-pelaporan/spec.md. */
export function ReportPage<T>({ title, description, endpoint, params, filters, columns, filenameBase }: ReportPageProps<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    api
      .get<T[]>(endpoint, { params: { ...params, format: "json" } })
      .then((res) => {
        if (!cancelled) setRows(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat data laporan.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(params)]);

  async function handleDownload(format: "pdf" | "excel") {
    setDownloading(format);
    try {
      await downloadFile(endpoint, params, format, filenameBase);
    } catch {
      toast.error("Gagal mengunduh laporan.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleDownload("pdf")} disabled={downloading !== null}>
              <Download size={16} /> {downloading === "pdf" ? "Mengunduh..." : "PDF"}
            </Button>
            <Button variant="outline" onClick={() => handleDownload("excel")} disabled={downloading !== null}>
              <Download size={16} /> {downloading === "excel" ? "Mengunduh..." : "Excel"}
            </Button>
          </div>
        }
      />

      {filters && <Card className="mb-4 flex flex-col gap-2">{filters}</Card>}

      {error && <Card className="text-sm text-danger">{error}</Card>}

      {rows === null ? (
        <Card className="text-sm text-neutral-500">Memuat data...</Card>
      ) : rows.length === 0 ? (
        <Card className="text-sm text-neutral-500">Tidak ada data.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-neutral-500">
              <tr>
                {columns.map((col) => (
                  <th key={col.header} className="px-4 py-3 font-medium">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50">
                  {columns.map((col) => (
                    <td key={col.header} className="px-4 py-3 text-neutral-600">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

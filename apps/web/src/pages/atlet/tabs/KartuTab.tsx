import { useEffect, useState } from "react";
import { CreditCard, Download, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Card, Button, Badge } from "../../../components/ui";
import { api } from "../../../lib/api";
import { confirmAction } from "../../../lib/confirm";

interface AtletCard {
  id: string;
  cardCode: string;
  qrPayloadUrl: string;
  issuedAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

interface KartuTabProps {
  atletId: string;
  canManage: boolean;
  self?: boolean;
}

export function KartuTab({ atletId, canManage, self = false }: KartuTabProps) {
  const [card, setCard] = useState<AtletCard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const getPath = self ? "/atlet/me/card" : `/atlet/${atletId}/card`;
  const canIssue = canManage || self;

  function load() {
    api
      .get<AtletCard | null>(getPath)
      .then((res) => setCard(res.data))
      .catch(() => setError("Gagal memuat data kartu."));
  }

  useEffect(load, [atletId, getPath]);

  async function handleIssue() {
    setError(null);
    setBusy(true);
    try {
      await api.post(getPath, {});
      toast.success("Kartu berhasil dibuat.");
      load();
    } catch {
      setError("Gagal membuat kartu.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!card) return;
    if (!(await confirmAction({ text: "Cabut kartu ini? Kartu tidak akan bisa digunakan lagi." }))) return;
    setBusy(true);
    try {
      await api.post(`/atlet/${atletId}/card/${card.id}/revoke`, {});
      toast.success("Kartu berhasil dicabut.");
      load();
    } catch {
      toast.error("Gagal mencabut kartu.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(format: "pdf" | "png") {
    if (!card) return;
    setBusy(true);
    try {
      const res = await api.get(`/atlet/${atletId}/card/${card.id}/download`, {
        params: { format },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "pdf" ? "kartu-atlet.pdf" : "kartu-atlet-qr.png";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Gagal mengunduh kartu.");
    } finally {
      setBusy(false);
    }
  }

  if (card === undefined) return <Card className="text-sm text-neutral-500">Memuat data...</Card>;

  return (
    <Card className="space-y-4">
      <h2 className="text-sm font-semibold text-neutral-900">Kartu Atlet Digital</h2>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!card ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-neutral-500">Atlet belum memiliki kartu digital.</p>
          {canIssue && (
            <Button onClick={handleIssue} disabled={busy}>
              <CreditCard size={16} /> {busy ? "Memproses..." : "Buat Kartu"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={card.isRevoked ? "danger" : "success"}>
              {card.isRevoked ? "Dicabut" : "Aktif"}
            </Badge>
            {card.expiresAt && (
              <Badge tone="neutral">Berlaku hingga {formatDate(card.expiresAt)}</Badge>
            )}
          </div>

          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Kode Kartu</dt>
              <dd className="font-medium text-neutral-900">{card.cardCode}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Diterbitkan</dt>
              <dd className="font-medium text-neutral-900">{formatDate(card.issuedAt)}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-neutral-500">Tautan Verifikasi</dt>
              <dd className="break-all font-medium text-primary">{card.qrPayloadUrl}</dd>
            </div>
          </dl>

          {!card.isRevoked && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => handleDownload("pdf")} disabled={busy}>
                <Download size={16} /> Unduh PDF
              </Button>
              <Button variant="outline" onClick={() => handleDownload("png")} disabled={busy}>
                <Download size={16} /> Unduh QR
              </Button>
              {canManage && !self && (
                <Button variant="danger" onClick={handleRevoke} disabled={busy}>
                  <XCircle size={16} /> Cabut Kartu
                </Button>
              )}
            </div>
          )}

          {card.isRevoked && canIssue && (
            <Button onClick={handleIssue} disabled={busy}>
              <CreditCard size={16} /> {busy ? "Memproses..." : "Terbitkan Kartu Baru"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

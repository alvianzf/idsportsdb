import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { ATHLETE_STATUS_LABELS, type AthleteStatus } from "@inasportdb/shared-types";
import { Card, Badge } from "../components/ui";
import { api, resolveFileUrl } from "../lib/api";

type VerifyReason = "NOT_FOUND" | "REVOKED" | "EXPIRED" | "INACTIVE";

interface VerifyResult {
  valid: boolean;
  reason?: VerifyReason;
  athlete?: {
    namaLengkap: string;
    nomorIndukAtlet: string;
    cabangOlahraga: { id: string; nama: string };
    fotoUrl: string | null;
    statusAtlet: AthleteStatus;
  };
}

const REASON_LABELS: Record<VerifyReason, string> = {
  NOT_FOUND: "Kartu tidak ditemukan.",
  REVOKED: "Kartu telah dicabut.",
  EXPIRED: "Kartu telah habis masa berlaku.",
  INACTIVE: "Status atlet tidak aktif.",
};

/**
 * Public card authenticity check (Module I). No auth required.
 * See specs/010-kartu-atlet-digital/spec.md.
 */
export function VerifyCardPage() {
  const { cardCode } = useParams<{ cardCode: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!cardCode) return;
    api
      .get<VerifyResult>(`/cards/verify/${cardCode}`)
      .then((res) => setResult(res.data))
      .catch((err) => {
        if (err.response?.data) {
          setResult(err.response.data);
        } else {
          setError(true);
        }
      });
  }, [cardCode]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 p-4">
      <Card className="w-full max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-lg font-bold text-white">
          K
        </div>
        <h1 className="text-lg font-semibold text-neutral-900">Verifikasi Kartu Atlet</h1>
        <p className="mt-1 break-all text-xs text-neutral-400">{cardCode}</p>

        <div className="mt-4">
          {result === null && !error && <Badge tone="neutral">Memeriksa...</Badge>}
          {error && <Badge tone="danger">Gagal memeriksa kartu.</Badge>}

          {result && !result.valid && (
            <div className="flex flex-col items-center gap-2 text-danger">
              <XCircle size={40} />
              <p className="text-sm font-medium">{REASON_LABELS[result.reason ?? "NOT_FOUND"]}</p>
            </div>
          )}

          {result?.valid && result.athlete && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 size={40} className="text-success" />
              {result.athlete.fotoUrl && (
                <img
                  src={resolveFileUrl(result.athlete.fotoUrl)}
                  alt={result.athlete.namaLengkap}
                  className="h-24 w-24 rounded-md object-cover"
                />
              )}
              <div className="text-left">
                <p className="text-base font-semibold text-neutral-900">{result.athlete.namaLengkap}</p>
                <p className="text-sm text-neutral-500">{result.athlete.nomorIndukAtlet}</p>
                <p className="text-sm text-neutral-500">{result.athlete.cabangOlahraga.nama}</p>
                <div className="mt-2">
                  <Badge tone="success">{ATHLETE_STATUS_LABELS[result.athlete.statusAtlet]}</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

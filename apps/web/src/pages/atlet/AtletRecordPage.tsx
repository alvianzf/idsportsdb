import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Maximize2, User } from "lucide-react";
import { KoniQR } from "../../components/ui";
import {
  ATHLETE_LEVEL_LABELS,
  ATHLETE_STATUS_LABELS,
  COMPETITION_LEVEL_LABELS,
  GENDER_LABELS,
  MEDAL_LABELS,
  type AthleteStatus,
  type CompetitionLevel,
  type Medal,
} from "@inasportdb/shared-types";
import { Badge, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuthenticatedUrl } from "../../hooks/useAuthenticatedUrl";
import { useAuthStore } from "../../store/authStore";
import type { AtletDetail } from "./types";

interface AtletCard {
  id: string;
  cardCode: string;
  qrPayloadUrl: string;
  issuedAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
}

interface Prestasi {
  id: string;
  namaKejuaraan: string;
  tingkatKejuaraan: CompetitionLevel;
  tahun: number;
  medali: Medal;
  peringkat: number | null;
}

const STATUS_TONE: Record<AthleteStatus, "success" | "danger" | "warning" | "info" | "neutral"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  INJURED: "danger",
  TRAINING_CAMP: "info",
  TRANSFERRED: "warning",
};

const MEDAL_TONE: Record<Medal, "gold" | "silver" | "bronze" | "neutral"> = {
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
  NONE: "neutral",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function AtletRecordPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [atlet, setAtlet] = useState<AtletDetail | null>(null);
  const [card, setCard] = useState<AtletCard | null | undefined>(undefined);
  const [prestasi, setPrestasi] = useState<Prestasi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const isAthleteViewingOwn = user.role === "ATLET" && user.athleteId === id;
  const cardPath = isAthleteViewingOwn ? "/atlet/me/card" : `/atlet/${id}/card`;

  useEffect(() => {
    if (!id) return;
    api
      .get<AtletDetail>(`/atlet/${id}`)
      .then((r) => setAtlet(r.data))
      .catch(() => setError("Gagal memuat data atlet."));
    api
      .get<AtletCard | null>(cardPath)
      .then((r) => setCard(r.data))
      .catch(() => setCard(null));
    api
      .get<Prestasi[]>(`/atlet/${id}/prestasi`)
      .then((r) => setPrestasi(r.data))
      .catch(() => setPrestasi([]));
  }, [id, cardPath]);

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!atlet) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-neutral-400">
        Memuat data...
      </div>
    );
  }

  const activeCard = card && !card.isRevoked ? card : null;
  const fotoSrc = useAuthenticatedUrl(atlet.fotoUrl);

  return (
    <div className="min-h-svh bg-neutral-100">
      {/* Header bar */}
      <div className="sticky top-0 z-10 flex h-14 items-center border-b border-neutral-200 bg-white px-4 pt-[env(safe-area-inset-top)] shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={18} />
          Kembali
        </button>
      </div>

      {/* Non-active banner — shown when accessed via QR scan for an inactive athlete */}
      {atlet.statusAtlet !== "ACTIVE" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-700">
          Kartu valid namun status atlet saat ini: {ATHLETE_STATUS_LABELS[atlet.statusAtlet]}
        </div>
      )}

      {/* Profile card */}
      <div className="bg-white">
        {/* Name & cabor */}
        <div className="px-4 pt-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{atlet.namaLengkap}</h1>
          <p className="mt-1 text-sm font-medium text-neutral-500">{atlet.cabangOlahraga.nama}</p>
          {atlet.caborTambahan.length > 0 && (
            <p className="mt-0.5 text-xs text-neutral-400">
              + {atlet.caborTambahan.map((c) => c.cabangOlahraga.nama).join(", ")}
            </p>
          )}
        </div>

        {/* Circular photo */}
        <div className="mt-5 flex justify-center">
          {fotoSrc ? (
            <img
              src={fotoSrc}
              alt={atlet.namaLengkap}
              className="h-40 w-40 rounded-full border-4 border-neutral-100 object-cover shadow"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-neutral-100 bg-neutral-200 shadow">
              <User size={64} className="text-neutral-400" />
            </div>
          )}
        </div>

        {/* Status badges */}
        <div className="mt-4 flex flex-wrap justify-center gap-2 px-4">
          <Badge tone={STATUS_TONE[atlet.statusAtlet]}>{ATHLETE_STATUS_LABELS[atlet.statusAtlet]}</Badge>
          <Badge tone="neutral">{ATHLETE_LEVEL_LABELS[atlet.tingkatAtlet]}</Badge>
          <Badge tone="info">{GENDER_LABELS[atlet.jenisKelamin]}</Badge>
        </div>

        {/* QR code under badges */}
        {activeCard ? (
          <div className="mt-4 flex flex-col items-center gap-2 pb-5">
            <button
              onClick={() => setShowQrModal(true)}
              title="Perbesar QR"
              className="rounded-xl border border-neutral-200 p-2 shadow-sm transition hover:border-primary"
            >
              <KoniQR value={activeCard.qrPayloadUrl} size={88} />
            </button>
            <p className="text-xs text-neutral-400">Ketuk untuk memperbesar</p>
          </div>
        ) : (
          <div className="pb-5" />
        )}
      </div>

      {/* Key stats */}
      <div className="mt-3 grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-3">
        <StatCell label="Nomor Induk" value={atlet.nomorIndukAtlet} />
        <StatCell label="Nomor Registrasi" value={atlet.nomorRegistrasi} />
        <StatCell label="Tanggal Lahir" value={formatDate(atlet.tanggalLahir)} />
        <StatCell label="Tempat Lahir" value={atlet.tempatLahir} />
        <StatCell label="Kecamatan" value={atlet.kecamatan ?? "-"} />
        <StatCell label="Nomor HP" value={atlet.nomorHp ?? "-"} />
        {activeCard && (
          <div className="col-span-2 flex items-center justify-between bg-white px-4 py-3 sm:col-span-1">
            <div>
              <p className="text-xs text-neutral-500">Kartu Atlet</p>
              <p className="mt-0.5 text-sm font-semibold text-neutral-900">Aktif</p>
            </div>
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-medium text-primary hover:border-primary transition"
            >
              <Maximize2 size={12} /> Lihat QR
            </button>
          </div>
        )}
      </div>

      {/* Prestasi */}
      <div className="mt-3 bg-white">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Prestasi</h2>
        </div>
        {!prestasi ? (
          <p className="px-4 py-3 text-sm text-neutral-400">Memuat...</p>
        ) : prestasi.length === 0 ? (
          <p className="px-4 py-3 text-sm text-neutral-400">Belum ada data prestasi.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {prestasi.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{p.namaKejuaraan}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {COMPETITION_LEVEL_LABELS[p.tingkatKejuaraan]} · {p.tahun}
                    {p.peringkat ? ` · Peringkat ${p.peringkat}` : ""}
                  </p>
                </div>
                <Badge tone={MEDAL_TONE[p.medali]}>{MEDAL_LABELS[p.medali]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Full info */}
      <div className="mt-3 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Informasi Lengkap
          </h2>
        </div>
        <dl className="divide-y divide-neutral-100">
          <InfoRow label="NIK" value={atlet.nik} />
          <InfoRow label="Alamat" value={atlet.alamat} />
          <InfoRow label="Email" value={atlet.email ?? "-"} />
          <InfoRow label="Pendidikan" value={atlet.pendidikan ?? "-"} />
          <InfoRow label="Pekerjaan" value={atlet.pekerjaan ?? "-"} />
          {atlet.caborTambahan.length > 0 && (
            <InfoRow
              label="Cabor Tambahan"
              value={atlet.caborTambahan.map((c) => c.cabangOlahraga.nama).join(", ")}
            />
          )}
        </dl>
      </div>

      {showQrModal && activeCard && (
        <Modal title="QR Kartu Atlet" onClose={() => setShowQrModal(false)}>
          <div className="flex flex-col items-center gap-4 py-2">
            <KoniQR value={activeCard.qrPayloadUrl} size={240} />
            <p className="text-sm font-semibold text-neutral-800">{atlet.namaLengkap}</p>
            <p className="max-w-xs break-all text-center text-xs text-neutral-500">
              {activeCard.qrPayloadUrl}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-neutral-900 leading-snug">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-sm">
      <dt className="w-32 shrink-0 text-xs text-neutral-500">{label}</dt>
      <dd className="text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

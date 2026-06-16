import {
  ATHLETE_LEVEL_LABELS,
  ATHLETE_STATUS_LABELS,
  GENDER_LABELS,
  type AthleteStatus,
} from "@inasportdb/shared-types";
import { Card, Badge } from "../../../components/ui";
import type { AtletDetail } from "../types";

const STATUS_TONE: Record<AthleteStatus, "success" | "danger" | "warning" | "info" | "neutral"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  INJURED: "danger",
  TRAINING_CAMP: "info",
  TRANSFERRED: "warning",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

export function BiodataTab({ atlet }: { atlet: AtletDetail }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[atlet.statusAtlet]}>{ATHLETE_STATUS_LABELS[atlet.statusAtlet]}</Badge>
        <Badge tone="neutral">{ATHLETE_LEVEL_LABELS[atlet.tingkatAtlet]}</Badge>
        <Badge tone="info">{atlet.cabangOlahraga.nama}</Badge>
        {atlet.caborTambahan.map((c) => (
          <Badge key={c.id} tone="neutral">
            +{c.cabangOlahraga.nama}
          </Badge>
        ))}
      </div>

      {atlet.caborTambahan.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">Cabang Olahraga Tambahan</p>
          <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 text-sm">
            {atlet.caborTambahan.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2">
                <span className="font-medium text-neutral-900 w-32 shrink-0">{c.cabangOlahraga.nama}</span>
                <span className="text-neutral-500">
                  No. Induk:{" "}
                  <span className="text-neutral-800">{c.nomorIndukAtlet ?? "-"}</span>
                </span>
                <span className="text-neutral-500">
                  No. Registrasi:{" "}
                  <span className="text-neutral-800">{c.nomorRegistrasi ?? "-"}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Nomor Induk Atlet</dt>
          <dd className="font-medium text-neutral-900">{atlet.nomorIndukAtlet}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Nomor Registrasi</dt>
          <dd className="font-medium text-neutral-900">{atlet.nomorRegistrasi}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">NIK</dt>
          <dd className="font-medium text-neutral-900">{atlet.nik}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Jenis Kelamin</dt>
          <dd className="font-medium text-neutral-900">{GENDER_LABELS[atlet.jenisKelamin]}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Tempat, Tanggal Lahir</dt>
          <dd className="font-medium text-neutral-900">
            {atlet.tempatLahir}, {formatDate(atlet.tanggalLahir)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Kecamatan</dt>
          <dd className="font-medium text-neutral-900">{atlet.kecamatan ?? "-"}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-neutral-500">Alamat</dt>
          <dd className="font-medium text-neutral-900">{atlet.alamat}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Nomor HP</dt>
          <dd className="font-medium text-neutral-900">{atlet.nomorHp ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Email</dt>
          <dd className="font-medium text-neutral-900">{atlet.email ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Pendidikan</dt>
          <dd className="font-medium text-neutral-900">{atlet.pendidikan ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Pekerjaan</dt>
          <dd className="font-medium text-neutral-900">{atlet.pekerjaan ?? "-"}</dd>
        </div>
      </dl>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Users, UserCog } from "lucide-react";
import { Card, SearchInput } from "../../components/ui";
import { api, resolveEmbedUrl, resolveFileUrl } from "../../lib/api";
import { PublicShell } from "./PublicShell";
import { PengurusViews, type Pengurus } from "../cabor/PengurusOrgViews";

interface PublicCabor {
  id: string;
  nama: string;
  organisasiNasional: string | null;
  logoOrganisasiUrl: string | null;
  jumlahAtlet: number;
  jumlahPengurus: number;
}

/** Public Cabor menu (spec 018 §5) — list of cabang olahraga; picking one opens
 * its pengurus in read-only Tabel/Struktur views. */
export function CaborPublicPage() {
  const { id } = useParams<{ id: string }>();
  return id ? <CaborPengurusDetail caborId={id} /> : <CaborList />;
}

function CaborList() {
  const [cabor, setCabor] = useState<PublicCabor[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get<{ items: PublicCabor[] }>("/public/cabor")
      .then((res) => setCabor(res.data.items))
      .catch(() => setError(true));
  }, []);

  const filtered = (cabor ?? []).filter((c) => c.nama.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <PublicShell title="Cabang Olahraga" description="Daftar cabang olahraga binaan KONI Batam">
      {error && <Card className="text-sm text-danger">Gagal memuat data cabang olahraga.</Card>}
      {!error && cabor === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
      {cabor !== null && (
        <div className="space-y-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            suggestions={cabor.map((c) => c.nama)}
            placeholder="Cari cabang olahraga..."
          />

          {filtered.length === 0 ? (
            <Card className="text-sm text-neutral-500">
              {cabor.length === 0 ? "Belum ada cabang olahraga." : "Cabang olahraga tidak ditemukan."}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <Link key={c.id} to={`/cabang-olahraga/${c.id}`} className="block">
                  <Card className="h-full transition-colors hover:border-primary">
                    <div className="flex items-start gap-3">
                      {c.logoOrganisasiUrl ? (
                        <img src={c.logoOrganisasiUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-sm font-bold text-primary">
                          {c.nama.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-900">{c.nama}</p>
                        {c.organisasiNasional && (
                          <p className="truncate text-xs text-neutral-500">{c.organisasiNasional}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Users size={14} /> {c.jumlahAtlet} atlet
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCog size={14} /> {c.jumlahPengurus} pengurus
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </PublicShell>
  );
}

interface CaborDetail {
  cabor: { nama: string; organisasiNasional: string | null };
  pengurus: Pengurus[];
  dokumen: PublicDokumen[];
}

interface PublicDokumen {
  id: string;
  jenis: string;
  nomorDokumen: string | null;
  tanggalDokumen: string | null;
  fileUrl: string;
}

function CaborPengurusDetail({ caborId }: { caborId: string }) {
  const [data, setData] = useState<CaborDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CaborDetail>(`/public/cabor/${caborId}/pengurus`)
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err?.response?.status === 404 ? "Cabang olahraga tidak ditemukan." : "Gagal memuat data pengurus."),
      );
  }, [caborId]);

  return (
    <PublicShell
      title={data?.cabor.nama ?? "Pengurus Cabor"}
      description={data?.cabor.organisasiNasional ?? "Struktur pengurus cabang olahraga"}
    >
      <div className="space-y-4">
        <Link to="/cabang-olahraga" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <ArrowLeft size={16} /> Kembali ke daftar cabor
        </Link>

        {error && <Card className="text-sm text-danger">{error}</Card>}
        {!error && data === null && <Card className="text-sm text-neutral-500">Memuat data...</Card>}
        {data !== null && data.pengurus.length === 0 && (
          <Card className="text-sm text-neutral-500">Belum ada pengurus terdaftar.</Card>
        )}
        {data !== null && data.pengurus.length > 0 && (
          <PengurusViews
            pengurus={data.pengurus}
            canManage={false}
            onEdit={() => undefined}
            onDelete={() => undefined}
            onReassign={() => undefined}
            onSwap={() => undefined}
            publicMode
          />
        )}

        {data !== null && data.dokumen.length > 0 && <DokumenSection dokumen={data.dokumen} />}
      </div>
    </PublicShell>
  );
}

/** SK & official decrees, with the selected document previewed inline as a PDF. */
function DokumenSection({ dokumen }: { dokumen: PublicDokumen[] }) {
  const [selected, setSelected] = useState(dokumen[0]);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-neutral-900">SK & Dokumen Resmi</h2>

      <ul className="mt-2 divide-y divide-neutral-100">
        {dokumen.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
            <button
              type="button"
              onClick={() => setSelected(doc)}
              className="flex min-w-0 items-center gap-2 text-left"
            >
              <FileText size={15} className={`shrink-0 ${doc.id === selected.id ? "text-primary" : "text-neutral-400"}`} />
              <span className={`truncate text-sm ${doc.id === selected.id ? "font-semibold text-primary" : "text-neutral-700"}`}>
                {doc.jenis}
              </span>
              {doc.nomorDokumen && <span className="shrink-0 text-xs text-neutral-500">No. {doc.nomorDokumen}</span>}
            </button>
            <a
              href={resolveFileUrl(doc.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Buka
            </a>
          </li>
        ))}
      </ul>

      {/* Inline preview. Uploaded files carry their extension, so the browser
          picks the right renderer; no extension check here because older rows
          were stored without one. */}
      <iframe
          key={selected.id}
          src={resolveEmbedUrl(selected.fileUrl)}
          title={selected.jenis}
          className="mt-3 h-[60vh] w-full rounded-md border border-neutral-200"
        />
    </Card>
  );
}

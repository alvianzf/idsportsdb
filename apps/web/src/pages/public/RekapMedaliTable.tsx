import { Link } from "react-router-dom";
import { Medal as MedalIcon } from "lucide-react";
import { DataTable, type Column } from "../../components/ui";
import type { CaborBackLink } from "./CaborPublicPage";

export interface RekapMedaliRow {
  cabangOlahragaId: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

// Plain colored text — public pages carry no badge pills (client note 2026-07-12).
const MEDAL_TEXT = {
  GOLD: "text-gold",
  SILVER: "text-silver",
  BRONZE: "text-bronze",
} as const;

function MedalHeader({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <MedalIcon size={13} className={tone} /> {label}
    </span>
  );
}

/** Shared per-cabor medal tally table — used by the public Data page's Medali
 * tab and the /medali hub page. See specs/024-rekap-medali-tally/spec.md.
 * `linkState` is carried on each cabor link so its detail page's back button
 * can name the page the visitor came from. */
export function RekapMedaliTable({
  rows,
  emptyMessage = "Belum ada perolehan medali.",
  linkState,
}: {
  rows: RekapMedaliRow[];
  emptyMessage?: string;
  linkState?: CaborBackLink;
}) {
  const columns: Column<RekapMedaliRow>[] = [
    {
      key: "nama",
      label: "Cabang Olahraga",
      mobile: true,
      render: (r) => (
        <Link to={`/cabang-olahraga/${r.cabangOlahragaId}`} state={linkState} className="font-medium text-primary hover:underline">
          {r.nama}
        </Link>
      ),
    },
    {
      key: "gold",
      label: <MedalHeader tone={MEDAL_TEXT.GOLD} label="Emas" />,
      mobile: true,
      render: (r) => <span className={MEDAL_TEXT.GOLD}>{r.gold}</span>,
    },
    {
      key: "silver",
      label: <MedalHeader tone={MEDAL_TEXT.SILVER} label="Perak" />,
      render: (r) => <span className={MEDAL_TEXT.SILVER}>{r.silver}</span>,
    },
    {
      key: "bronze",
      label: <MedalHeader tone={MEDAL_TEXT.BRONZE} label="Perunggu" />,
      render: (r) => <span className={MEDAL_TEXT.BRONZE}>{r.bronze}</span>,
    },
    { key: "total", label: "Total", mobile: true, render: (r) => <span className="font-semibold text-neutral-900">{r.total}</span> },
  ];

  return <DataTable columns={columns} rows={rows.map((r) => ({ ...r, id: r.cabangOlahragaId }))} emptyMessage={emptyMessage} />;
}

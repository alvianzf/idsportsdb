import { useEffect, useState, Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Trash2 } from "lucide-react";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Show on mobile. Columns without mobile:true are collapsed on small screens. */
  mobile?: boolean;
  className?: string;
  getValue?: (row: T) => string | number | Date | null | undefined;
  render: (row: T) => ReactNode;
}

export interface BulkAction {
  label: string;
  icon?: React.ElementType;
  variant?: "danger" | "outline";
  onClick: (ids: string[]) => void;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  bulkActions?: BulkAction[];
  emptyMessage?: string;
  className?: string;
  /** When provided, clicking any row toggles an expanded detail panel below it. */
  expandContent?: (row: T) => React.ReactNode;
}

type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={13} className="text-neutral-400" />;
  return dir === "asc"
    ? <ChevronUp size={13} className="text-primary" />
    : <ChevronDown size={13} className="text-primary" />;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  bulkActions,
  emptyMessage = "Tidak ada data.",
  className,
  expandContent,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Drop stale selection whenever the rows change (paging/filtering/search/reload),
  // so a bulk action can never act on ids the user can no longer see.
  useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  const hasBulk = Boolean(bulkActions?.length);
  const hasExpand = Boolean(expandContent);
  // Columns with mobile:true always show; others collapse on mobile
  const mobileHas = columns.some((c) => c.mobile);
  const collapsedCols = mobileHas ? columns.filter((c) => !c.mobile) : [];
  const hasCollapsed = collapsedCols.length > 0;

  function handleSort(col: Column<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
    setSelected(new Set());
  }

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.getValue) return 0;
    const va = col.getValue(a) ?? "";
    const vb = col.getValue(b) ?? "";
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const allIds = sorted.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = !allSelected && allIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected];

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-500">{emptyMessage}</p>;
  }

  return (
    <div className={`@container ${className ?? ""}`}>
      {hasBulk && selectedIds.length > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="text-sm text-neutral-600">{selectedIds.length} dipilih</span>
          <div className="ml-auto flex gap-2">
            {bulkActions!.map((action) => {
              const Icon = action.icon ?? Trash2;
              return (
                <Button
                  key={action.label}
                  variant={action.variant ?? "outline"}
                  onClick={() => { action.onClick(selectedIds); setSelected(new Set()); }}
                >
                  <Icon size={14} /> {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              {hasBulk && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-neutral-300 accent-primary"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  className={[
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap",
                    col.sortable ? "cursor-pointer select-none hover:text-neutral-700" : "",
                    // hide on mobile if not marked mobile:true (and page has mobile columns defined)
                    mobileHas && !col.mobile ? "hidden @lg:table-cell" : "",
                    col.className ?? "",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                  </span>
                </th>
              ))}
              {/* Expand chevron column — mobile only (for collapsed cols) */}
              {hasCollapsed && <th className="w-8 px-2 py-3 @lg:hidden" />}
              {/* Expand chevron column — all screens (for expandContent) */}
              {hasExpand && <th className="w-8 px-2 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {sorted.map((row) => (
              <Fragment key={row.id}>
                <tr
                  onClick={hasExpand ? () => setExpandedRow((r) => r === row.id ? null : row.id) : undefined}
                  className={`transition-colors ${hasExpand ? "cursor-pointer" : ""} ${selected.has(row.id) ? "bg-primary-50" : "hover:bg-neutral-50"}`}
                >
                  {hasBulk && (
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 cursor-pointer rounded border-neutral-300 accent-primary"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        "px-4 py-3",
                        mobileHas && !col.mobile ? "hidden @lg:table-cell" : "",
                        col.className ?? "",
                      ].join(" ")}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {hasCollapsed && (
                    <td className="w-8 px-2 py-3 @lg:hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedRow((r) => r === row.id ? null : row.id); }}
                        className="rounded p-1 text-neutral-400 hover:text-neutral-700"
                        aria-label="Lihat detail"
                      >
                        {expandedRow === row.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  )}
                  {hasExpand && (
                    <td className="w-8 px-3 py-3 text-neutral-400">
                      {expandedRow === row.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                  )}
                </tr>

                {/* Expanded detail row — mobile only (for collapsed columns) */}
                {hasCollapsed && expandedRow === row.id && (
                  <tr key={`${row.id}-expanded`} className="@lg:hidden bg-neutral-50">
                    <td colSpan={columns.length + (hasBulk ? 2 : 1)} className="px-4 py-3">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {collapsedCols.map((col) => (
                          <div key={col.key}>
                            <dt className="text-xs text-neutral-400">{col.label}</dt>
                            <dd className="mt-0.5 text-neutral-800">{col.render(row)}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}

                {/* Expanded content row — all screens (for expandContent prop) */}
                {hasExpand && expandedRow === row.id && (
                  <tr key={`${row.id}-expand`} className="bg-neutral-50">
                    <td colSpan={columns.length + (hasBulk ? 2 : 1) + 1} className="px-4 pb-4 pt-0">
                      {expandContent!(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

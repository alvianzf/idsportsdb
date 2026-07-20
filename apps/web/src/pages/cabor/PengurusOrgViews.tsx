import { useState, type DragEvent, type RefObject, useRef } from "react";
import { LayoutGrid, GitBranch, Table as TableIcon, Pencil, Trash2 } from "lucide-react";
import { jabatanLabel, type JabatanPengurus } from "@inasportdb/shared-types";
import { Badge } from "../../components/ui";
import { DataTable, type Column } from "../../components/ui/DataTable";

export interface Pengurus {
  id: string;
  namaPengurus: string;
  jabatan: JabatanPengurus;
  /** Unit name for bidang/seksi roles; free-text label when jabatan is LAINNYA. */
  bidang?: string | null;
  masaBaktiMulai: string;
  masaBaktiAkhir: string;
  /** Absent on the public payload (spec 018 §5) — never sent to anonymous visitors. */
  kontak?: string | null;
  reportsToId: string | null;
}

interface PengurusNode extends Pengurus {
  children: PengurusNode[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" });
}

function isActive(p: Pengurus) {
  return new Date(p.masaBaktiAkhir) >= new Date();
}

/** Builds a forest from the flat list; items whose `reportsToId` is missing/invalid become roots. */
function buildTree(items: Pengurus[]): PengurusNode[] {
  const byId = new Map<string, PengurusNode>(items.map((p) => [p.id, { ...p, children: [] }]));
  const roots: PengurusNode[] = [];

  for (const node of byId.values()) {
    const parent = node.reportsToId ? byId.get(node.reportsToId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

interface ViewProps {
  pengurus: Pengurus[];
  canManage: boolean;
  onEdit: (p: Pengurus) => void;
  onDelete: (p: Pengurus) => void;
  onReassign: (id: string, reportsToId: string | null) => void;
  onSwap: (idA: string, idB: string) => void;
  /** Public variant (spec 018 §5): Tabel + Struktur only, and no kontak column. */
  publicMode?: boolean;
}

export function PengurusViews({ pengurus, canManage, onEdit, onDelete, onReassign, onSwap, publicMode = false }: ViewProps) {
  const [view, setView] = useState<"table" | "card" | "chart">("table");
  const nameById = new Map(pengurus.map((p) => [p.id, p.namaPengurus]));
  const tree = buildTree(pengurus);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md border border-neutral-200 p-1">
        <ViewButton active={view === "table"} onClick={() => setView("table")} icon={TableIcon} label="Tabel" />
        {!publicMode && (
          <ViewButton active={view === "card"} onClick={() => setView("card")} icon={LayoutGrid} label="Kartu" />
        )}
        <ViewButton active={view === "chart"} onClick={() => setView("chart")} icon={GitBranch} label="Struktur" />
      </div>

      {view === "table" && (
        <TableView
          pengurus={pengurus}
          nameById={nameById}
          canManage={canManage}
          onEdit={onEdit}
          onDelete={onDelete}
          publicMode={publicMode}
        />
      )}
      {view === "card" && (
        <CardView tree={tree} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
      )}
      {view === "chart" && (
        <ChartView tree={tree} canManage={canManage} onEdit={onEdit} onDelete={onDelete} onReassign={onReassign} onSwap={onSwap} />
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof TableIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-primary text-white" : "text-neutral-600 hover:bg-primary-50 hover:text-primary"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function ActionButtons({ p, canManage, onEdit, onDelete }: { p: Pengurus; canManage: boolean; onEdit: (p: Pengurus) => void; onDelete: (p: Pengurus) => void }) {
  if (!canManage) return null;
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onEdit(p)} aria-label="Ubah" className="rounded-md p-1.5 text-neutral-500 hover:bg-primary-50 hover:text-primary">
        <Pencil size={14} />
      </button>
      <button onClick={() => onDelete(p)} aria-label="Hapus" className="rounded-md p-1.5 text-neutral-500 hover:bg-primary-50 hover:text-primary">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function TableView({
  pengurus,
  nameById,
  canManage,
  onEdit,
  onDelete,
  publicMode,
}: {
  pengurus: Pengurus[];
  nameById: Map<string, string>;
  canManage: boolean;
  onEdit: (p: Pengurus) => void;
  onDelete: (p: Pengurus) => void;
  publicMode: boolean;
}) {
  const columns: Column<Pengurus>[] = [
    {
      key: "namaPengurus",
      label: "Nama",
      mobile: true,
      sortable: true,
      getValue: (p) => p.namaPengurus,
      render: (p) => <span className="font-medium text-neutral-900">{p.namaPengurus}</span>,
    },
    {
      key: "jabatan",
      label: "Jabatan",
      mobile: true,
      sortable: true,
      getValue: (p) => jabatanLabel(p.jabatan, p.bidang),
      render: (p) => <span className="text-neutral-600">{jabatanLabel(p.jabatan, p.bidang)}</span>,
    },
    {
      key: "status",
      label: "Status",
      mobile: true,
      render: (p) => (
        <Badge tone={isActive(p) ? "success" : "neutral"}>{isActive(p) ? "Aktif" : "Selesai"}</Badge>
      ),
    },
    // Desktop-only (collapse on mobile)
    {
      key: "reportsTo",
      label: "Melapor Kepada",
      getValue: (p) => (p.reportsToId ? nameById.get(p.reportsToId) ?? "" : ""),
      render: (p) => (
        <span className="text-neutral-600">
          {p.reportsToId ? nameById.get(p.reportsToId) ?? "-" : "-"}
        </span>
      ),
    },
    {
      key: "masaBakti",
      label: "Masa Bakti",
      sortable: true,
      getValue: (p) => p.masaBaktiMulai,
      render: (p) => (
        <span className="whitespace-nowrap text-xs text-neutral-500">
          {formatDate(p.masaBaktiMulai)} – {formatDate(p.masaBaktiAkhir)}
        </span>
      ),
    },
    ...(publicMode
      ? []
      : [
          {
            key: "kontak",
            label: "Kontak",
            render: (p: Pengurus) => <span className="text-neutral-600">{p.kontak ?? "-"}</span>,
          },
        ]),
    ...(canManage
      ? [
          {
            key: "aksi",
            label: "Aksi",
            render: (p: Pengurus) => (
              <ActionButtons p={p} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      rows={pengurus}
      emptyMessage="Belum ada data pengurus."
    />
  );
}

function CardView({
  tree,
  canManage,
  onEdit,
  onDelete,
  depth = 0,
}: {
  tree: PengurusNode[];
  canManage: boolean;
  onEdit: (p: Pengurus) => void;
  onDelete: (p: Pengurus) => void;
  depth?: number;
}) {
  return (
    <div className="space-y-2">
      {tree.map((node) => (
        <div key={node.id}>
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3"
            style={{ marginLeft: depth * 20 }}
          >
            <div>
              <p className="font-medium text-neutral-900">{node.namaPengurus}</p>
              <p className="text-sm text-neutral-500">{jabatanLabel(node.jabatan, node.bidang)}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {formatDate(node.masaBaktiMulai)} - {formatDate(node.masaBaktiAkhir)}
                {node.kontak ? ` · ${node.kontak}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={isActive(node) ? "success" : "neutral"}>{isActive(node) ? "Aktif" : "Selesai"}</Badge>
              <ActionButtons p={node} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </div>
          {node.children.length > 0 && (
            <div className="mt-2">
              <CardView tree={node.children} canManage={canManage} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChartNode({
  node,
  canManage,
  onEdit,
  onDelete,
  onReassign,
  onSwap,
}: {
  node: PengurusNode;
  canManage: boolean;
  onEdit: (p: Pengurus) => void;
  onDelete: (p: Pengurus) => void;
  onReassign: (id: string, reportsToId: string | null) => void;
  onSwap: (idA: string, idB: string) => void;
}) {
  const [dragZone, setDragZone] = useState<"top" | "bottom" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function getZone(e: DragEvent<HTMLDivElement>): "top" | "bottom" {
    const rect = (cardRef as RefObject<HTMLDivElement>).current!.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!canManage) return;
    e.preventDefault();
    setDragZone(getZone(e));
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!cardRef.current?.contains(e.relatedTarget as Node)) setDragZone(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    if (!canManage) return;
    e.preventDefault();
    const zone = getZone(e);
    setDragZone(null);
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === node.id) return;
    if (zone === "top") {
      onSwap(draggedId, node.id);
    } else {
      // Make dragged node report to this node
      onReassign(draggedId, node.id);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        ref={cardRef}
        draggable={canManage}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative min-w-[180px] rounded-md border-2 bg-white p-2 text-center text-sm shadow-sm transition-colors ${
          dragZone ? "border-primary" : "border-neutral-200"
        } ${canManage ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        {/* Split drop-zone overlay — visible while dragging over this card */}
        {dragZone && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col overflow-hidden rounded-md">
            {/* Top half — swap/replace */}
            <div
              className={`flex flex-1 items-center justify-center text-xs font-bold transition-colors ${
                dragZone === "top"
                  ? "bg-primary/80 text-white"
                  : "bg-black/40 text-white/70"
              }`}
            >
              ↕ Tukar Posisi
            </div>
            {/* Divider */}
            <div className="h-px bg-white/40" />
            {/* Bottom half — make direct report */}
            <div
              className={`flex flex-1 items-center justify-center text-xs font-bold transition-colors ${
                dragZone === "bottom"
                  ? "bg-primary/80 text-white"
                  : "bg-black/40 text-white/70"
              }`}
            >
              ↓ Jadikan Bawahan
            </div>
          </div>
        )}

        <p className="font-medium text-neutral-900">{node.namaPengurus}</p>
        <p className="text-xs text-neutral-500">{jabatanLabel(node.jabatan, node.bidang)}</p>
        {canManage && (
          <div className="mt-1 flex justify-center gap-1">
            <ActionButtons p={node} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <>
          <div className="h-4 w-px bg-neutral-300" />
          <div className="flex gap-6 border-t border-neutral-300 pt-4">
            {node.children.map((child) => (
              <ChartNode key={child.id} node={child} canManage={canManage} onEdit={onEdit} onDelete={onDelete} onReassign={onReassign} onSwap={onSwap} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChartView({
  tree,
  canManage,
  onEdit,
  onDelete,
  onReassign,
  onSwap,
}: {
  tree: PengurusNode[];
  canManage: boolean;
  onEdit: (p: Pengurus) => void;
  onDelete: (p: Pengurus) => void;
  onReassign: (id: string, reportsToId: string | null) => void;
  onSwap: (idA: string, idB: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    if (!canManage) return;
    e.preventDefault();
    setDragOver(false);
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId) onReassign(draggedId, null);
  }

  return (
    <div className="space-y-2">
      {canManage && (
        <p className="text-xs text-neutral-400">
          Seret kartu ke kotak lain: lepas di <strong>bagian atas</strong> kartu untuk tukar posisi, atau di <strong>bagian bawah</strong> untuk menjadikannya bawahan langsung. Lepas ke area kosong di bawah untuk menjadikannya paling atas.
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-neutral-100 p-4">
        <div className="flex min-w-fit justify-center gap-8">
          {tree.map((node) => (
            <ChartNode key={node.id} node={node} canManage={canManage} onEdit={onEdit} onDelete={onDelete} onReassign={onReassign} onSwap={onSwap} />
          ))}
        </div>
      </div>
      {canManage && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-md border-2 border-dashed p-3 text-center text-xs transition-colors ${
            dragOver ? "border-primary bg-primary-50 text-primary" : "border-neutral-200 text-neutral-400"
          }`}
        >
          Lepaskan di sini untuk menjadikan paling atas (tidak melapor kepada siapa pun)
        </div>
      )}
    </div>
  );
}

import { useState, type DragEvent, type RefObject, useRef } from "react";
import { LayoutGrid, GitBranch, Table as TableIcon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "../../components/ui";

export interface Pengurus {
  id: string;
  namaPengurus: string;
  jabatan: string;
  masaBaktiMulai: string;
  masaBaktiAkhir: string;
  kontak: string | null;
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
}

export function PengurusViews({ pengurus, canManage, onEdit, onDelete, onReassign, onSwap }: ViewProps) {
  const [view, setView] = useState<"table" | "card" | "chart">("table");
  const nameById = new Map(pengurus.map((p) => [p.id, p.namaPengurus]));
  const tree = buildTree(pengurus);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md border border-neutral-200 p-1">
        <ViewButton active={view === "table"} onClick={() => setView("table")} icon={TableIcon} label="Tabel" />
        <ViewButton active={view === "card"} onClick={() => setView("card")} icon={LayoutGrid} label="Kartu" />
        <ViewButton active={view === "chart"} onClick={() => setView("chart")} icon={GitBranch} label="Struktur" />
      </div>

      {view === "table" && (
        <TableView pengurus={pengurus} nameById={nameById} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
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
        active ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-100"
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
      <button onClick={() => onEdit(p)} aria-label="Ubah" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
        <Pencil size={14} />
      </button>
      <button onClick={() => onDelete(p)} aria-label="Hapus" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
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
}: {
  pengurus: Pengurus[];
  nameById: Map<string, string>;
  canManage: boolean;
  onEdit: (p: Pengurus) => void;
  onDelete: (p: Pengurus) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 text-left text-neutral-500">
          <tr>
            <th className="px-2 py-2 font-medium">Nama</th>
            <th className="px-2 py-2 font-medium">Jabatan</th>
            <th className="px-2 py-2 font-medium">Melapor Kepada</th>
            <th className="px-2 py-2 font-medium">Masa Bakti</th>
            <th className="px-2 py-2 font-medium">Status</th>
            {canManage && <th className="px-2 py-2 font-medium">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {pengurus.map((p) => (
            <tr key={p.id}>
              <td className="px-2 py-2 font-medium text-neutral-900">{p.namaPengurus}</td>
              <td className="px-2 py-2 text-neutral-600">{p.jabatan}</td>
              <td className="px-2 py-2 text-neutral-600">
                {p.reportsToId ? nameById.get(p.reportsToId) ?? "-" : "-"}
              </td>
              <td className="px-2 py-2 text-xs text-neutral-500">
                {formatDate(p.masaBaktiMulai)} - {formatDate(p.masaBaktiAkhir)}
              </td>
              <td className="px-2 py-2">
                <Badge tone={isActive(p) ? "success" : "neutral"}>{isActive(p) ? "Aktif" : "Selesai"}</Badge>
              </td>
              {canManage && (
                <td className="px-2 py-2">
                  <ActionButtons p={p} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
              <p className="text-sm text-neutral-500">{node.jabatan}</p>
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
        <p className="text-xs text-neutral-500">{node.jabatan}</p>
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

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface KontingenTotals {
  id: string;
  nama: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const OTHER_COLOR = "#a3a3a3";

const CHARTS: { key: "total" | "gold" | "silver" | "bronze"; label: string }[] = [
  { key: "total", label: "Total Medali" },
  { key: "gold", label: "Emas" },
  { key: "silver", label: "Perak" },
  { key: "bronze", label: "Perunggu" },
];

/** One donut — same shape/styling as MedalCompositionChart (the filtered,
 * per-kontingen view) — but each slice is a kontingen instead of a medal
 * color. No slice carries a permanent label; a tooltip names it only on
 * hover (or tap, for touch), same as MedalCompositionChart's tooltip. */
function OnePie({ data, colorOf }: { data: { id: string; nama: string; value: number }[]; colorOf: (id: string) => string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sum = data.reduce((s, d) => s + d.value, 0);
  const slices = data.filter((d) => d.value > 0).map((d) => ({ ...d, color: colorOf(d.id) }));

  if (sum === 0) {
    return <p className="flex h-full items-center justify-center text-center text-xs text-neutral-500">Belum ada medali.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="nama"
          cx="50%"
          cy="50%"
          innerRadius="45%"
          outerRadius="80%"
          paddingAngle={2}
          isAnimationActive
          animationDuration={600}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          {slices.map((d, i) => (
            <Cell
              key={d.id}
              fill={d.color}
              stroke="#fff"
              strokeWidth={1.5}
              opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => {
            const n = Number(value) || 0;
            return [`${n} (${Math.round((n / sum) * 100)}%)`, name];
          }}
          contentStyle={{ borderRadius: 8, borderColor: "#e5e5e5", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Four small-multiple donuts (Total/Emas/Perak/Perunggu) — each slice is
 * one kontingen, same color for that kontingen across all four. Shown on
 * the unfiltered event overview, alongside the Rekap table. */
export function KontingenCompositionPies({ kontingen }: { kontingen: KontingenTotals[] }) {
  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    kontingen.forEach((k, i) => map.set(k.id, i < PALETTE.length ? PALETTE[i] : OTHER_COLOR));
    return (id: string) => map.get(id) ?? OTHER_COLOR;
  }, [kontingen]);

  if (kontingen.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CHARTS.map((c) => (
          <div key={c.key} className="rounded-xl border border-neutral-200 bg-white p-2">
            <h3 className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-neutral-500">{c.label}</h3>
            <div className="h-36 sm:h-40">
              <OnePie data={kontingen.map((k) => ({ id: k.id, nama: k.nama, value: k[c.key] }))} colorOf={colorOf} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-neutral-600">
        {kontingen.map((k) => (
          <span key={k.id} className="flex items-center gap-1">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(k.id) }} /> {k.nama}
          </span>
        ))}
      </div>
    </div>
  );
}

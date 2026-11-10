import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface MedalTotals {
  gold: number;
  silver: number;
  bronze: number;
}

const SLICES: { key: keyof MedalTotals; label: string; color: string }[] = [
  { key: "gold", label: "Emas", color: "var(--color-gold)" },
  { key: "silver", label: "Perak", color: "var(--color-silver)" },
  { key: "bronze", label: "Perunggu", color: "var(--color-bronze)" },
];

/** Donut chart showing a kontingen's gold/silver/bronze composition — hover
 * a slice to see its count and share of the total. */
export function MedalCompositionChart({ totals }: { totals: MedalTotals }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = totals.gold + totals.silver + totals.bronze;

  const data = useMemo(
    () => SLICES.map((s) => ({ ...s, value: totals[s.key] })).filter((d) => d.value > 0),
    [totals],
  );

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">Belum ada medali untuk ditampilkan.</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            isAnimationActive
            animationDuration={600}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((d, i) => (
              <Cell
                key={d.key}
                fill={d.color}
                stroke="#fff"
                strokeWidth={2}
                opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const n = Number(value) || 0;
              return [`${n} (${Math.round((n / total) * 100)}%)`, name];
            }}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e5e5", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-semibold">
        {SLICES.map((s) => (
          <span key={s.key} className="flex shrink-0 items-center gap-1 whitespace-nowrap" style={{ color: s.color }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} /> {s.label} {totals[s.key]}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Shared chart constants & components for a unified visual language.
 * Use these everywhere instead of hand-tuning per chart.
 */

export const CHART_COLORS = {
  accent: "oklch(0.93 0.18 102)",       // yellow — focus / featured series
  positive: "oklch(0.76 0.16 152)",     // green — gains, inflows
  neutral: "oklch(0.72 0.13 240)",      // blue — neutral / context series
  negative: "oklch(0.70 0.20 27)",      // red — losses, outflows
  muted: "oklch(0.55 0.015 285)",       // grey — comparison / baseline
} as const;

export const CHART_GRID = "oklch(0.32 0.012 285 / 35%)";
export const CHART_AXIS_TICK = { fill: "oklch(0.70 0.010 285)", fontSize: 11 } as const;

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-popover/95 backdrop-blur px-3 py-2 shadow-xl">
      {label !== undefined && (
        <div className="text-eyebrow mb-1.5">{label}</div>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {formatter ? formatter(p.value ?? 0) : (p.value ?? 0).toLocaleString("pt-BR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const chartLegendStyle = {
  fontSize: 11,
  color: "oklch(0.70 0.010 285)",
  paddingTop: 8,
} as const;
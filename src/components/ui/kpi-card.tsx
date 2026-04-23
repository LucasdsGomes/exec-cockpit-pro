import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: number; // %
  icon?: LucideIcon;
  accent?: boolean;
  onClick?: () => void;
  /** When true, a positive delta is bad (e.g. PMR rising). Inverts color semantics only. */
  invertDelta?: boolean;
  size?: "sm" | "md" | "lg";
};

export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  accent,
  onClick,
  invertDelta,
  size = "md",
}: KpiCardProps) {
  const isInteractive = !!onClick;
  const hasDelta = delta !== undefined;
  const positive = (delta ?? 0) >= 0;
  const goodDirection = invertDelta ? !positive : positive;

  const padding = size === "lg" ? "p-6" : size === "sm" ? "p-4" : "p-5";
  const valueSize =
    size === "lg" ? "text-[28px] leading-[1.1]" : size === "sm" ? "text-xl" : "text-2xl";

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={isInteractive ? 0 : -1}
      aria-disabled={!isInteractive || undefined}
      className={cn(
        "group relative text-left rounded-2xl border bg-card overflow-hidden",
        "transition-[transform,border-color,box-shadow] duration-200 ease-out",
        padding,
        isInteractive && "hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer",
        !isInteractive && "cursor-default",
        accent
          ? "border-primary/30"
          : "border-border hover:border-border-strong",
      )}
      style={{
        boxShadow: "var(--shadow-card)",
        backgroundImage: accent ? "var(--gradient-kpi-accent)" : undefined,
      }}
    >
      {/* Top row: label + icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-eyebrow truncate">{label}</div>
        {Icon && (
          <div
            className={cn(
              "size-7 rounded-md grid place-items-center shrink-0 transition-colors",
              accent
                ? "bg-primary/15 text-primary"
                : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Value */}
      <div className={cn("mt-3 text-metric tracking-tight", valueSize)}>{value}</div>

      {/* Hint + delta */}
      <div className="mt-2 flex items-center justify-between gap-2 min-h-[18px]">
        <span className="text-[11px] text-muted-foreground truncate">{hint}</span>
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums rounded-full px-1.5 py-0.5",
              goodDirection
                ? "text-success bg-success/10"
                : "text-destructive bg-destructive/10",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3" strokeWidth={2.5} />
            ) : (
              <ArrowDownRight className="size-3" strokeWidth={2.5} />
            )}
            {Math.abs(delta!).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Accent gleam line at top */}
      {accent && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      )}
    </button>
  );
}
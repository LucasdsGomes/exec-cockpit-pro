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
};

export function KpiCard({ label, value, hint, delta, icon: Icon, accent, onClick }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border bg-card p-5 transition-all",
        "hover:border-primary/40 hover:-translate-y-0.5",
        "border-border",
        accent && "ring-1 ring-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
      )}
      style={{ boxShadow: "var(--shadow-elev)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        {Icon && (
          <div className={cn(
            "size-8 rounded-md grid place-items-center",
            accent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{hint}</span>
        {delta !== undefined && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
            positive ? "text-success" : "text-destructive"
          )}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </button>
  );
}
import { AlertTriangle, CheckCircle2, Info, XCircle, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightLevel = "ok" | "info" | "warn" | "error";

const LEVEL: Record<InsightLevel, { Icon: LucideIcon; bar: string; iconCls: string; label: string }> = {
  ok:    { Icon: CheckCircle2,   bar: "bg-success",     iconCls: "text-success",     label: "Tudo certo" },
  info:  { Icon: Info,           bar: "bg-info",        iconCls: "text-info",        label: "Atenção" },
  warn:  { Icon: AlertTriangle,  bar: "bg-warning",     iconCls: "text-warning",     label: "Aviso" },
  error: { Icon: XCircle,        bar: "bg-destructive", iconCls: "text-destructive", label: "Crítico" },
};

export interface InsightCardProps {
  level: InsightLevel;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void };
}

export function InsightCard({ level, title, description, action }: InsightCardProps) {
  const { Icon, bar, iconCls } = LEVEL[level];
  return (
    <div className="group relative flex gap-3 rounded-xl border border-border bg-card/60 hover:bg-card transition-colors p-3 pl-4 overflow-hidden">
      <span className={cn("absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full", bar)} />
      <Icon className={cn("size-4 mt-0.5 shrink-0", iconCls)} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground leading-tight">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</div>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-[11px] font-medium",
              iconCls,
              "hover:underline underline-offset-2",
            )}
          >
            {action.label}
            <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
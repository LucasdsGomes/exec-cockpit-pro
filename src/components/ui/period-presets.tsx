import { useState } from "react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { v: "hoje", l: "Hoje" },
  { v: "7d", l: "7d" },
  { v: "30d", l: "30d" },
  { v: "mtd", l: "Mês" },
  { v: "qtd", l: "Trim." },
  { v: "ytd", l: "YTD" },
  { v: "12m", l: "12m" },
] as const;

export function PeriodPresets({
  defaultValue = "30d",
  onChange,
  className,
}: {
  defaultValue?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue);
  return (
    <div
      role="tablist"
      aria-label="Período"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-input/40 border border-border p-0.5",
        className,
      )}
    >
      {PRESETS.map((p) => {
        const isActive = p.v === active;
        return (
          <button
            key={p.v}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => {
              setActive(p.v);
              onChange?.(p.v);
            }}
            className={cn(
              "px-2.5 h-7 rounded text-[11px] font-medium tabular-nums transition-colors",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.l}
          </button>
        );
      })}
    </div>
  );
}
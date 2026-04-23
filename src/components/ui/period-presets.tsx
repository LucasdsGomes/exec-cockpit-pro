import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PERIOD_PRESETS = [
  { v: "hoje", l: "Hoje" },
  { v: "7d", l: "7d" },
  { v: "30d", l: "30d" },
  { v: "mtd", l: "Mês" },
  { v: "qtd", l: "Trim." },
  { v: "ytd", l: "YTD" },
  { v: "12m", l: "12m" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["v"];

export const FUTURE_PRESETS = [
  { v: "next7", l: "+7d" },
  { v: "next30", l: "+30d" },
  { v: "next60", l: "+60d" },
  { v: "next90", l: "+90d" },
] as const;

export type FuturePreset = (typeof FUTURE_PRESETS)[number]["v"];

export function PeriodPresets({
  value,
  defaultValue = "30d",
  onChange,
  className,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const active = value ?? internal;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Select
        value={active}
        onValueChange={(v) => {
          if (value === undefined) setInternal(v);
          onChange?.(v);
        }}
      >
        <SelectTrigger
          className={cn(
            "h-9 w-auto min-w-[110px] bg-input/40 border-border text-xs font-medium",
            className,
          )}
        >
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_PRESETS.map((p) => (
            <SelectItem key={p.v} value={p.v} className="text-sm">
              {p.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Período"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-input/40 border border-border p-0.5",
        className,
      )}
    >
      {PERIOD_PRESETS.map((p) => {
        const isActive = p.v === active;
        return (
          <button
            key={p.v}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => {
              if (value === undefined) setInternal(p.v);
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
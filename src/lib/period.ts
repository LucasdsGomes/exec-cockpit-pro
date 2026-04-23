import type { PeriodPreset } from "@/components/ui/period-presets";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
}

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function periodToRange(preset: string, ref: Date = new Date()): DateRange {
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  let start = new Date(today);
  let label = "30 dias";

  switch (preset as PeriodPreset) {
    case "hoje":
      label = "Hoje";
      break;
    case "7d":
      start.setDate(today.getDate() - 6);
      label = "Últimos 7 dias";
      break;
    case "30d":
      start.setDate(today.getDate() - 29);
      label = "Últimos 30 dias";
      break;
    case "mtd":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      label = "Mês até hoje";
      break;
    case "qtd": {
      const q = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), q * 3, 1);
      label = "Trimestre até hoje";
      break;
    }
    case "ytd":
      start = new Date(today.getFullYear(), 0, 1);
      label = "Ano até hoje";
      break;
    case "12m":
      start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      label = "Últimos 12 meses";
      break;
    case "next7":
      end.setDate(today.getDate() + 7);
      label = "Próximos 7 dias";
      break;
    case "next30":
      end.setDate(today.getDate() + 30);
      label = "Próximos 30 dias";
      break;
    case "next60":
      end.setDate(today.getDate() + 60);
      label = "Próximos 60 dias";
      break;
    case "next90":
      end.setDate(today.getDate() + 90);
      label = "Próximos 90 dias";
      break;
    default:
      start.setDate(today.getDate() - 29);
  }
  return { start: fmt(start), end: fmt(end), label };
}

export function isFuturePreset(preset: string): boolean {
  return preset === "next7" || preset === "next30" || preset === "next60" || preset === "next90";
}

export function previousRange(range: DateRange): DateRange {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffDays + 1);
  return { start: fmt(prevStart), end: fmt(prevEnd), label: `Anterior` };
}

export function shortDateBR(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function monthLabelBR(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}
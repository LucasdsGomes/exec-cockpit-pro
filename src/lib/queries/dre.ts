import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { periodToRange, previousRange, type DateRange } from "@/lib/period";

export interface DRELine {
  conta: string;
  valor: number;
  pctReceita: number;
  varAbs: number;
  varPct: number;
  destaque?: "total" | "subtotal" | "negativo";
  spark: number[];
}

const ORDER: { group: string; label: string; destaque?: DRELine["destaque"] }[] = [
  { group: "Receita Bruta", label: "Receita Bruta" },
  { group: "Deduções", label: "(-) Deduções", destaque: "negativo" },
  { group: "Receita Líquida", label: "Receita Líquida", destaque: "subtotal" },
  { group: "CMV", label: "(-) CMV", destaque: "negativo" },
  { group: "Custos Diretos", label: "(-) Custos Diretos", destaque: "negativo" },
  { group: "Margem Bruta", label: "Margem Bruta", destaque: "subtotal" },
  { group: "Despesas Operacionais", label: "(-) Despesas Operacionais", destaque: "negativo" },
  { group: "EBITDA", label: "EBITDA", destaque: "total" },
  { group: "Resultado Financeiro", label: "Resultado Financeiro", destaque: "negativo" },
  { group: "Lucro Líquido", label: "Lucro Líquido", destaque: "total" },
];

async function aggregate(companyId: string, range: DateRange) {
  const { data } = await supabase
    .from("dre_base")
    .select("dre_group, amount_signed, competence_date")
    .eq("company_id", companyId)
    .gte("competence_date", range.start)
    .lte("competence_date", range.end);
  const totals = new Map<string, number>();
  for (const r of data ?? []) {
    const k = String(r.dre_group);
    totals.set(k, (totals.get(k) ?? 0) + Number(r.amount_signed ?? 0));
  }
  return totals;
}

async function spark12m(companyId: string): Promise<Map<string, number[]>> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = today.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("dre_base")
    .select("dre_group, amount_signed, competence_date")
    .eq("company_id", companyId)
    .gte("competence_date", startStr)
    .lte("competence_date", endStr);
  const result = new Map<string, number[]>();
  for (const o of ORDER) result.set(o.group, Array(12).fill(0));
  for (const r of data ?? []) {
    const d = new Date(String(r.competence_date) + "T00:00:00");
    const idx = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    if (idx < 0 || idx > 11) continue;
    const arr = result.get(String(r.dre_group));
    if (!arr) continue;
    arr[idx] += Number(r.amount_signed ?? 0);
  }
  return result;
}

export function useDreLines(companyId: string | null | undefined, period: string) {
  return useQuery({
    queryKey: ["dreLines", companyId, period],
    enabled: !!companyId,
    queryFn: async (): Promise<DRELine[]> => {
      const range = periodToRange(period);
      const prev = previousRange(range);
      const [curr, prv, sparks] = await Promise.all([
        aggregate(companyId!, range),
        aggregate(companyId!, prev),
        spark12m(companyId!),
      ]);
      const receita = curr.get("Receita Líquida") ?? 0;
      const lines: DRELine[] = [];
      for (const o of ORDER) {
        const v = curr.get(o.group) ?? 0;
        if (v === 0 && o.destaque !== "subtotal" && o.destaque !== "total") continue;
        const pv = prv.get(o.group) ?? 0;
        const varAbs = v - pv;
        const varPct = pv ? (varAbs / Math.abs(pv)) * 100 : 0;
        lines.push({
          conta: o.label,
          valor: v,
          pctReceita: receita ? (v / receita) * 100 : 0,
          varAbs,
          varPct,
          destaque: o.destaque,
          spark: sparks.get(o.group) ?? Array(12).fill(0),
        });
      }
      return lines;
    },
  });
}

export interface WaterfallStep {
  name: string;
  value: number;
  type: "total" | "subtotal" | "neg" | "pos";
}

export function useDreWaterfall(companyId: string | null | undefined, period: string) {
  return useQuery({
    queryKey: ["dreWaterfall", companyId, period],
    enabled: !!companyId,
    queryFn: async (): Promise<WaterfallStep[]> => {
      const range = periodToRange(period);
      const totals = await aggregate(companyId!, range);
      const get = (k: string) => totals.get(k) ?? 0;
      const steps: WaterfallStep[] = [
        { name: "Receita líquida", value: get("Receita Líquida"), type: "total" },
        { name: "CMV", value: get("CMV") || get("Custos Diretos"), type: "neg" },
        { name: "Margem bruta", value: get("Margem Bruta") || (get("Receita Líquida") + (get("CMV") || get("Custos Diretos"))), type: "subtotal" },
        { name: "Desp. Op.", value: get("Despesas Operacionais"), type: "neg" },
        { name: "EBITDA", value: get("EBITDA"), type: "total" },
        { name: "Result. Fin.", value: get("Resultado Financeiro"), type: "neg" },
        { name: "Lucro líquido", value: get("Lucro Líquido"), type: "total" },
      ];
      return steps;
    },
  });
}
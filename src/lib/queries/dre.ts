import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { periodToRange, previousRange, type DateRange } from "@/lib/period";
import { computeDreSubtotals, dreValueOf, type DreLineKey } from "@/lib/dre-subtotals";
import type { GlobalFilters } from "@/lib/filters-context";

export interface DRELine {
  conta: string;
  valor: number;
  pctReceita: number;
  varAbs: number;
  varPct: number;
  destaque?: "total" | "subtotal" | "negativo";
  spark: number[];
}

const ORDER: { key: DreLineKey; label: string; destaque?: DRELine["destaque"] }[] = [
  { key: "Receita Bruta", label: "Receita Bruta" },
  { key: "Deduções", label: "(-) Deduções", destaque: "negativo" },
  { key: "Receita Líquida", label: "Receita Líquida", destaque: "subtotal" },
  { key: "Custos", label: "(-) CMV / Custos Diretos", destaque: "negativo" },
  { key: "Margem Bruta", label: "Margem Bruta", destaque: "subtotal" },
  { key: "Despesas Administrativas", label: "(-) Despesas Administrativas", destaque: "negativo" },
  { key: "Despesas com Pessoal", label: "(-) Despesas com Pessoal", destaque: "negativo" },
  { key: "Despesas Operacionais", label: "(-) Despesas Operacionais", destaque: "negativo" },
  { key: "Despesas Tributárias", label: "(-) Despesas Tributárias", destaque: "negativo" },
  { key: "Outras Saídas", label: "(-) Outras Saídas", destaque: "negativo" },
  { key: "EBITDA", label: "EBITDA", destaque: "total" },
  { key: "Resultado Financeiro", label: "(-) Resultado Financeiro", destaque: "negativo" },
  { key: "Lucro Líquido", label: "Lucro Líquido", destaque: "total" },
];

async function aggregate(
  companyId: string,
  range: DateRange,
  filters?: Pick<GlobalFilters, "costCenterId" | "businessUnit">,
) {
  let q = supabase
    .from("dre_base")
    .select("dre_group, amount_signed, competence_date")
    .eq("company_id", companyId)
    .gte("competence_date", range.start)
    .lte("competence_date", range.end);
  if (filters?.costCenterId) q = q.eq("cost_center_id", filters.costCenterId);
  if (filters?.businessUnit) q = q.eq("business_unit", filters.businessUnit);
  const { data } = await q;
  const totals = new Map<string, number>();
  for (const r of data ?? []) {
    const k = String(r.dre_group);
    totals.set(k, (totals.get(k) ?? 0) + Number(r.amount_signed ?? 0));
  }
  return totals;
}

async function spark12m(companyId: string): Promise<Map<DreLineKey, number[]>> {
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
  // Aggregate per-month analytical totals
  const monthly: Map<string, number>[] = Array.from({ length: 12 }, () => new Map());
  for (const r of data ?? []) {
    const d = new Date(String(r.competence_date) + "T00:00:00");
    const idx = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    if (idx < 0 || idx > 11) continue;
    const k = String(r.dre_group);
    monthly[idx].set(k, (monthly[idx].get(k) ?? 0) + Number(r.amount_signed ?? 0));
  }
  // Compute subtotals per month and project per line key
  const result = new Map<DreLineKey, number[]>();
  for (const o of ORDER) result.set(o.key, Array(12).fill(0));
  for (let i = 0; i < 12; i++) {
    const sub = computeDreSubtotals(monthly[i]);
    for (const o of ORDER) {
      result.get(o.key)![i] = dreValueOf(sub, o.key);
    }
  }
  return result;
}

export function useDreLines(
  companyId: string | null | undefined,
  period: string,
  filters?: Partial<GlobalFilters>,
) {
  const cc = filters?.costCenterId ?? null;
  const bu = filters?.businessUnit ?? null;
  return useQuery({
    queryKey: ["dreLines", companyId, period, cc, bu],
    enabled: !!companyId,
    queryFn: async (): Promise<DRELine[]> => {
      const range = periodToRange(period);
      const prev = previousRange(range);
      const [curr, prv, sparks] = await Promise.all([
        aggregate(companyId!, range, { costCenterId: cc, businessUnit: bu }),
        aggregate(companyId!, prev, { costCenterId: cc, businessUnit: bu }),
        spark12m(companyId!),
      ]);
      const currSub = computeDreSubtotals(curr);
      const prvSub = computeDreSubtotals(prv);
      const receita = currSub.receitaLiquida + currSub.outrasReceitas;
      const lines: DRELine[] = [];
      for (const o of ORDER) {
        const v = dreValueOf(currSub, o.key);
        if (v === 0 && o.destaque !== "subtotal" && o.destaque !== "total") continue;
        const pv = dreValueOf(prvSub, o.key);
        const varAbs = v - pv;
        const varPct = pv ? (varAbs / Math.abs(pv)) * 100 : 0;
        lines.push({
          conta: o.label,
          valor: v,
          pctReceita: receita ? (v / receita) * 100 : 0,
          varAbs,
          varPct,
          destaque: o.destaque,
          spark: sparks.get(o.key) ?? Array(12).fill(0),
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

export function useDreWaterfall(
  companyId: string | null | undefined,
  period: string,
  filters?: Partial<GlobalFilters>,
) {
  const cc = filters?.costCenterId ?? null;
  const bu = filters?.businessUnit ?? null;
  return useQuery({
    queryKey: ["dreWaterfall", companyId, period, cc, bu],
    enabled: !!companyId,
    queryFn: async (): Promise<WaterfallStep[]> => {
      const range = periodToRange(period);
      const totals = await aggregate(companyId!, range, { costCenterId: cc, businessUnit: bu });
      const sub = computeDreSubtotals(totals);
      const steps: WaterfallStep[] = [
        { name: "Receita líquida", value: sub.receitaLiquida + sub.outrasReceitas, type: "total" },
        { name: "Custos", value: sub.custos, type: "neg" },
        { name: "Margem bruta", value: sub.margemBruta, type: "subtotal" },
        { name: "Desp. Op.", value: sub.despesasOperacionaisTotal, type: "neg" },
        { name: "EBITDA", value: sub.ebitda, type: "total" },
        { name: "Result. Fin.", value: sub.resultadoFinanceiro, type: "neg" },
        { name: "Lucro líquido", value: sub.lucroLiquido, type: "total" },
      ];
      return steps;
    },
  });
}

// ---------- B.2 Drill-down: lançamentos por linha de DRE ----------

export interface DreEntryRow {
  id: string;
  competence_date: string;
  dre_group: string;
  amount_signed: number;
  description: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  category_mapped: string | null;
}

/**
 * Returns the financial_entries rows whose dre_group matches one of the
 * raw groups that compose the requested DRE line. Respects the same period
 * and global filters used by useDreLines.
 */
export function useDreEntriesByLine(
  companyId: string | null | undefined,
  lineLabel: string | null,
  period: string,
  filters?: Partial<GlobalFilters>,
) {
  const cc = filters?.costCenterId ?? null;
  const bu = filters?.businessUnit ?? null;
  return useQuery({
    queryKey: ["dreEntriesByLine", companyId, lineLabel, period, cc, bu],
    enabled: !!companyId && !!lineLabel,
    queryFn: async (): Promise<DreEntryRow[]> => {
      const range = periodToRange(period);
      // Map UI label back to dre_group(s). Stripping prefixes like "(-) " and "Margem"/"EBITDA" subtotals.
      const label = lineLabel ?? "";
      const cleaned = label.replace(/^\(-\)\s*/, "").trim();
      // Subtotals/totals don't map to a single group → query all rows in range as best-effort.
      const SUBTOTAL_LABELS = new Set([
        "Receita Líquida",
        "Margem Bruta",
        "EBITDA",
        "Lucro Líquido",
      ]);
      let q = supabase
        .from("financial_entries")
        .select(
          "id, competence_date, dre_group, amount_signed, description, supplier_name, customer_name, category_mapped",
        )
        .eq("company_id", companyId!)
        .gte("competence_date", range.start)
        .lte("competence_date", range.end)
        .order("competence_date", { ascending: false })
        .limit(500);
      if (!SUBTOTAL_LABELS.has(cleaned)) {
        q = q.eq("dre_group", cleaned);
      }
      if (cc) q = q.eq("cost_center_id", cc);
      // business_unit lives on dre_base only; intentionally not filtered here
      void bu;
      const { data } = await q;
      return (data ?? []).map((r) => ({
        ...r,
        amount_signed: Number(r.amount_signed ?? 0),
      })) as DreEntryRow[];
    },
  });
}
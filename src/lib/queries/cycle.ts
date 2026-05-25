import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monthLabelBR, periodToRange } from "@/lib/period";

export interface CycleMetrics {
  pmr: number;
  pmp: number;
  pme: number;
  cicloOperacional: number;
  cicloFinanceiro: number;
  ncg: number;
  receitaLiquidaMes: number;
}

export interface CycleHistoryPoint {
  mes: string;
  pmr: number;
  pmp: number;
  pme: number;
  ciclo: number;
}

export function useCycleMetrics(
  companyId: string | null | undefined,
  period: string = "30d",
) {
  return useQuery({
    queryKey: ["cycleMetrics", companyId, period],
    enabled: !!companyId,
    queryFn: async (): Promise<CycleMetrics> => {
      const range = periodToRange(period);
      // 1) Cálculo dinâmico: PMR/PMP a partir de financial_entries liquidados no período.
      const [pmrRes, pmpRes, dreRes, pmeParamRes, snapRes] = await Promise.all([
        supabase
          .from("financial_entries")
          .select("competence_date, cash_date")
          .eq("company_id", companyId!)
          .eq("direction", "entrada")
          .not("cash_date", "is", null)
          .gte("cash_date", range.start)
          .lte("cash_date", range.end),
        supabase
          .from("financial_entries")
          .select("competence_date, cash_date")
          .eq("company_id", companyId!)
          .eq("direction", "saida")
          .not("cash_date", "is", null)
          .gte("cash_date", range.start)
          .lte("cash_date", range.end),
        supabase
          .from("dre_base")
          .select("amount_signed")
          .eq("company_id", companyId!)
          .eq("dre_group", "Receita Líquida")
          .gte("competence_date", range.start)
          .lte("competence_date", range.end),
        supabase
          .from("manual_parameters")
          .select("param_value")
          .eq("company_id", companyId!)
          .eq("param_key", "pme_days")
          .maybeSingle(),
        supabase
          .from("financial_cycle_metrics")
          .select("pmr, pmp, pme, ciclo_operacional, ciclo_financeiro, necessidade_capital_giro")
          .eq("company_id", companyId!)
          .order("reference_period", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const avgDays = (rows: { competence_date: string | null; cash_date: string | null }[] | null) => {
        if (!rows || rows.length === 0) return null;
        let total = 0;
        let n = 0;
        for (const r of rows) {
          if (!r.competence_date || !r.cash_date) continue;
          const d = (new Date(r.cash_date).getTime() - new Date(r.competence_date).getTime()) / 86_400_000;
          if (Number.isFinite(d) && d >= 0) {
            total += d;
            n += 1;
          }
        }
        return n > 0 ? total / n : null;
      };

      const snap = snapRes.data;
      const pmrDyn = avgDays(pmrRes.data ?? null);
      const pmpDyn = avgDays(pmpRes.data ?? null);
      // Fallback para snapshot quando não há liquidações no período.
      const pmr = pmrDyn ?? Number(snap?.pmr ?? 0);
      const pmp = pmpDyn ?? Number(snap?.pmp ?? 0);
      const pme = pmeParamRes.data?.param_value != null
        ? Number(pmeParamRes.data.param_value)
        : Number(snap?.pme ?? 0);
      const cicloOperacional = pmr + pme;
      const cicloFinanceiro = pmr + pme - pmp;
      const receita = (dreRes.data ?? []).reduce((s, x) => s + Number(x.amount_signed ?? 0), 0);
      // NCG ≈ ciclo financeiro * (receita diária do período)
      const rangeDays = Math.max(
        1,
        Math.round(
          (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000,
        ) + 1,
      );
      const receitaDiaria = receita / rangeDays;
      const ncg = cicloFinanceiro > 0 ? cicloFinanceiro * receitaDiaria : Number(snap?.necessidade_capital_giro ?? 0);
      return {
        pmr,
        pmp,
        pme,
        cicloOperacional,
        cicloFinanceiro,
        ncg,
        receitaLiquidaMes: receita,
      };
    },
  });
}

export function useCycleHistory(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["cycleHistory", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CycleHistoryPoint[]> => {
      const { data } = await supabase
        .from("dashboard_kpi_snapshots")
        .select("snapshot_date, pmr, pmp, ciclo_financeiro")
        .eq("company_id", companyId!)
        .order("snapshot_date", { ascending: true })
        .limit(60);
      const byMonth = new Map<string, CycleHistoryPoint>();
      for (const s of data ?? []) {
        const key = String(s.snapshot_date).slice(0, 7);
        byMonth.set(key, {
          mes: monthLabelBR(String(s.snapshot_date)),
          pmr: Number(s.pmr ?? 0),
          pmp: Number(s.pmp ?? 0),
          pme: 0,
          ciclo: Number(s.ciclo_financeiro ?? 0),
        });
      }
      return [...byMonth.values()].slice(-12);
    },
  });
}
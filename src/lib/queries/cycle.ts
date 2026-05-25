import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monthLabelBR } from "@/lib/period";

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

export function useCycleMetrics(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["cycleMetrics", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CycleMetrics> => {
      const today = new Date().toISOString().slice(0, 10);
      // Read latest persisted metrics from financial_cycle_metrics (source of truth).
      const { data: metricsRow } = await supabase
        .from("financial_cycle_metrics")
        .select("pmr, pmp, pme, ciclo_operacional, ciclo_financeiro, necessidade_capital_giro")
        .eq("company_id", companyId!)
        .order("reference_period", { ascending: false })
        .limit(1)
        .maybeSingle();

      let r: Record<string, number | null> = {};
      if (metricsRow) {
        r = {
          pmr: metricsRow.pmr,
          pmp: metricsRow.pmp,
          pme: metricsRow.pme,
          ciclo_operacional: metricsRow.ciclo_operacional,
          ciclo_financeiro: metricsRow.ciclo_financeiro,
          ncg: metricsRow.necessidade_capital_giro,
        };
      } else {
        // Fallback: compute on the fly if no snapshot exists.
        const { data } = await supabase.rpc("compute_financial_cycle", {
          _company: companyId!,
          _period: today,
        });
        if (data && Array.isArray(data) && data.length > 0) {
          r = data[0] as Record<string, number | null>;
        } else {
          return { pmr: 0, pmp: 0, pme: 0, cicloOperacional: 0, cicloFinanceiro: 0, ncg: 0, receitaLiquidaMes: 0 };
        }
      }
      const today2 = new Date();
      const monthStart = new Date(today2.getFullYear(), today2.getMonth(), 1).toISOString().slice(0, 10);
      const { data: dre } = await supabase
        .from("dre_base")
        .select("amount_signed")
        .eq("company_id", companyId!)
        .eq("dre_group", "Receita Líquida")
        .gte("competence_date", monthStart)
        .lte("competence_date", today);
      const receita = (dre ?? []).reduce((s, x) => s + Number(x.amount_signed ?? 0), 0);
      return {
        pmr: Number(r.pmr ?? 0),
        pmp: Number(r.pmp ?? 0),
        pme: Number(r.pme ?? 0),
        cicloOperacional: Number(r.ciclo_operacional ?? 0),
        cicloFinanceiro: Number(r.ciclo_financeiro ?? 0),
        ncg: Number(r.ncg ?? 0),
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
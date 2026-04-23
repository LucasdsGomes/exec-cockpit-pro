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
      const { data, error } = await supabase.rpc("compute_financial_cycle", {
        _company: companyId!,
        _period: today,
      });
      if (error || !data || !Array.isArray(data) || data.length === 0) {
        return { pmr: 0, pmp: 0, pme: 0, cicloOperacional: 0, cicloFinanceiro: 0, ncg: 0, receitaLiquidaMes: 0 };
      }
      const r = data[0] as Record<string, number | null>;
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
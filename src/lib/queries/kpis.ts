import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { periodToRange, previousRange, type DateRange } from "@/lib/period";

export interface KpiSet {
  receitaLiquida: number;
  receitaLiquidaVar: number;
  ebitda: number;
  ebitdaVar: number;
  margemEbitda: number;
  resultadoLiquido: number;
  resultadoLiquidoVar: number;
  saldoCaixa: number;
  saldoCaixaVar: number;
  geracaoCaixa: number;
  projecaoCaixa30d: number;
  contasPagar7d: number;
  contasReceber7d: number;
  pmr: number;
  pmp: number;
  cicloFinanceiro: number;
  contasBancarias: number;
  range: DateRange;
}

async function sumDre(companyId: string, group: string, range: DateRange): Promise<number> {
  const { data } = await supabase
    .from("dre_base")
    .select("amount_signed")
    .eq("company_id", companyId)
    .eq("dre_group", group)
    .gte("competence_date", range.start)
    .lte("competence_date", range.end);
  return (data ?? []).reduce((s, r) => s + Number(r.amount_signed ?? 0), 0);
}

function pctVar(curr: number, prev: number): number {
  if (!prev || Math.abs(prev) < 1) return 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function useKpis(period: string, companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["kpis", companyId, period],
    enabled: !!companyId,
    queryFn: async (): Promise<KpiSet> => {
      const range = periodToRange(period);
      const prev = previousRange(range);

      const today = new Date();
      const in7 = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);

      const [
        receita, ebitda, resultado,
        receitaPrev, ebitdaPrev, resultadoPrev,
        payables, receivables,
        accountsRes, snapshotRes,
      ] = await Promise.all([
        sumDre(companyId!, "Receita Líquida", range),
        sumDre(companyId!, "EBITDA", range),
        sumDre(companyId!, "Lucro Líquido", range),
        sumDre(companyId!, "Receita Líquida", prev),
        sumDre(companyId!, "EBITDA", prev),
        sumDre(companyId!, "Lucro Líquido", prev),
        supabase
          .from("payable_entries")
          .select("amount, paid_amount")
          .eq("company_id", companyId!)
          .gte("due_date", todayStr)
          .lte("due_date", in7),
        supabase
          .from("receivable_entries")
          .select("amount, received_amount")
          .eq("company_id", companyId!)
          .gte("due_date", todayStr)
          .lte("due_date", in7),
        supabase
          .from("bank_accounts")
          .select("id")
          .eq("company_id", companyId!)
          .eq("active", true),
        supabase
          .from("dashboard_kpi_snapshots")
          .select("*")
          .eq("company_id", companyId!)
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const contasPagar7d = (payables.data ?? []).reduce(
        (s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)),
        0,
      );
      const contasReceber7d = (receivables.data ?? []).reduce(
        (s, r) => s + (Number(r.amount ?? 0) - Number(r.received_amount ?? 0)),
        0,
      );

      const snap = snapshotRes.data as Record<string, number | null> | null;
      const saldoCaixa = Number(snap?.caixa_final ?? 0);
      const projecaoCaixa30d = Number(snap?.projecao_caixa_30d ?? 0) || (saldoCaixa + contasReceber7d - contasPagar7d);

      return {
        receitaLiquida: receita,
        receitaLiquidaVar: pctVar(receita, receitaPrev),
        ebitda,
        ebitdaVar: pctVar(ebitda, ebitdaPrev),
        margemEbitda: receita ? (ebitda / receita) * 100 : 0,
        resultadoLiquido: resultado,
        resultadoLiquidoVar: pctVar(resultado, resultadoPrev),
        saldoCaixa,
        saldoCaixaVar: 0,
        geracaoCaixa: contasReceber7d - contasPagar7d,
        projecaoCaixa30d,
        contasPagar7d,
        contasReceber7d,
        pmr: Number(snap?.pmr ?? 0),
        pmp: Number(snap?.pmp ?? 0),
        cicloFinanceiro: Number(snap?.ciclo_financeiro ?? 0),
        contasBancarias: (accountsRes.data ?? []).length,
        range,
      };
    },
  });
}
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { periodToRange, previousRange, type DateRange } from "@/lib/period";
import { computeDreSubtotals } from "@/lib/dre-subtotals";
import type { GlobalFilters } from "@/lib/filters-context";

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

async function aggregateDre(
  companyId: string,
  range: DateRange,
  filters?: Pick<GlobalFilters, "costCenterId" | "businessUnit">,
): Promise<Map<string, number>> {
  let q = supabase
    .from("dre_base")
    .select("dre_group, amount_signed")
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

function pctVar(curr: number, prev: number): number {
  if (!prev || Math.abs(prev) < 1) return 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function useKpis(
  period: string,
  companyId: string | null | undefined,
  filters?: Partial<GlobalFilters>,
) {
  const cc = filters?.costCenterId ?? null;
  const bu = filters?.businessUnit ?? null;
  const ba = filters?.bankAccountId ?? null;
  return useQuery({
    queryKey: ["kpis", companyId, period, cc, bu, ba],
    enabled: !!companyId,
    queryFn: async (): Promise<KpiSet> => {
      const range = periodToRange(period);
      const prev = previousRange(range);

      // Window for "A Pagar / A Receber" and for PMR/PMP follows the active period filter.
      const payQ = supabase
        .from("payable_entries")
        .select("amount, paid_amount, due_date, cash_date")
        .eq("company_id", companyId!)
        .gte("due_date", range.start)
        .lte("due_date", range.end);
      const recQ = supabase
        .from("receivable_entries")
        .select("amount, received_amount, due_date, cash_date")
        .eq("company_id", companyId!)
        .gte("due_date", range.start)
        .lte("due_date", range.end);
      if (cc) {
        payQ.eq("cost_center_id", cc);
        recQ.eq("cost_center_id", cc);
      }

      // Settled entries within range for PMR/PMP (days from competence to cash).
      let pmrQ = supabase
        .from("financial_entries")
        .select("competence_date, cash_date")
        .eq("company_id", companyId!)
        .eq("direction", "entrada")
        .not("cash_date", "is", null)
        .gte("cash_date", range.start)
        .lte("cash_date", range.end);
      let pmpQ = supabase
        .from("financial_entries")
        .select("competence_date, cash_date")
        .eq("company_id", companyId!)
        .eq("direction", "saida")
        .not("cash_date", "is", null)
        .gte("cash_date", range.start)
        .lte("cash_date", range.end);
      if (cc) {
        pmrQ = pmrQ.eq("cost_center_id", cc);
        pmpQ = pmpQ.eq("cost_center_id", cc);
      }

      const [
        currTotals, prevTotals,
        payables, receivables,
        accountsRes, snapshotRes,
        pmrRes, pmpRes,
      ] = await Promise.all([
        aggregateDre(companyId!, range, { costCenterId: cc, businessUnit: bu }),
        aggregateDre(companyId!, prev, { costCenterId: cc, businessUnit: bu }),
        payQ,
        recQ,
        ba
          ? supabase.from("bank_accounts").select("id").eq("id", ba)
          : supabase
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
        pmrQ,
        pmpQ,
      ]);

      const curr = computeDreSubtotals(currTotals);
      const prv = computeDreSubtotals(prevTotals);
      const receita = curr.receitaLiquida + curr.outrasReceitas;
      const receitaPrev = prv.receitaLiquida + prv.outrasReceitas;
      const ebitda = curr.ebitda;
      const ebitdaPrev = prv.ebitda;
      const resultado = curr.lucroLiquido;
      const resultadoPrev = prv.lucroLiquido;

      const contasPagar7d = (payables.data ?? []).reduce(
        (s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)),
        0,
      );
      const contasReceber7d = (receivables.data ?? []).reduce(
        (s, r) => s + (Number(r.amount ?? 0) - Number(r.received_amount ?? 0)),
        0,
      );

      const avgDays = (rows: Array<{ competence_date: string | null; cash_date: string | null }> | null) => {
        if (!rows || rows.length === 0) return 0;
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
        return n > 0 ? total / n : 0;
      };
      const pmr = avgDays(pmrRes.data as Array<{ competence_date: string | null; cash_date: string | null }> | null);
      const pmp = avgDays(pmpRes.data as Array<{ competence_date: string | null; cash_date: string | null }> | null);
      const cicloFinanceiro = pmr - pmp;

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
        pmr,
        pmp,
        cicloFinanceiro,
        contasBancarias: (accountsRes.data ?? []).length,
        range,
      };
    },
  });
}
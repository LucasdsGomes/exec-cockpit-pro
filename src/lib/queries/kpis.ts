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

      // Saldo de caixa ao final do período = initial_balances (caixa) + dfc_realized_base até range.end
      const ibQ = supabase
        .from("initial_balances")
        .select("amount, balance_type")
        .eq("company_id", companyId!)
        .lte("reference_date", range.end);
      let realCashQ = supabase
        .from("dfc_realized_base")
        .select("amount_signed, cash_date")
        .eq("company_id", companyId!)
        .lte("cash_date", range.end);
      if (ba) realCashQ = realCashQ.eq("bank_account_id", ba);
      // Geração de caixa do período = soma de amount_signed em dfc_realized_base dentro do range
      let geracaoQ = supabase
        .from("dfc_realized_base")
        .select("amount_signed")
        .eq("company_id", companyId!)
        .gte("cash_date", range.start)
        .lte("cash_date", range.end);
      if (ba) geracaoQ = geracaoQ.eq("bank_account_id", ba);

      const [
        currTotals, prevTotals,
        payables, receivables,
        accountsRes,
        pmrRes, pmpRes,
        ibRes, realCashRes, geracaoRes,
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
        pmrQ,
        pmpQ,
        ibQ,
        realCashQ,
        geracaoQ,
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

      // Saldo de caixa ao fim do período (initial balances de caixa + realizado até range.end)
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const saldoIniCaixa = (ibRes.data ?? [])
        .filter((x) => String(x.balance_type ?? "").toLowerCase().includes("caix"))
        .reduce((s, x) => s + Number(x.amount ?? 0), 0);
      const realizadoAteFim = (realCashRes.data ?? []).reduce(
        (s, x) => s + Number(x.amount_signed ?? 0),
        0,
      );
      const saldoCaixa = round2(saldoIniCaixa + realizadoAteFim);
      const geracaoPeriodo = round2(
        (geracaoRes.data ?? []).reduce((s, x) => s + Number(x.amount_signed ?? 0), 0),
      );
      // Projeção 30d a partir do fim do período: saldoCaixa + (receber 30d - pagar 30d)
      const proj30Start = range.end;
      const proj30End = new Date(new Date(range.end + "T00:00:00").getTime() + 30 * 86_400_000)
        .toISOString().slice(0, 10);
      const [payProj, recProj] = await Promise.all([
        supabase
          .from("payable_entries")
          .select("amount, paid_amount")
          .eq("company_id", companyId!)
          .gte("due_date", proj30Start)
          .lte("due_date", proj30End),
        supabase
          .from("receivable_entries")
          .select("amount, received_amount")
          .eq("company_id", companyId!)
          .gte("due_date", proj30Start)
          .lte("due_date", proj30End),
      ]);
      const pay30 = (payProj.data ?? []).reduce(
        (s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)),
        0,
      );
      const rec30 = (recProj.data ?? []).reduce(
        (s, r) => s + (Number(r.amount ?? 0) - Number(r.received_amount ?? 0)),
        0,
      );
      const projecaoCaixa30d = round2(saldoCaixa + rec30 - pay30);

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
        geracaoCaixa: geracaoPeriodo,
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
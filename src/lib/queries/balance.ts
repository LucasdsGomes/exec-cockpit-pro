import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BalanceItem {
  conta: string;
  valor: number;
}
export interface BalanceData {
  ativo: { circulante: BalanceItem[]; naoCirculante: BalanceItem[] };
  passivo: { circulante: BalanceItem[]; naoCirculante: BalanceItem[] };
  patrimonio: BalanceItem[];
  hasInitialBalances: boolean;
}

export function useBalance(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["balance", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BalanceData> => {
      const today = new Date().toISOString().slice(0, 10);
      const [snapRes, ibRes, arRes, apRes] = await Promise.all([
        supabase
          .from("balance_projection_daily")
          .select("*")
          .eq("company_id", companyId!)
          .lte("projection_date", today)
          .order("projection_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("initial_balances")
          .select("amount, balance_type, account_label")
          .eq("company_id", companyId!),
        supabase
          .from("receivable_entries")
          .select("amount, received_amount")
          .eq("company_id", companyId!)
          .neq("status", "realizado"),
        supabase
          .from("payable_entries")
          .select("amount, paid_amount")
          .eq("company_id", companyId!)
          .neq("status", "realizado"),
      ]);

      const ib = ibRes.data ?? [];
      const hasInitialBalances = ib.length > 0;

      const sumByType = (kw: string) =>
        ib
          .filter((x) => String(x.balance_type ?? "").toLowerCase().includes(kw))
          .reduce((s, x) => s + Number(x.amount ?? 0), 0);

      const ar = (arRes.data ?? []).reduce((s, r) => s + (Number(r.amount ?? 0) - Number(r.received_amount ?? 0)), 0);
      const ap = (apRes.data ?? []).reduce((s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)), 0);

      const snap = snapRes.data as Record<string, number | null> | null;
      if (snap) {
        return {
          ativo: {
            circulante: [
              { conta: "Caixa e equivalentes", valor: Number(snap.caixa ?? 0) },
              { conta: "Contas a receber", valor: Number(snap.contas_receber ?? 0) || ar },
              { conta: "Estoques", valor: Number(snap.estoques ?? 0) },
              { conta: "Outros ativos circulantes", valor: Number(snap.outros_ativos ?? 0) },
            ],
            naoCirculante: [{ conta: "Imobilizado (líquido)", valor: Number(snap.imobilizado ?? 0) }],
          },
          passivo: {
            circulante: [
              { conta: "Fornecedores", valor: Number(snap.fornecedores ?? 0) || ap },
              { conta: "Obrigações tributárias", valor: Number(snap.obrigacoes_tributarias ?? 0) },
              { conta: "Obrigações trabalhistas", valor: Number(snap.obrigacoes_trabalhistas ?? 0) },
              { conta: "Empréstimos curto prazo", valor: Number(snap.emprestimos ?? 0) },
              { conta: "Demais passivos circulantes", valor: Number(snap.outros_passivos ?? 0) },
            ],
            naoCirculante: [],
          },
          patrimonio: [
            { conta: "Patrimônio Líquido", valor: Number(snap.patrimonio_liquido ?? 0) },
            { conta: "Resultado acumulado", valor: Number(snap.resultado_acumulado ?? 0) },
          ],
          hasInitialBalances,
        };
      }

      // Build minimal projection from initial balances + AR/AP
      const caixa = sumByType("caix");
      return {
        ativo: {
          circulante: [
            { conta: "Caixa e equivalentes", valor: caixa },
            { conta: "Contas a receber", valor: ar },
            { conta: "Estoques", valor: sumByType("estoq") },
            { conta: "Outros ativos circulantes", valor: 0 },
          ],
          naoCirculante: [{ conta: "Imobilizado (líquido)", valor: sumByType("imob") }],
        },
        passivo: {
          circulante: [
            { conta: "Fornecedores", valor: ap },
            { conta: "Obrigações tributárias", valor: 0 },
            { conta: "Obrigações trabalhistas", valor: 0 },
            { conta: "Empréstimos curto prazo", valor: sumByType("emprest") },
            { conta: "Demais passivos circulantes", valor: 0 },
          ],
          naoCirculante: [],
        },
        patrimonio: [
          { conta: "Capital social", valor: sumByType("capital") },
          { conta: "Resultado acumulado", valor: 0 },
        ],
        hasInitialBalances,
      };
    },
  });
}
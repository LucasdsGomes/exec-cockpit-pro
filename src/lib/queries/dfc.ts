import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { periodToRange, shortDateBR } from "@/lib/period";
import type { GlobalFilters } from "@/lib/filters-context";

export interface DfcBlock {
  tipo: string;
  itens: { conta: string; valor: number }[];
}

export interface DfcSummary {
  saldoInicial: number;
  saldoFinal: number;
  totalEntradas: number;
  totalSaidas: number;
  blocos: DfcBlock[];
  isForecast: boolean;
}

export function useDfcSummary(
  companyId: string | null | undefined,
  period: string,
  filters?: Partial<GlobalFilters>,
) {
  const ba = filters?.bankAccountId ?? null;
  const mode = filters?.viewMode ?? "consolidado";
  return useQuery({
    queryKey: ["dfcSummary", companyId, period, ba, mode],
    enabled: !!companyId,
    queryFn: async (): Promise<DfcSummary> => {
      const range = periodToRange(period);
      const realQ = supabase
        .from("dfc_realized_base")
        .select("dfc_group, flow_type, amount_signed")
        .eq("company_id", companyId!)
        .gte("cash_date", range.start)
        .lte("cash_date", range.end);
      const fcQ = supabase
        .from("dfc_forecast_base")
        .select("dfc_group, flow_type, amount_signed")
        .eq("company_id", companyId!)
        .gte("forecast_date", range.start)
        .lte("forecast_date", range.end);
      if (ba) {
        realQ.eq("bank_account_id", ba);
        fcQ.eq("bank_account_id", ba);
      }
      const [realRes, fcRes, accountsRes] = await Promise.all([
        mode === "previsto"
          ? Promise.resolve({ data: [] as { dfc_group: string | null; flow_type: string | null; amount_signed: number | null }[] })
          : realQ,
        mode === "realizado"
          ? Promise.resolve({ data: [] as { dfc_group: string | null; flow_type: string | null; amount_signed: number | null }[] })
          : fcQ,
        supabase.from("bank_accounts").select("id").eq("company_id", companyId!).eq("active", true),
      ]);

      const realRows = realRes.data ?? [];
      const isForecast = mode === "previsto" || (mode !== "realizado" && realRows.length === 0);
      const rows = (isForecast ? (fcRes.data ?? []) : realRows) as {
        dfc_group: string | null;
        flow_type: string | null;
        amount_signed: number | null;
      }[];

      const grouped = new Map<string, Map<string, number>>();
      for (const r of rows) {
        const tipo = (r.flow_type ?? "operacional").toString();
        const conta = r.dfc_group ?? "Outros";
        const v = Number(r.amount_signed ?? 0);
        let g = grouped.get(tipo);
        if (!g) {
          g = new Map();
          grouped.set(tipo, g);
        }
        g.set(conta, (g.get(conta) ?? 0) + v);
      }
      const blocos: DfcBlock[] = [...grouped.entries()].map(([tipo, m]) => ({
        tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        itens: [...m.entries()].map(([conta, valor]) => ({ conta, valor })),
      }));

      let totalEntradas = 0;
      let totalSaidas = 0;
      for (const r of rows) {
        const v = Number(r.amount_signed ?? 0);
        if (v >= 0) totalEntradas += v;
        else totalSaidas += v;
      }

      // Saldo inicial: sum initial_balances (caixa) before range.start
      const { data: ib } = await supabase
        .from("initial_balances")
        .select("amount, balance_type, reference_date")
        .eq("company_id", companyId!)
        .lte("reference_date", range.start);
      const saldoInicial = (ib ?? [])
        .filter((x) => String(x.balance_type ?? "").toLowerCase().includes("caix"))
        .reduce((s, x) => s + Number(x.amount ?? 0), 0);
      const saldoFinal = saldoInicial + totalEntradas + totalSaidas;

      void accountsRes;
      return { saldoInicial, saldoFinal, totalEntradas, totalSaidas, blocos, isForecast };
    },
  });
}

export interface DueHeatCell {
  dia: number;
  date: string;
  valor: number;
}

export function useDueHeatmap(companyId: string | null | undefined, days = 28) {
  return useQuery({
    queryKey: ["dueHeatmap", companyId, days],
    enabled: !!companyId,
    queryFn: async (): Promise<DueHeatCell[]> => {
      const today = new Date();
      const start = today.toISOString().slice(0, 10);
      const end = new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("payable_entries")
        .select("due_date, amount, paid_amount")
        .eq("company_id", companyId!)
        .gte("due_date", start)
        .lte("due_date", end);
      const map = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const d = new Date(today.getTime() + i * 86_400_000).toISOString().slice(0, 10);
        map.set(d, 0);
      }
      for (const r of data ?? []) {
        const d = String(r.due_date);
        const v = Number(r.amount ?? 0) - Number(r.paid_amount ?? 0);
        map.set(d, (map.get(d) ?? 0) + v);
      }
      return [...map.entries()].map(([date, valor], i) => ({
        dia: i + 1,
        date: shortDateBR(date),
        valor,
      }));
    },
  });
}
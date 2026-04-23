import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { periodToRange, monthLabelBR, shortDateBR, type DateRange } from "@/lib/period";
import type { GlobalFilters } from "@/lib/filters-context";

export interface MonthPoint {
  mes: string;
  receita: number;
  ebitda: number;
  caixa: number;
}
export interface DayPoint {
  dia: string;
  entrada: number;
  saida: number;
  saldo: number;
}

export function useTrend12m(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["trend12m", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<MonthPoint[]> => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 11, 1)
        .toISOString().slice(0, 10);
      const end = today.toISOString().slice(0, 10);

      const [dre, snaps] = await Promise.all([
        supabase
          .from("dre_base")
          .select("competence_date, dre_group, amount_signed")
          .eq("company_id", companyId!)
          .in("dre_group", ["Receita Líquida", "EBITDA"])
          .gte("competence_date", start)
          .lte("competence_date", end),
        supabase
          .from("dashboard_kpi_snapshots")
          .select("snapshot_date, caixa_final")
          .eq("company_id", companyId!)
          .gte("snapshot_date", start)
          .lte("snapshot_date", end),
      ]);

      const buckets = new Map<string, MonthPoint>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
        const key = d.toISOString().slice(0, 7);
        buckets.set(key, { mes: monthLabelBR(d.toISOString().slice(0, 10)), receita: 0, ebitda: 0, caixa: 0 });
      }
      for (const r of dre.data ?? []) {
        const key = String(r.competence_date).slice(0, 7);
        const b = buckets.get(key);
        if (!b) continue;
        const v = Number(r.amount_signed ?? 0);
        if (r.dre_group === "Receita Líquida") b.receita += v;
        else if (r.dre_group === "EBITDA") b.ebitda += v;
      }
      // Latest snapshot per month for caixa
      const latestByMonth = new Map<string, { date: string; v: number }>();
      for (const s of snaps.data ?? []) {
        const key = String(s.snapshot_date).slice(0, 7);
        const existing = latestByMonth.get(key);
        if (!existing || String(s.snapshot_date) > existing.date) {
          latestByMonth.set(key, { date: String(s.snapshot_date), v: Number(s.caixa_final ?? 0) });
        }
      }
      for (const [key, b] of buckets) b.caixa = latestByMonth.get(key)?.v ?? 0;
      return [...buckets.values()];
    },
  });
}

export function useCashDaily(
  companyId: string | null | undefined,
  period: string = "30d",
  filters?: Partial<GlobalFilters>,
) {
  const ba = filters?.bankAccountId ?? null;
  const mode = filters?.viewMode ?? "consolidado";
  return useQuery({
    queryKey: ["cashDaily", companyId, period, ba, mode],
    enabled: !!companyId,
    queryFn: async (): Promise<DayPoint[]> => {
      const range: DateRange = periodToRange(period);
      const realQ = supabase
        .from("dfc_realized_base")
        .select("cash_date, amount_signed, flow_type")
        .eq("company_id", companyId!)
        .gte("cash_date", range.start)
        .lte("cash_date", range.end);
      const fcQ = supabase
        .from("dfc_forecast_base")
        .select("forecast_date, amount_signed")
        .eq("company_id", companyId!)
        .gte("forecast_date", range.start)
        .lte("forecast_date", range.end);
      if (ba) {
        realQ.eq("bank_account_id", ba);
        fcQ.eq("bank_account_id", ba);
      }
      const [recRes, fcRes] = await Promise.all([
        mode === "previsto"
          ? Promise.resolve({ data: [] as { cash_date: string; amount_signed: number; flow_type: string }[] })
          : realQ,
        mode === "realizado"
          ? Promise.resolve({ data: [] as { forecast_date: string; amount_signed: number }[] })
          : fcQ,
      ]);

      const days = new Map<string, { entrada: number; saida: number }>();
      const start = new Date(range.start + "T00:00:00");
      const end = new Date(range.end + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.set(d.toISOString().slice(0, 10), { entrada: 0, saida: 0 });
      }
      const consume = (rows: { date: string; v: number }[]) => {
        for (const r of rows) {
          const b = days.get(r.date);
          if (!b) continue;
          if (r.v >= 0) b.entrada += r.v;
          else b.saida += Math.abs(r.v);
        }
      };
      consume((recRes.data ?? []).map((r) => ({ date: String(r.cash_date), v: Number(r.amount_signed ?? 0) })));
      // If realizado is empty (or user picked previsto/consolidado), include forecast
      if (mode !== "realizado" && (recRes.data ?? []).length === 0) {
        consume((fcRes.data ?? []).map((r) => ({ date: String(r.forecast_date), v: Number(r.amount_signed ?? 0) })));
      }

      let saldo = 0;
      const result: DayPoint[] = [];
      for (const [dateStr, v] of days) {
        saldo += v.entrada - v.saida;
        result.push({ dia: shortDateBR(dateStr), entrada: v.entrada, saida: v.saida, saldo });
      }
      return result;
    },
  });
}

export interface UpcomingEntry {
  id: string;
  nome: string;
  venc: string;
  valor: number;
  status: string;
}

export function useUpcomingPayables(companyId: string | null | undefined, days = 14) {
  return useQuery({
    queryKey: ["upcomingPayables", companyId, days],
    enabled: !!companyId,
    queryFn: async (): Promise<UpcomingEntry[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("payable_entries")
        .select("id, supplier_name, due_date, amount, paid_amount, status")
        .eq("company_id", companyId!)
        .gte("due_date", today)
        .lte("due_date", end)
        .order("due_date", { ascending: true })
        .limit(8);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        nome: r.supplier_name ?? "—",
        venc: shortDateBR(String(r.due_date)),
        valor: Number(r.amount ?? 0) - Number(r.paid_amount ?? 0),
        status: String(r.status ?? "previsto"),
      }));
    },
  });
}

export function useUpcomingReceivables(companyId: string | null | undefined, days = 14) {
  return useQuery({
    queryKey: ["upcomingReceivables", companyId, days],
    enabled: !!companyId,
    queryFn: async (): Promise<UpcomingEntry[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("receivable_entries")
        .select("id, customer_name, due_date, amount, received_amount, status")
        .eq("company_id", companyId!)
        .gte("due_date", today)
        .lte("due_date", end)
        .order("due_date", { ascending: true })
        .limit(8);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        nome: r.customer_name ?? "—",
        venc: shortDateBR(String(r.due_date)),
        valor: Number(r.amount ?? 0) - Number(r.received_amount ?? 0),
        status: String(r.status ?? "previsto"),
      }));
    },
  });
}

export interface AlertItem {
  level: "ok" | "info" | "warn" | "error";
  title: string;
  description: string;
}

export function useAlerts(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["alerts", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<AlertItem[]> => {
      const alerts: AlertItem[] = [];

      const [unclassifiedRes, syncRes, batchRes] = await Promise.all([
        supabase
          .from("financial_entries")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("is_classified", false),
        supabase
          .from("omie_sync_errors")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .eq("resolved", false),
        supabase
          .from("omie_raw_sync_batches")
          .select("status, started_at")
          .eq("company_id", companyId!)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const unclassified = unclassifiedRes.count ?? 0;
      if (unclassified > 0) {
        alerts.push({
          level: unclassified > 50 ? "error" : "warn",
          title: `${unclassified} lançamentos sem classificação`,
          description: "Pendentes de mapeamento DE-PARA. Acesse Admin para revisar.",
        });
      }
      const syncErrors = syncRes.count ?? 0;
      if (syncErrors > 0) {
        alerts.push({
          level: "error",
          title: `${syncErrors} erros de sincronização OMIE`,
          description: "Verifique os logs em Admin → Integrações.",
        });
      }
      const batch = batchRes.data as { status?: string; started_at?: string } | null;
      if (batch?.status === "completed" || batch?.status === "success") {
        alerts.push({
          level: "ok",
          title: "Última sincronização OMIE concluída",
          description: batch.started_at ? new Date(batch.started_at).toLocaleString("pt-BR") : "",
        });
      } else if (batch?.status === "error" || batch?.status === "failed") {
        alerts.push({
          level: "error",
          title: "Última sincronização OMIE falhou",
          description: "Reexecute em Admin → Integrações.",
        });
      }
      if (alerts.length === 0) {
        alerts.push({
          level: "ok",
          title: "Tudo certo por aqui",
          description: "Sem alertas pendentes no momento.",
        });
      }
      return alerts;
    },
  });
}

export interface BudgetVsActual {
  categoria: string;
  orcado: number;
  realizado: number;
}

export function useBudgetVsActual(companyId: string | null | undefined, period: string) {
  return useQuery({
    queryKey: ["budgetVsActual", companyId, period],
    enabled: !!companyId,
    queryFn: async (): Promise<BudgetVsActual[]> => {
      const range = periodToRange(period);
      const [budgetRes, dreRes] = await Promise.all([
        supabase
          .from("budget_entries")
          .select("managerial_account, amount, reference_period")
          .eq("company_id", companyId!)
          .gte("reference_period", range.start)
          .lte("reference_period", range.end),
        supabase
          .from("dre_base")
          .select("dre_group, amount_signed")
          .eq("company_id", companyId!)
          .gte("competence_date", range.start)
          .lte("competence_date", range.end),
      ]);
      const map = new Map<string, BudgetVsActual>();
      for (const b of budgetRes.data ?? []) {
        const key = String(b.managerial_account);
        const e = map.get(key) ?? { categoria: key, orcado: 0, realizado: 0 };
        e.orcado += Number(b.amount ?? 0);
        map.set(key, e);
      }
      for (const d of dreRes.data ?? []) {
        const key = String(d.dre_group);
        const e = map.get(key) ?? { categoria: key, orcado: 0, realizado: 0 };
        e.realizado += Math.abs(Number(d.amount_signed ?? 0));
        map.set(key, e);
      }
      return [...map.values()].slice(0, 6);
    },
  });
}
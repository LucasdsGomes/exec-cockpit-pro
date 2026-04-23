import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealth {
  counts: Record<string, number>;
  last_sync_at: string | null;
  last_sync_batch: {
    source_endpoint: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    processed_records: number | null;
    total_records: number | null;
  } | null;
  last_kpi_snapshot: string | null;
  last_balance_projection: string | null;
  unmapped_categories: { category_raw: string; count: number }[];
}

export function useSystemHealth(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["systemHealth", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<SystemHealth> => {
      const { data, error } = await supabase.rpc("system_health", { _company: companyId! });
      if (error) throw error;
      return data as unknown as SystemHealth;
    },
  });
}

export interface CronJob {
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  last_status: string | null;
  last_run: string | null;
}

export function useCronJobs() {
  return useQuery({
    queryKey: ["cronJobs"],
    queryFn: async (): Promise<CronJob[]> => {
      const { data, error } = await supabase.rpc("list_cron_jobs");
      if (error) return [];
      return (data ?? []) as CronJob[];
    },
  });
}

export function useBackfillBalance(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (days: number = 30) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const today = new Date();
      let ok = 0;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const { error } = await supabase.rpc("compute_balance_projection", {
          _company: companyId,
          _date: iso,
        });
        if (!error) ok++;
      }
      return { processed: ok, days };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balance", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
    },
  });
}

export function useMirrorApAr(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("mirror_payables_receivables", {
        _company: companyId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useBackfillRefs(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("backfill_company_refs", {
        _company: companyId,
      });
      if (error) throw error;
      return data as {
        reprocess: { payloads_processed: number; entries_updated: number };
        propagate: Record<string, number>;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
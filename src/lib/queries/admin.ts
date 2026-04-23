import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SyncBatch {
  id: string;
  source_endpoint: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_records: number | null;
  processed_records: number | null;
  error_records: number | null;
}

export function useSyncBatches(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["syncBatches", companyId],
    enabled: !!companyId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<SyncBatch[]> => {
      const { data } = await supabase
        .from("omie_raw_sync_batches")
        .select("id, source_endpoint, status, started_at, finished_at, total_records, processed_records, error_records")
        .eq("company_id", companyId!)
        .order("started_at", { ascending: false })
        .limit(20);
      return (data ?? []) as SyncBatch[];
    },
  });
}

export interface SyncLog {
  id: string;
  level: string;
  message: string;
  source_endpoint: string | null;
  created_at: string;
}

export function useSyncLogs(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["syncLogs", companyId],
    enabled: !!companyId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<SyncLog[]> => {
      const { data } = await supabase
        .from("omie_sync_logs")
        .select("id, level, message, source_endpoint, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as SyncLog[];
    },
  });
}

export interface CategoryMappingRow {
  id: string;
  omie_category_code: string;
  omie_category_description: string | null;
  dre_category: string | null;
  dfc_category: string | null;
  flow_type: string | null;
  active: boolean;
}

export function useCategoryMappings(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["categoryMappings", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CategoryMappingRow[]> => {
      const { data } = await supabase
        .from("category_mapping")
        .select("id, omie_category_code, omie_category_description, dre_category, dfc_category, flow_type, active")
        .eq("company_id", companyId!)
        .order("omie_category_code", { ascending: true });
      return (data ?? []) as CategoryMappingRow[];
    },
  });
}

export interface InitialBalanceRow {
  id: string;
  account_label: string | null;
  balance_type: string;
  amount: number;
  reference_date: string;
  bank_account_id: string | null;
}

export function useInitialBalances(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["initialBalances", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<InitialBalanceRow[]> => {
      const { data } = await supabase
        .from("initial_balances")
        .select("id, account_label, balance_type, amount, reference_date, bank_account_id")
        .eq("company_id", companyId!)
        .order("reference_date", { ascending: false });
      return (data ?? []) as InitialBalanceRow[];
    },
  });
}

export interface UnclassifiedEntry {
  id: string;
  competence_date: string;
  description: string | null;
  amount_signed: number;
  category_raw: string | null;
  supplier_name: string | null;
  customer_name: string | null;
}

export function useUnclassifiedEntries(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["unclassifiedEntries", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<UnclassifiedEntry[]> => {
      const { data } = await supabase
        .from("financial_entries")
        .select("id, competence_date, description, amount_signed, category_raw, supplier_name, customer_name")
        .eq("company_id", companyId!)
        .eq("is_classified", false)
        .order("competence_date", { ascending: false })
        .limit(50);
      return (data ?? []).map((r) => ({
        ...r,
        amount_signed: Number(r.amount_signed ?? 0),
      })) as UnclassifiedEntry[];
    },
  });
}

export function useTriggerSync(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syncBatches", companyId] });
      qc.invalidateQueries({ queryKey: ["syncLogs", companyId] });
    },
  });
}

export function useReclassify(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("run_full_pipeline", {
        _company: companyId,
        _date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
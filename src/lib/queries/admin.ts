import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------- Initial balances mutations ----------

export interface InitialBalanceInput {
  account_label: string;
  balance_type: string;
  amount: number;
  reference_date: string;
  bank_account_id?: string | null;
  notes?: string | null;
}

export function useUpsertInitialBalance(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InitialBalanceInput & { id?: string }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const payload = {
        company_id: companyId,
        account_label: input.account_label,
        balance_type: input.balance_type,
        amount: input.amount,
        reference_date: input.reference_date,
        bank_account_id: input.bank_account_id ?? null,
        notes: input.notes ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from("initial_balances").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("initial_balances").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initialBalances", companyId] });
      qc.invalidateQueries({ queryKey: ["balance", companyId] });
    },
  });
}

export function useDeleteInitialBalance(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("initial_balances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initialBalances", companyId] });
      qc.invalidateQueries({ queryKey: ["balance", companyId] });
    },
  });
}

// ---------- Manual entries (ajustes) ----------

export interface ManualEntryRow {
  id: string;
  description: string;
  reason: string;
  entry_kind: string;
  amount_signed: number;
  reference_date: string;
  dre_group: string | null;
  active: boolean;
}

export function useManualEntries(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["manualEntries", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<ManualEntryRow[]> => {
      const { data } = await supabase
        .from("manual_entries")
        .select("id, description, reason, entry_kind, amount_signed, reference_date, dre_group, active")
        .eq("company_id", companyId!)
        .order("reference_date", { ascending: false })
        .limit(100);
      return (data ?? []).map((r) => ({ ...r, amount_signed: Number(r.amount_signed ?? 0) })) as ManualEntryRow[];
    },
  });
}

export interface ManualEntryInput {
  description: string;
  reason: string;
  entry_kind: string; // 'ajuste_dre' | 'ajuste_caixa' | etc.
  amount: number; // positive
  direction: "entrada" | "saida";
  reference_date: string;
  dre_group?: string | null;
}

export function useCreateManualEntry(companyId: string | null | undefined, userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualEntryInput) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      if (!userId) throw new Error("Usuário não autenticado");
      const signed = input.direction === "saida" ? -Math.abs(input.amount) : Math.abs(input.amount);
      const { error } = await supabase.from("manual_entries").insert({
        company_id: companyId,
        description: input.description,
        reason: input.reason,
        entry_kind: input.entry_kind,
        amount: Math.abs(input.amount),
        amount_signed: signed,
        reference_date: input.reference_date,
        dre_group: input.dre_group ?? null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manualEntries", companyId] }),
  });
}

// ---------- Manual parameters ----------

export interface ManualParameterRow {
  id: string;
  param_key: string;
  param_value: number | null;
  param_text: string | null;
  reference_period: string | null;
  notes: string | null;
}

export function useManualParameters(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["manualParameters", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<ManualParameterRow[]> => {
      const { data } = await supabase
        .from("manual_parameters")
        .select("id, param_key, param_value, param_text, reference_period, notes")
        .eq("company_id", companyId!)
        .order("param_key");
      return (data ?? []) as ManualParameterRow[];
    },
  });
}

export function useUpsertManualParameter(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; param_key: string; param_value?: number | null; param_text?: string | null; reference_period?: string | null; notes?: string | null }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const payload = {
        company_id: companyId,
        param_key: input.param_key,
        param_value: input.param_value ?? null,
        param_text: input.param_text ?? null,
        reference_period: input.reference_period ?? null,
        notes: input.notes ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from("manual_parameters").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("manual_parameters").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manualParameters", companyId] }),
  });
}

// ---------- Budget (orçamento) ----------

export interface BudgetCsvRow {
  reference_period: string; // YYYY-MM-DD
  managerial_account: string;
  amount: number;
  category_mapped?: string | null;
}

export function useUploadBudget(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: BudgetCsvRow[]) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      if (!rows.length) throw new Error("Nenhuma linha para importar");
      const payload = rows.map((r) => ({
        company_id: companyId,
        reference_period: r.reference_period,
        managerial_account: r.managerial_account,
        amount: r.amount,
        category_mapped: r.category_mapped ?? null,
        scenario: "orcado" as const,
      }));
      const { error } = await supabase.from("budget_entries").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgetEntries", companyId] }),
  });
}

export interface BudgetEntryRow {
  id: string;
  reference_period: string;
  managerial_account: string;
  amount: number;
  category_mapped: string | null;
  scenario: string;
}

export function useBudgetEntries(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["budgetEntries", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BudgetEntryRow[]> => {
      const { data } = await supabase
        .from("budget_entries")
        .select("id, reference_period, managerial_account, amount, category_mapped, scenario")
        .eq("company_id", companyId!)
        .order("reference_period", { ascending: false })
        .limit(500);
      return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount ?? 0) })) as BudgetEntryRow[];
    },
  });
}

// ---------- existing exports below ----------

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

export interface BankAccountLite {
  id: string;
  name: string;
  bank_name: string | null;
}

export function useBankAccounts(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["bankAccounts", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BankAccountLite[]> => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("name");
      return (data ?? []) as BankAccountLite[];
    },
  });
}

export function useSeedInitialBalances(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("seed_initial_balances_from_bank_accounts", {
        _company: companyId,
        _reference_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      return data as { inserted: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initialBalances", companyId] });
    },
  });
}

export function useBatchUpdateInitialBalances(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; amount: number }[]) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      for (const u of updates) {
        const { error } = await supabase
          .from("initial_balances")
          .update({ amount: u.amount })
          .eq("id", u.id);
        if (error) throw error;
      }
      // Recompute balance projection for today
      const today = new Date().toISOString().slice(0, 10);
      await supabase.rpc("compute_balance_projection", { _company: companyId, _date: today });
      await supabase.rpc("snapshot_kpis", { _company: companyId, _date: today });
      return updates.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initialBalances", companyId] });
      qc.invalidateQueries({ queryKey: ["balance", companyId] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
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
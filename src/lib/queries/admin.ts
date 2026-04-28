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
    mutationFn: async (
      arg: BudgetCsvRow[] | { rows: BudgetCsvRow[]; scenario?: BudgetScenario },
    ) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const rows = Array.isArray(arg) ? arg : arg.rows;
      const scenario: BudgetScenario = (Array.isArray(arg) ? "orcado" : (arg.scenario ?? "orcado"));
      if (!rows.length) throw new Error("Nenhuma linha para importar");
      const payload = rows.map((r) => ({
        company_id: companyId,
        reference_period: r.reference_period,
        managerial_account: r.managerial_account,
        amount: r.amount,
        category_mapped: r.category_mapped ?? null,
        scenario,
      }));
      const { error } = await supabase.from("budget_entries").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgetEntries", companyId] }),
  });
}

export type BudgetScenario = "orcado" | "reprojetado" | "realizado";

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

export function useUpdateCategoryMapping(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; dre_category?: string | null; dfc_category?: string | null }) => {
      const patch: { dre_category?: string | null; dfc_category?: string | null } = {};
      if ("dre_category" in params) patch.dre_category = params.dre_category ?? null;
      if ("dfc_category" in params) patch.dfc_category = params.dfc_category ?? null;
      const { error } = await supabase.from("category_mapping").update(patch).eq("id", params.id);
      if (error) throw error;
      return { id: params.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categoryMappings", companyId] });
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

// ---------- Cost center assignment rules ----------

export interface CostCenterRuleRow {
  id: string;
  rule_name: string;
  match_type: "category" | "supplier" | "customer" | "description";
  match_pattern: string;
  cost_center_id: string;
  priority: number;
  active: boolean;
}

export function useCostCenterRules(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["costCenterRules", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CostCenterRuleRow[]> => {
      const { data, error } = await supabase
        .from("cost_center_assign_rules")
        .select("id, rule_name, match_type, match_pattern, cost_center_id, priority, active")
        .eq("company_id", companyId!)
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CostCenterRuleRow[];
    },
  });
}

export function useUpsertCostCenterRule(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CostCenterRuleRow> & {
      rule_name: string;
      match_type: CostCenterRuleRow["match_type"];
      match_pattern: string;
      cost_center_id: string;
    }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const payload = {
        company_id: companyId,
        rule_name: input.rule_name,
        match_type: input.match_type,
        match_pattern: input.match_pattern,
        cost_center_id: input.cost_center_id,
        priority: input.priority ?? 100,
        active: input.active ?? true,
      };
      if (input.id) {
        const { error } = await supabase.from("cost_center_assign_rules").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cost_center_assign_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["costCenterRules", companyId] }),
  });
}

export function useDeleteCostCenterRule(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_center_assign_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["costCenterRules", companyId] }),
  });
}

export function useApplyCostCenterRules(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("apply_cost_center_rules", { _company: companyId });
      if (error) throw error;
      return data as { entries_updated: number; dre_updated: number };
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useReconcileBankMovements(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("reconcile_bank_movements", { _company: companyId });
      if (error) throw error;
      return data as { matched: number };
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useSyncBankStatements(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      arg: number | { lookbackDays?: number; bankAccountId?: string | null } = 90,
    ) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const lookbackDays = typeof arg === "number" ? arg : (arg.lookbackDays ?? 90);
      const bankAccountId = typeof arg === "number" ? null : (arg.bankAccountId ?? null);
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          lookbackDays,
          mode: "incremental",
          endpoints: ["movimentacoes_bancarias"],
          bankAccountId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syncBatches", companyId] });
      qc.invalidateQueries({ queryKey: ["syncLogs", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
      qc.invalidateQueries({ queryKey: ["bankAccountsStatus", companyId] });
    },
  });
}

export function useSyncLancamentosCC(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      arg: number | { lookbackDays?: number; bankAccountId?: string | null } = 90,
    ) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const lookbackDays = typeof arg === "number" ? arg : (arg.lookbackDays ?? 90);
      const bankAccountId = typeof arg === "number" ? null : (arg.bankAccountId ?? null);
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          lookbackDays,
          mode: "incremental",
          endpoints: ["lancamentos_cc"],
          bankAccountId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        totals?: { inserted: number; updated: number; errors: number };
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syncBatches", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
      qc.invalidateQueries({ queryKey: ["bankMovementsSummary", companyId] });
    },
  });
}

export function usePairBankTransfers(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("pair_bank_transfers", { _company: companyId });
      if (error) throw error;
      return data as { paired: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bankMovementsSummary", companyId] }),
  });
}

export function useBankMovementsSummary(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["bankMovementsSummary", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("bank_movements")
        .select("kind, direction, amount, reconciled, transfer_pair_id, movement_date")
        .eq("company_id", companyId!)
        .gte("movement_date", since);
      if (error) throw error;
      const rows = data ?? [];
      const byKind = (k: string) => rows.filter((r) => r.kind === k);
      const sum = (arr: typeof rows) => arr.reduce((a, r) => a + Number(r.amount ?? 0), 0);
      return {
        total: rows.length,
        extrato: byKind("extrato").length,
        lancCC: byKind("lancamento_cc").length,
        transferencias: byKind("transferencia").length,
        tarifas: byKind("tarifa").length,
        juros: byKind("juros").length,
        rendimentos: byKind("rendimento").length,
        tarifasValor: sum(byKind("tarifa")),
        jurosValor: sum(byKind("juros")),
        rendimentosValor: sum(byKind("rendimento")),
        reconciled: rows.filter((r) => r.reconciled).length,
      };
    },
  });
}

export function useSyncCommercialCommitments(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lookbackDays: number = 90) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          lookbackDays,
          mode: "incremental",
          endpoints: ["pedidos_venda", "ordens_compra"],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        totals?: { inserted: number; updated: number; errors: number };
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syncBatches", companyId] });
      qc.invalidateQueries({ queryKey: ["syncLogs", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
      qc.invalidateQueries({ queryKey: ["commercialCommitments", companyId] });
    },
  });
}

export function useCommercialCommitmentsSummary(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["commercialCommitments", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_commitments")
        .select("kind, status, amount, confidence_pct, linked_financial_entry_id")
        .eq("company_id", companyId!);
      if (error) throw error;
      const rows = data ?? [];
      const open = rows.filter(
        (r) => (r.status === "aberto" || r.status === "parcial") && !r.linked_financial_entry_id,
      );
      const sum = (kind: "pedido_venda" | "ordem_compra") =>
        open
          .filter((r) => r.kind === kind)
          .reduce((acc, r) => acc + Number(r.amount) * Number(r.confidence_pct) / 100, 0);
      return {
        total: rows.length,
        openPedidos: open.filter((r) => r.kind === "pedido_venda").length,
        openOcs: open.filter((r) => r.kind === "ordem_compra").length,
        weightedPedidos: sum("pedido_venda"),
        weightedOcs: sum("ordem_compra"),
      };
    },
  });
}

// ---------- Fiscal documents (NF-e / NFS-e) ----------

export function useSyncFiscalDocuments(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lookbackDays: number = 90) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          lookbackDays,
          mode: "incremental",
          endpoints: ["notas_fiscais_emitidas", "notas_servico_emitidas"],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        totals?: { inserted: number; updated: number; errors: number };
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syncBatches", companyId] });
      qc.invalidateQueries({ queryKey: ["syncLogs", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
      qc.invalidateQueries({ queryKey: ["fiscalDocuments", companyId] });
    },
  });
}

export function useFiscalDocumentsSummary(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["fiscalDocuments", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_documents")
        .select("doc_type, status, amount_net, amount_iss, amount_pis, amount_cofins, amount_icms, competence_date")
        .eq("company_id", companyId!)
        .gte("competence_date", new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));
      if (error) throw error;
      const rows = data ?? [];
      const authorized = rows.filter((r) => r.status === "autorizada");
      const nfe = authorized.filter((r) => r.doc_type === "nfe_emitida");
      const nfse = authorized.filter((r) => r.doc_type === "nfse_emitida");
      const sumNet = (arr: typeof rows) => arr.reduce((a, r) => a + Number(r.amount_net ?? 0), 0);
      const sumTax = (arr: typeof rows) =>
        arr.reduce(
          (a, r) =>
            a +
            Number(r.amount_iss ?? 0) +
            Number(r.amount_pis ?? 0) +
            Number(r.amount_cofins ?? 0) +
            Number(r.amount_icms ?? 0),
          0,
        );
      return {
        nfeCount: nfe.length,
        nfseCount: nfse.length,
        revenueNet90d: sumNet(authorized),
        taxes90d: sumTax(authorized),
      };
    },
  });
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

export interface BankBalanceSnapshot {
  bank_account_id: string;
  snapshot_date: string;
  balance: number;
  blocked: number;
  source: string;
  synced_at: string;
  bank_account_name: string | null;
  bank_account_bank: string | null;
}

/**
 * Returns the latest bank-balance snapshot per account (one row per bank_account).
 * Source of truth when populated by Omie sync.
 */
export function useLatestBankBalances(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["bankBalancesLatest", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BankBalanceSnapshot[]> => {
      const { data } = await supabase
        .from("bank_balances_snapshots")
        .select("bank_account_id, snapshot_date, balance, blocked, source, synced_at, bank_accounts(name, bank_name)")
        .eq("company_id", companyId!)
        .order("snapshot_date", { ascending: false })
        .limit(500);
      const rows = (data ?? []) as Array<{
        bank_account_id: string;
        snapshot_date: string;
        balance: number;
        blocked: number;
        source: string;
        synced_at: string;
        bank_accounts: { name: string | null; bank_name: string | null } | null;
      }>;
      // Keep most recent per account
      const seen = new Set<string>();
      const latest: BankBalanceSnapshot[] = [];
      for (const r of rows) {
        if (seen.has(r.bank_account_id)) continue;
        seen.add(r.bank_account_id);
        latest.push({
          bank_account_id: r.bank_account_id,
          snapshot_date: r.snapshot_date,
          balance: Number(r.balance ?? 0),
          blocked: Number(r.blocked ?? 0),
          source: r.source,
          synced_at: r.synced_at,
          bank_account_name: r.bank_accounts?.name ?? null,
          bank_account_bank: r.bank_accounts?.bank_name ?? null,
        });
      }
      return latest;
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
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

// ---------- B.1 status de extrato por conta bancária ----------

export interface BankAccountStatusRow {
  id: string;
  name: string;
  bank_name: string | null;
  source_record_id: string | null;
  last_movement_date: string | null;
  movement_count: number;
  unreconciled_count: number;
}

export function useBankAccountsStatus(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["bankAccountsStatus", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BankAccountStatusRow[]> => {
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name, source_record_id")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("name");
      const list = accounts ?? [];
      // Aggregate movements per account in one query
      const { data: moves } = await supabase
        .from("bank_movements")
        .select("bank_account_id, movement_date, reconciled")
        .eq("company_id", companyId!);
      const agg = new Map<string, { last: string | null; count: number; un: number }>();
      for (const m of moves ?? []) {
        const k = String(m.bank_account_id);
        const cur = agg.get(k) ?? { last: null, count: 0, un: 0 };
        cur.count += 1;
        if (!m.reconciled) cur.un += 1;
        const d = String(m.movement_date);
        if (!cur.last || d > cur.last) cur.last = d;
        agg.set(k, cur);
      }
      return list.map((a) => {
        const ag = agg.get(a.id) ?? { last: null, count: 0, un: 0 };
        return {
          id: a.id,
          name: a.name,
          bank_name: a.bank_name,
          source_record_id: a.source_record_id,
          last_movement_date: ag.last,
          movement_count: ag.count,
          unreconciled_count: ag.un,
        };
      });
    },
  });
}

// ---------- B.3 Lançamentos sem CC + atribuição em massa ----------

export interface UnassignedEntryRow {
  id: string;
  competence_date: string;
  description: string | null;
  category_raw: string | null;
  category_mapped: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  amount_signed: number;
  direction: "entrada" | "saida";
}

export function useUnassignedCcEntries(
  companyId: string | null | undefined,
  limit = 200,
) {
  return useQuery({
    queryKey: ["unassignedCcEntries", companyId, limit],
    enabled: !!companyId,
    queryFn: async (): Promise<UnassignedEntryRow[]> => {
      const { data } = await supabase
        .from("financial_entries")
        .select(
          "id, competence_date, description, category_raw, category_mapped, supplier_name, customer_name, amount_signed, direction",
        )
        .eq("company_id", companyId!)
        .is("cost_center_id", null)
        .order("competence_date", { ascending: false })
        .limit(limit);
      return (data ?? []).map((r) => ({
        ...r,
        amount_signed: Number(r.amount_signed ?? 0),
      })) as UnassignedEntryRow[];
    },
  });
}

export interface CostCenterLite {
  id: string;
  code: string;
  description: string;
}

export function useCostCenters(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["costCenters", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CostCenterLite[]> => {
      const { data } = await supabase
        .from("cost_centers")
        .select("id, code, description")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("code");
      return (data ?? []) as CostCenterLite[];
    },
  });
}

export function useBulkAssignCostCenter(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entryIds: string[]; costCenterId: string }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      if (!input.entryIds.length) return 0;
      const { error } = await supabase
        .from("financial_entries")
        .update({ cost_center_id: input.costCenterId })
        .in("id", input.entryIds);
      if (error) throw error;
      // Propagate to dre_base
      await supabase
        .from("dre_base")
        .update({ cost_center_id: input.costCenterId })
        .in("source_entry_id", input.entryIds);
      return input.entryIds.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unassignedCcEntries", companyId] });
      qc.invalidateQueries({ queryKey: ["dreLines"] });
    },
  });
}

// ---------- B.5 Importação manual de movimentos bancários (OFX/CSV) ----------

export interface ManualBankMovementInput {
  bank_account_id: string;
  movement_date: string;
  amount: number;
  direction: "entrada" | "saida";
  description?: string | null;
  document_number?: string | null;
  source_record_id?: string | null;
}

export function useImportBankMovements(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ManualBankMovementInput[]) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      if (!rows.length) throw new Error("Nenhuma movimentação para importar");
      const payload = rows.map((r) => ({
        company_id: companyId,
        bank_account_id: r.bank_account_id,
        movement_date: r.movement_date,
        amount: Math.abs(r.amount),
        direction: r.direction,
        description: r.description ?? null,
        document_number: r.document_number ?? null,
        source_record_id: r.source_record_id ?? `manual:${r.bank_account_id}:${r.movement_date}:${Math.random().toString(36).slice(2, 8)}`,
        synced_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("bank_movements").insert(payload);
      if (error) throw error;
      // Try reconciliation immediately
      try {
        await supabase.rpc("reconcile_bank_movements", { _company: companyId });
      } catch {/* non-blocking */}
      return payload.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bankAccountsStatus", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
    },
  });
}
// ---------- Module C: Projects & Tags ----------

export function useSyncProjectsAndTags(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          mode: "incremental",
          endpoints: ["projetos", "tags"],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        totals?: { inserted: number; updated: number; errors: number };
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projectsSummary", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
    },
  });
}

export function useLinkEntriesToProjects(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const { data, error } = await supabase.rpc("link_financial_entries_to_projects", { _company: companyId });
      if (error) throw error;
      return data as { linked: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projectsSummary", companyId] }),
  });
}

export function useProjectsSummary(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["projectsSummary", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [{ count: projectsCount }, { count: tagsCount }, { count: linkedCount }] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId!).eq("active", true),
        supabase.from("tags").select("id", { count: "exact", head: true }).eq("company_id", companyId!).eq("active", true),
        supabase.from("financial_entries").select("id", { count: "exact", head: true }).eq("company_id", companyId!).not("project_id", "is", null),
      ]);
      return {
        projects: projectsCount ?? 0,
        tags: tagsCount ?? 0,
        entriesLinked: linkedCount ?? 0,
      };
    },
  });
}

// ---------- Loans / Financings ----------

export function useSyncLoans(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          mode: "incremental",
          endpoints: ["emprestimos_financiamentos"],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        totals?: { inserted: number; updated: number; errors: number };
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loansSummary", companyId] });
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
      qc.invalidateQueries({ queryKey: ["balance", companyId] });
    },
  });
}

export function useLoansSummary(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["loansSummary", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: balance } = await supabase
        .from("loans_outstanding_balance" as never)
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      const { count: totalLoans } = await supabase
        .from("loans" as never)
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId!);
      const b = (balance ?? {}) as {
        active_loans?: number;
        total_principal?: number;
        total_paid?: number;
        total_outstanding?: number;
        total_interest?: number;
        due_next_30d?: number;
        overdue_amount?: number;
      };
      return {
        totalLoans: totalLoans ?? 0,
        activeLoans: Number(b.active_loans ?? 0),
        totalPrincipal: Number(b.total_principal ?? 0),
        totalPaid: Number(b.total_paid ?? 0),
        totalOutstanding: Number(b.total_outstanding ?? 0),
        totalInterest: Number(b.total_interest ?? 0),
        dueNext30d: Number(b.due_next_30d ?? 0),
        overdueAmount: Number(b.overdue_amount ?? 0),
      };
    },
  });
}

// ---------- Full sync (todos os endpoints, desde o início) ----------

export function useFullSync(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const res = await fetch("/api/public/hooks/omie-sync-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          mode: "full",
          lookbackDays: 3650, // ~10 anos
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        ok: boolean;
        endpoints?: Array<{ key: string; inserted: number; updated: number; errors: number }>;
        totals?: { inserted: number; updated: number; errors: number };
      }>;
    },
    onSuccess: () => {
      // Invalida tudo que depende de dados sincronizados
      qc.invalidateQueries({ queryKey: ["systemHealth", companyId] });
      qc.invalidateQueries({ queryKey: ["balance", companyId] });
      qc.invalidateQueries({ queryKey: ["dre", companyId] });
      qc.invalidateQueries({ queryKey: ["dfc", companyId] });
      qc.invalidateQueries({ queryKey: ["kpis", companyId] });
      qc.invalidateQueries({ queryKey: ["projectsSummary", companyId] });
      qc.invalidateQueries({ queryKey: ["loansSummary", companyId] });
      qc.invalidateQueries({ queryKey: ["fiscalSummary", companyId] });
      qc.invalidateQueries({ queryKey: ["commitmentsSummary", companyId] });
      qc.invalidateQueries({ queryKey: ["bankMovementsSummary", companyId] });
    },
  });
}

// ---------- Yalla Green model import ----------

export function useImportYallaModel(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { scenario?: "orcado" | "reprojetado"; clearExisting?: boolean }) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      const res = await fetch("/api/public/hooks/import-yalla-modelo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companyId,
          scenario: params?.scenario ?? "orcado",
          clearExisting: params?.clearExisting ?? true,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      return res.json() as Promise<{
        ok: boolean;
        source: string;
        company: string;
        scenario: string;
        mapping_rows: number;
        budget_rows: number;
        months: number;
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categoryMappings", companyId] });
      qc.invalidateQueries({ queryKey: ["budgetVsActual", companyId] });
      qc.invalidateQueries({ queryKey: ["budgetEntries", companyId] });
    },
  });
}

// ---------- Previsto x Realizado ----------

export interface BudgetVsActualRow {
  managerial_account: string;
  period: string; // YYYY-MM-DD (first day of month)
  budget: number;
  actual: number;
  variance: number;
  variance_pct: number | null;
}

export function useBudgetVsActual(
  companyId: string | null | undefined,
  opts: { from: string; to: string; scenario?: "orcado" | "reprojetado" },
) {
  return useQuery({
    queryKey: ["budgetVsActual", companyId, opts.from, opts.to, opts.scenario ?? "orcado"],
    enabled: !!companyId,
    queryFn: async (): Promise<BudgetVsActualRow[]> => {
      const scenario = opts.scenario ?? "orcado";
      const [budgetRes, actualRes] = await Promise.all([
        supabase
          .from("budget_entries")
          .select("managerial_account, reference_period, amount")
          .eq("company_id", companyId!)
          .eq("scenario", scenario)
          .gte("reference_period", opts.from)
          .lte("reference_period", opts.to),
        supabase
          .from("dre_base")
          .select("category_mapped, dre_group, dre_subgroup, competence_date, amount_signed")
          .eq("company_id", companyId!)
          .gte("competence_date", opts.from)
          .lte("competence_date", opts.to),
      ]);
      if (budgetRes.error) throw budgetRes.error;
      if (actualRes.error) throw actualRes.error;

      const monthKey = (d: string) => d.slice(0, 7) + "-01";
      type Bucket = { budget: number; actual: number };
      const buckets = new Map<string, Bucket>();
      const key = (acc: string, period: string) => `${acc}::${period}`;

      for (const b of budgetRes.data ?? []) {
        const k = key(b.managerial_account, monthKey(b.reference_period));
        const cur = buckets.get(k) ?? { budget: 0, actual: 0 };
        cur.budget += Number(b.amount ?? 0);
        buckets.set(k, cur);
      }
      for (const a of actualRes.data ?? []) {
        // Match actuals to budget accounts by category_mapped first; fallback to dre_subgroup or dre_group.
        const acc = a.category_mapped ?? a.dre_subgroup ?? a.dre_group;
        if (!acc) continue;
        const k = key(acc, monthKey(a.competence_date));
        const cur = buckets.get(k) ?? { budget: 0, actual: 0 };
        cur.actual += Number(a.amount_signed ?? 0);
        buckets.set(k, cur);
      }

      const rows: BudgetVsActualRow[] = [];
      for (const [k, v] of buckets) {
        const [acc, period] = k.split("::");
        const variance = v.actual - v.budget;
        const variance_pct = v.budget !== 0 ? (variance / Math.abs(v.budget)) * 100 : null;
        rows.push({
          managerial_account: acc,
          period,
          budget: v.budget,
          actual: v.actual,
          variance,
          variance_pct,
        });
      }
      rows.sort((a, b) =>
        a.managerial_account.localeCompare(b.managerial_account) || a.period.localeCompare(b.period),
      );
      return rows;
    },
  });
}

// ---------- Bulk DE-PARA import (XLSX/CSV) ----------

export interface CategoryMapImportRow {
  omie_category_code: string;
  omie_category_description?: string | null;
  dre_category?: string | null;
  dfc_category?: string | null;
  flow_type?: string | null;
}

export function useBulkUpsertCategoryMappings(companyId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CategoryMapImportRow[]) => {
      if (!companyId) throw new Error("Empresa não selecionada");
      if (!rows.length) throw new Error("Nenhuma linha válida na planilha");

      let created = 0;
      let updated = 0;
      let skipped = 0;

      const { data: existing } = await supabase
        .from("category_mapping")
        .select("id, omie_category_code, dre_category, dfc_category, flow_type")
        .eq("company_id", companyId);

      const byCode = new Map(
        (existing ?? []).map((r) => [String(r.omie_category_code).trim(), r]),
      );

      const inserts: Array<Record<string, unknown>> = [];

      for (const r of rows) {
        const code = String(r.omie_category_code ?? "").trim();
        if (!code) {
          skipped += 1;
          continue;
        }
        const flowType = (r.flow_type ?? "").toString().trim().toLowerCase();
        const validFlow = ["operacional", "investimento", "financiamento"].includes(flowType)
          ? flowType
          : null;

        const found = byCode.get(code);
        if (found) {
          const patch: Record<string, unknown> = {};
          if (r.dre_category !== undefined) patch.dre_category = r.dre_category || null;
          if (r.dfc_category !== undefined) patch.dfc_category = r.dfc_category || null;
          if (r.omie_category_description) patch.omie_category_description = r.omie_category_description;
          if (validFlow) patch.flow_type = validFlow;
          if (Object.keys(patch).length === 0) {
            skipped += 1;
            continue;
          }
          const { error } = await supabase.from("category_mapping").update(patch).eq("id", found.id);
          if (error) throw error;
          updated += 1;
        } else {
          inserts.push({
            company_id: companyId,
            omie_category_code: code,
            omie_category_description: r.omie_category_description ?? null,
            dre_category: r.dre_category || null,
            dfc_category: r.dfc_category || null,
            flow_type: validFlow,
            active: true,
          });
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from("category_mapping").insert(inserts);
        if (error) throw error;
        created = inserts.length;
      }

      return { created, updated, skipped, total: rows.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categoryMappings", companyId] });
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GlobalFilters } from "@/lib/filters-context";

export interface BankAccountOpt {
  id: string;
  label: string;
}

export interface CostCenterOpt {
  id: string;
  label: string;
  business_unit: string | null;
}

export function useBankAccountOptions(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["filterBankAccounts", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BankAccountOpt[]> => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name, account_number")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("name");
      return (data ?? []).map((b) => ({
        id: String(b.id),
        label: [b.bank_name, b.name, b.account_number].filter(Boolean).join(" · ") || "Conta",
      }));
    },
  });
}

export function useCostCenterOptions(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["filterCostCenters", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CostCenterOpt[]> => {
      const { data } = await supabase
        .from("cost_centers")
        .select("id, code, description, business_unit")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("description");
      return (data ?? []).map((c) => ({
        id: String(c.id),
        label: c.description ?? c.code ?? "—",
        business_unit: c.business_unit ?? null,
      }));
    },
  });
}

export function useBusinessUnitOptions(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["filterBusinessUnits", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from("cost_centers")
        .select("business_unit")
        .eq("company_id", companyId!)
        .eq("active", true)
        .not("business_unit", "is", null);
      const set = new Set<string>();
      for (const r of data ?? []) {
        if (r.business_unit) set.add(String(r.business_unit));
      }
      return [...set].sort();
    },
  });
}

/**
 * Counts how many financial_entries match the current global filters,
 * for the active company. Used as a "did the filter hit something?" badge.
 */
export function useFilteredEntryCount(
  companyId: string | null | undefined,
  filters: Pick<GlobalFilters, "bankAccountId" | "costCenterId" | "businessUnit">,
) {
  const isDirty = !!filters.bankAccountId || !!filters.costCenterId || !!filters.businessUnit;
  return useQuery({
    queryKey: [
      "filteredEntryCount",
      companyId,
      filters.bankAccountId,
      filters.costCenterId,
      filters.businessUnit,
    ],
    enabled: !!companyId && isDirty,
    queryFn: async (): Promise<number> => {
      let q = supabase
        .from("financial_entries")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId!);
      if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
      if (filters.costCenterId) q = q.eq("cost_center_id", filters.costCenterId);
      if (filters.businessUnit) {
        // business_unit lives on cost_centers; filter by cost_centers in this BU
        const { data: ccs } = await supabase
          .from("cost_centers")
          .select("id")
          .eq("company_id", companyId!)
          .eq("business_unit", filters.businessUnit);
        const ids = (ccs ?? []).map((c) => c.id);
        if (ids.length === 0) return 0;
        q = q.in("cost_center_id", ids);
      }
      const { count } = await q;
      return count ?? 0;
    },
  });
}
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
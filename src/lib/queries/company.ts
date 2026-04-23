import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ActiveCompany {
  id: string;
  name: string;
  slug: string;
}

export function useCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["company", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ActiveCompany | null> => {
      // Try profile.default_company_id first
      const { data: prof } = await supabase
        .from("profiles")
        .select("default_company_id")
        .eq("id", user!.id)
        .maybeSingle();

      let companyId = prof?.default_company_id ?? null;

      if (!companyId) {
        // Fallback: first role
        const { data: roles } = await supabase
          .from("user_roles" as never)
          .select("company_id")
          .limit(1);
        const r = roles as { company_id: string }[] | null;
        companyId = r?.[0]?.company_id ?? null;
      }
      if (!companyId) return null;

      const { data: co } = await supabase
        .from("companies")
        .select("id, name, slug")
        .eq("id", companyId)
        .maybeSingle();
      return (co as ActiveCompany) ?? null;
    },
  });
}
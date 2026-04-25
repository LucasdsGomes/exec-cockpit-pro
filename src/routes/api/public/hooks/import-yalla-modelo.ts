// Imports the Yalla Green managerial model into category_mapping + budget_entries.
// Body: { companyId: string, scenario?: "orcado"|"reprojetado", clearExisting?: boolean }
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import plan from "@/integrations/yalla-green/plan.json";
import type { Database } from "@/integrations/supabase/types";

type BudgetScenario = Database["public"]["Enums"]["budget_scenario"];

interface PlanAccount {
  level1_code: number | null;
  level1_name: string | null;
  level2_code: number | null;
  level2_name: string | null;
  category: string;
  view: "dre" | "dfc";
}
interface BudgetRow {
  managerial_account: string;
  period: string; // YYYY-MM-DD
  amount: number;
}
interface PlanFile {
  source: string;
  company: string;
  dre_accounts: PlanAccount[];
  dfc_accounts: PlanAccount[];
  budget: BudgetRow[];
}

const PLAN = plan as PlanFile;

export const Route = createFileRoute("/api/public/hooks/import-yalla-modelo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expectedAnon || auth !== `Bearer ${expectedAnon}`) {
          return json({ error: "Unauthorized" }, 401);
        }
        let body: { companyId?: string; scenario?: BudgetScenario; clearExisting?: boolean } = {};
        try { body = await request.json(); } catch { /* empty */ }
        if (!body.companyId) return json({ error: "companyId required" }, 400);

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return json({ error: "Server misconfigured" }, 500);
        const sb = createClient<Database>(url, key, { auth: { persistSession: false } });

        const scenario: BudgetScenario = body.scenario ?? "orcado";
        const companyId = body.companyId;

        // 1) Build category_mapping rows from DRE + DFC accounts merged by `category`.
        const byCat = new Map<string, { dre?: PlanAccount; dfc?: PlanAccount }>();
        for (const a of PLAN.dre_accounts) {
          const e = byCat.get(a.category) ?? {};
          e.dre = a;
          byCat.set(a.category, e);
        }
        for (const a of PLAN.dfc_accounts) {
          const e = byCat.get(a.category) ?? {};
          e.dfc = a;
          byCat.set(a.category, e);
        }

        const mappingRows = [...byCat.entries()].map(([cat, e]) => {
          const dreL1 = e.dre?.level1_name ?? null;
          const dreL2 = e.dre?.level2_name ?? null;
          const dfcL1 = e.dfc?.level1_name ?? null;
          // Use the category code (e.g. "1.1.NewCo") as omie_category_code so that the
          // user can later edit it. Insert with stub values for OMIE side.
          return {
            company_id: companyId,
            omie_category_code: cat,
            omie_category_description: cat,
            dre_category: dreL1,
            dre_subcategory: dreL2,
            dfc_category: dfcL1,
            dfc_subcategory: e.dfc?.level2_name ?? null,
            managerial_group_1: dreL1 ?? dfcL1,
            managerial_group_2: dreL2,
            affects_dre: !!e.dre,
            affects_cash: !!e.dfc,
            affects_balance: true,
            active: true,
            notes: `Yalla Green model import (${PLAN.source})`,
          };
        });

        // Upsert by (company_id, omie_category_code). DB has a unique index? Use manual delete+insert keyed by code from this source.
        const codes = mappingRows.map((r) => r.omie_category_code);
        // Only delete previously imported Yalla rows (those whose notes start with the marker).
        // Safe approach: filter on code list to avoid touching real Omie codes.
        const { error: delMapErr } = await sb
          .from("category_mapping")
          .delete()
          .eq("company_id", companyId)
          .in("omie_category_code", codes);
        if (delMapErr) return json({ error: `delete category_mapping: ${delMapErr.message}` }, 500);

        const { error: insMapErr } = await sb.from("category_mapping").insert(mappingRows);
        if (insMapErr) return json({ error: `insert category_mapping: ${insMapErr.message}` }, 500);

        // 2) Budget entries — replace this scenario for accounts in the plan.
        const accounts = [...new Set(PLAN.budget.map((b) => b.managerial_account))];
        if (body.clearExisting !== false) {
          const { error: delBudErr } = await sb
            .from("budget_entries")
            .delete()
            .eq("company_id", companyId)
            .eq("scenario", scenario)
            .in("managerial_account", accounts);
          if (delBudErr) return json({ error: `delete budget_entries: ${delBudErr.message}` }, 500);
        }

        const budgetRows = PLAN.budget.map((b) => ({
          company_id: companyId,
          scenario,
          managerial_account: b.managerial_account,
          reference_period: b.period,
          amount: b.amount,
          notes: `Yalla Green v5 (faturamento NF)`,
        }));

        // Insert in chunks of 500 to keep payload small.
        let inserted = 0;
        for (let i = 0; i < budgetRows.length; i += 500) {
          const chunk = budgetRows.slice(i, i + 500);
          const { error: insBudErr } = await sb.from("budget_entries").insert(chunk);
          if (insBudErr) return json({ error: `insert budget_entries: ${insBudErr.message}` }, 500);
          inserted += chunk.length;
        }

        return json({
          ok: true,
          source: PLAN.source,
          company: PLAN.company,
          scenario,
          mapping_rows: mappingRows.length,
          budget_rows: inserted,
          months: [...new Set(PLAN.budget.map((b) => b.period))].length,
        });
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
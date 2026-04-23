// Server functions for OMIE integration: trigger sync, ping, classify entries,
// reprocess periods, manage sync preferences. All require auth + company admin/finance/controller.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runOmieSync, pingOmie } from "@/integrations/omie/sync.server";
import { OMIE_PRIORITY_ORDER, type OmieEndpointKey } from "@/integrations/omie/endpoints";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertCanEdit(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("can_edit_company", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: insufficient permissions for this company");
}

export const triggerOmieSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      endpoints: z.array(z.string()).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      mode: z.enum(["incremental", "full", "reprocess"]).default("incremental"),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanEdit(supabase, data.companyId);
    const result = await runOmieSync({
      companyId: data.companyId,
      endpoints: data.endpoints as OmieEndpointKey[] | undefined,
      startDate: data.startDate,
      endDate: data.endDate,
      triggeredBy: userId,
      mode: data.mode,
    });
    return result;
  });

export const pingOmieConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.companyId);
    return pingOmie();
  });

export const classifyEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      entryId: z.string().uuid(),
      companyId: z.string().uuid(),
      categoryMapping: z.object({
        omieCategoryCode: z.string().min(1).max(64),
        dreCategory: z.string().min(1).max(120).optional(),
        dfcCategory: z.string().min(1).max(120).optional(),
        flowType: z.enum(["operacional", "investimento", "financiamento"]).optional(),
        affectsDre: z.boolean().default(true),
        affectsCash: z.boolean().default(true),
        affectsBalance: z.boolean().default(true),
      }).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.companyId);
    if (data.categoryMapping) {
      const m = data.categoryMapping;
      // Upsert mapping rule for this raw category
      await supabaseAdmin.from("category_mapping").upsert([{
        company_id: data.companyId,
        omie_category_code: m.omieCategoryCode,
        dre_category: m.dreCategory ?? null,
        dfc_category: m.dfcCategory ?? null,
        flow_type: m.flowType ?? null,
        affects_dre: m.affectsDre,
        affects_cash: m.affectsCash,
        affects_balance: m.affectsBalance,
        active: true,
      }], { onConflict: "company_id,omie_category_code" });
    }
    const { data: ok, error } = await supabaseAdmin.rpc("classify_financial_entry", { _entry_id: data.entryId });
    if (error) throw new Error(error.message);
    return { classified: !!ok };
  });

export const reprocessPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanEdit(supabase, data.companyId);
    return runOmieSync({
      companyId: data.companyId,
      startDate: data.startDate,
      endDate: data.endDate,
      endpoints: ["contas_pagar", "contas_receber", "movimentacoes_bancarias"],
      triggeredBy: userId,
      mode: "reprocess",
    });
  });

export const reclassifyAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      onlyUnclassified: z.boolean().default(true),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.companyId);
    const { data: count, error } = await supabaseAdmin.rpc("reclassify_company", {
      _company: data.companyId,
      _only_unclassified: data.onlyUnclassified,
    });
    if (error) throw new Error(error.message);
    return { classified: (count as number | null) ?? 0 };
  });

export const getSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [batches, errors, logs, queueCount, prefs] = await Promise.all([
      supabase
        .from("omie_raw_sync_batches")
        .select("id, source_endpoint, status, processed_records, total_records, error_records, started_at, finished_at")
        .eq("company_id", data.companyId)
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("omie_sync_errors")
        .select("id, source_endpoint, error_message, error_code, created_at, resolved")
        .eq("company_id", data.companyId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("omie_sync_logs")
        .select("id, level, message, source_endpoint, created_at")
        .eq("company_id", data.companyId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("financial_entries")
        .select("id", { count: "exact", head: true })
        .eq("company_id", data.companyId)
        .eq("is_classified", false),
      supabase
        .from("sync_preferences")
        .select("daily_sync_enabled, daily_sync_hour, incremental_mode, lookback_days, last_full_sync_at, last_incremental_sync_at")
        .eq("company_id", data.companyId)
        .maybeSingle(),
    ]);

    // Aggregate per-endpoint status from latest batch
    const seen = new Set<string>();
    const perEndpoint: Array<{ endpoint: string; status: string; finished_at: string | null; processed: number; errors: number }> = [];
    for (const b of batches.data ?? []) {
      if (seen.has(b.source_endpoint)) continue;
      seen.add(b.source_endpoint);
      perEndpoint.push({
        endpoint: b.source_endpoint,
        status: b.status,
        finished_at: b.finished_at,
        processed: b.processed_records ?? 0,
        errors: b.error_records ?? 0,
      });
    }

    return {
      batches: batches.data ?? [],
      errors: errors.data ?? [],
      logs: logs.data ?? [],
      perEndpoint,
      unclassifiedCount: queueCount.count ?? 0,
      preferences: prefs.data ?? null,
      availableEndpoints: OMIE_PRIORITY_ORDER,
    };
  });

export const listUnclassifiedQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ companyId: z.string().uuid(), limit: z.number().min(1).max(200).default(50) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("v_unclassified_queue")
      .select("id, competence_date, due_date, cash_date, amount_signed, direction, description, category_raw, customer_name, supplier_name, source_endpoint")
      .eq("company_id", data.companyId)
      .order("competence_date", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const updateSyncPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      dailySyncEnabled: z.boolean().optional(),
      dailySyncHour: z.number().int().min(0).max(23).optional(),
      incrementalMode: z.boolean().optional(),
      lookbackDays: z.number().int().min(1).max(365).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.companyId);
    const patch: Record<string, unknown> = { company_id: data.companyId };
    if (data.dailySyncEnabled !== undefined) patch.daily_sync_enabled = data.dailySyncEnabled;
    if (data.dailySyncHour !== undefined) patch.daily_sync_hour = data.dailySyncHour;
    if (data.incrementalMode !== undefined) patch.incremental_mode = data.incrementalMode;
    if (data.lookbackDays !== undefined) patch.lookback_days = data.lookbackDays;
    const { error } = await supabaseAdmin
      .from("sync_preferences")
      .upsert([patch as never], { onConflict: "company_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("companies")
      .select("id, name, slug, active")
      .order("name");
    if (error) throw new Error(error.message);
    return { companies: data ?? [] };
  });
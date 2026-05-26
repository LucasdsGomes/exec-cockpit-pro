// Real-time sync trigger called by pg_cron every 10 minutes.
// Runs an INCREMENTAL sync (lookback ~2 days) for every company that has
// `sync_preferences.daily_sync_enabled = true`. Also closes any zombie
// batches that are stuck in `running`/`pending` for > 30 minutes.
//
// Auth: same pattern as the other public hooks — Bearer SUPABASE_PUBLISHABLE_KEY.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runOmieSync } from "@/integrations/omie/sync.server";

const REALTIME_LOOKBACK_DAYS = 2;
const OVERLAP_GUARD_MINUTES = 8; // skip if a sync started in the last 8 min

export const Route = createFileRoute("/api/public/hooks/omie-sync-realtime")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expectedAnon || auth !== `Bearer ${expectedAnon}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 1) Always close zombie batches first (idempotent, cheap).
        const { data: zombieResult } = await supabaseAdmin.rpc("close_zombie_sync_batches", {
          _max_age_minutes: 30,
        });
        const closedZombies = Array.isArray(zombieResult) && zombieResult[0]
          ? Number((zombieResult[0] as { closed_count?: number }).closed_count ?? 0)
          : 0;

        // 2) List companies eligible for real-time sync.
        const { data: prefs, error } = await supabaseAdmin
          .from("sync_preferences")
          .select("company_id, daily_sync_enabled")
          .eq("daily_sync_enabled", true);
        if (error) {
          return new Response(JSON.stringify({ error: error.message, closedZombies }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const triggered: string[] = [];
        const skipped: Array<{ companyId: string; reason: string }> = [];

        for (const p of prefs ?? []) {
          // Overlap guard: skip if a sync started recently for this company.
          const since = new Date(Date.now() - OVERLAP_GUARD_MINUTES * 60_000).toISOString();
          const { count } = await supabaseAdmin
            .from("omie_raw_sync_batches")
            .select("id", { head: true, count: "exact" })
            .eq("company_id", p.company_id)
            .in("status", ["running", "pending"])
            .gte("started_at", since);
          if ((count ?? 0) > 0) {
            skipped.push({ companyId: p.company_id, reason: "already_running" });
            continue;
          }

          const today = new Date();
          const start = new Date(today.getTime() - REALTIME_LOOKBACK_DAYS * 86_400_000);
          // Fire-and-forget per company to keep the cron call fast.
          void runOmieSync({
            companyId: p.company_id,
            startDate: start.toISOString().slice(0, 10),
            endDate: today.toISOString().slice(0, 10),
            triggeredBy: null,
            mode: "incremental",
          }).catch((e) => {
            console.error(`[omie-sync-realtime] sync failed for ${p.company_id}:`, e);
          });
          triggered.push(p.company_id);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            ranAt: new Date().toISOString(),
            closedZombies,
            triggered: triggered.length,
            skipped: skipped.length,
            details: { triggered, skipped },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
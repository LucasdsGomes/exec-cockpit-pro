// Public cron endpoint called by pg_cron daily.
// Iterates over companies whose sync_preferences enable daily sync at the current hour,
// triggers an incremental run for each, and returns a summary.
// Security: shared HMAC token via OMIE_CRON_SECRET, plus internal logic stays minimal.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runOmieSync } from "@/integrations/omie/sync.server";

export const Route = createFileRoute("/api/public/hooks/omie-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expectedAnon || auth !== `Bearer ${expectedAnon}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        const nowHour = new Date().getUTCHours();
        const { data: prefs, error } = await supabaseAdmin
          .from("sync_preferences")
          .select("company_id, daily_sync_enabled, daily_sync_hour, incremental_mode, lookback_days")
          .eq("daily_sync_enabled", true);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const targets = (prefs ?? []).filter((p) => Number(p.daily_sync_hour) === nowHour);
        const results: Array<{ companyId: string; ok: boolean; totals?: unknown; error?: string }> = [];
        for (const p of targets) {
          try {
            const today = new Date();
            const start = new Date(today.getTime() - (p.lookback_days ?? 7) * 86_400_000);
            const r = await runOmieSync({
              companyId: p.company_id,
              startDate: start.toISOString().slice(0, 10),
              endDate: today.toISOString().slice(0, 10),
              triggeredBy: null,
              mode: p.incremental_mode ? "incremental" : "full",
            });
            results.push({ companyId: p.company_id, ok: r.ok, totals: r.totals });
          } catch (e) {
            results.push({ companyId: p.company_id, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }

        return new Response(JSON.stringify({ ranAt: new Date().toISOString(), processed: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
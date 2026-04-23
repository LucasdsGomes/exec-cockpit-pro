// Manual one-shot sync trigger. Authorized via SUPABASE_PUBLISHABLE_KEY bearer.
// Body: { companyId: string, lookbackDays?: number, mode?: "incremental"|"full", endpoints?: string[] }
import { createFileRoute } from "@tanstack/react-router";
import { runOmieSync } from "@/integrations/omie/sync.server";
import type { OmieEndpointKey } from "@/integrations/omie/endpoints";

export const Route = createFileRoute("/api/public/hooks/omie-sync-now")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expectedAnon || auth !== `Bearer ${expectedAnon}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        let body: { companyId?: string; lookbackDays?: number; mode?: "incremental" | "full"; endpoints?: OmieEndpointKey[] } = {};
        try { body = await request.json(); } catch { /* empty body */ }
        if (!body.companyId) {
          return new Response(JSON.stringify({ error: "companyId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const today = new Date();
        const start = new Date(today.getTime() - (body.lookbackDays ?? 90) * 86_400_000);
        try {
          const r = await runOmieSync({
            companyId: body.companyId,
            startDate: start.toISOString().slice(0, 10),
            endDate: today.toISOString().slice(0, 10),
            triggeredBy: null,
            mode: body.mode ?? "full",
            endpoints: body.endpoints,
          });
          return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
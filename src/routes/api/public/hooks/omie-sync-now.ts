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
        let body: { companyId?: string; lookbackDays?: number; mode?: "incremental" | "full"; endpoints?: OmieEndpointKey[]; bankAccountId?: string | null } = {};
        try { body = await request.json(); } catch { /* empty body */ }
        if (!body.companyId) {
          return new Response(JSON.stringify({ error: "companyId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const today = new Date();
        const start = new Date(today.getTime() - (body.lookbackDays ?? 90) * 86_400_000);
        // Fire-and-forget: o sync demora minutos e estoura o timeout do gateway (504).
        // Disparamos em background e respondemos 202 imediatamente — a UI acompanha
        // o progresso via omie_raw_sync_batches / omie_sync_logs.
        void runOmieSync({
          companyId: body.companyId,
          startDate: start.toISOString().slice(0, 10),
          endDate: today.toISOString().slice(0, 10),
          triggeredBy: null,
          mode: body.mode ?? "full",
          endpoints: body.endpoints,
          bankAccountId: body.bankAccountId ?? null,
        }).catch((e) => {
          console.error("[omie-sync-now] background sync failed:", e);
        });
        return new Response(
          JSON.stringify({ ok: true, accepted: true, message: "Sincronização iniciada em background" }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
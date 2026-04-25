import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, RefreshCw, Plug, AlertTriangle, FileWarning, Loader2, DownloadCloud } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { BRL } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/lib/queries/company";
import {
  useSyncBatches,
  useSyncLogs,
  useCategoryMappings,
  useUnclassifiedEntries,
  useTriggerSync,
  useReclassify,
  useFullSync,
} from "@/lib/queries/admin";
import { InitialBalancesTab } from "@/components/admin/InitialBalancesTab";
import { ManualEntriesTab } from "@/components/admin/ManualEntriesTab";
import { ParametersTab } from "@/components/admin/ParametersTab";
import { BudgetTab } from "@/components/admin/BudgetTab";
import { DiagnosticoTab } from "@/components/admin/DiagnosticoTab";
import { CostCenterRulesTab } from "@/components/admin/CostCenterRulesTab";
import { UnassignedEntriesTab } from "@/components/admin/UnassignedEntriesTab";
import { PrevistoRealizadoTab } from "@/components/admin/PrevistoRealizadoTab";
import { PlanoContasTab } from "@/components/admin/PlanoContasTab";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin" },
      { name: "description", content: "Status de integrações, DE-PARA, orçamento, ajustes manuais e fila de classificação." },
    ],
  }),
  component: AdminPage,
});

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function AdminPage() {
  const { data: company } = useCompany();
  const cid = company?.id;

  const batches = useSyncBatches(cid);
  const logs = useSyncLogs(cid);
  const mappings = useCategoryMappings(cid);
  const unclassified = useUnclassifiedEntries(cid);
  const triggerSync = useTriggerSync(cid);
  const reclassify = useReclassify(cid);
  const fullSync = useFullSync(cid);

  const handleSync = () => {
    toast.promise(triggerSync.mutateAsync(), {
      loading: "Sincronizando últimos 7 dias...",
      success: "Sincronização concluída",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleFullSync = () => {
    if (!confirm("Isso vai recarregar TODOS os endpoints da Omie desde o início (~10 anos). Pode demorar vários minutos. Continuar?")) return;
    toast.promise(fullSync.mutateAsync(), {
      loading: "Sincronização completa em andamento (pode levar minutos)…",
      success: (r) => {
        const t = r.totals;
        return `Sync completa · ${t?.inserted ?? 0} novos, ${t?.updated ?? 0} atualizados`;
      },
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleReclassify = () => {
    toast.promise(reclassify.mutateAsync(), {
      loading: "Reprocessando classificações e KPIs...",
      success: "Pipeline executado",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const lastByEndpoint = useMemo(() => {
    const map = new Map<string, NonNullable<typeof batches.data>[number]>();
    for (const b of batches.data ?? []) {
      if (!map.has(b.source_endpoint)) map.set(b.source_endpoint, b);
    }
    return [...map.entries()];
  }, [batches.data]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Configurações</div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight mt-1">Administração</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {company?.name ?? "—"} · Sincronização Omie, plano de contas e ajustes
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleFullSync} disabled={fullSync.isPending} className="gap-2">
            {fullSync.isPending ? <Loader2 className="size-4 animate-spin" /> : <DownloadCloud className="size-4" />}
            Sincronizar tudo
          </Button>
          <Button onClick={handleSync} disabled={triggerSync.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {triggerSync.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sincronizar agora
          </Button>
        </div>
      </header>

      <Tabs defaultValue="integracoes">
        <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto tabs-scroll h-auto flex-nowrap">
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="plano">Plano de Contas ({mappings.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="saldos">Saldos iniciais</TabsTrigger>
          <TabsTrigger value="ccrules">Centro de Custo</TabsTrigger>
          <TabsTrigger value="semcc">Sem CC</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="previsto">Previsto x Realizado</TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="fila">Fila ({unclassified.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
        </TabsList>

        <TabsContent value="integracoes" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plug className="size-4 text-primary" /> OMIE — Conexão
                </CardTitle>
                <Badge variant="outline" className="border-success/40 text-success bg-success/10">Conectado</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Empresa" value={company?.name ?? "—"} />
                <Field label="Slug" value={company?.slug ?? "—"} />
                <Field label="Base URL" value="https://app.omie.com.br/api/v1/" />
                <p className="text-xs text-muted-foreground">
                  Credenciais armazenadas como secrets. Use <strong>Sincronizar agora</strong> (últimos 7 dias) ou <strong>Sincronizar tudo</strong> (full reload). O cron diário também roda automaticamente.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-base">Status dos endpoints</CardTitle></CardHeader>
              <CardContent>
                {batches.isLoading ? (
                  <Skeleton className="h-32" />
                ) : lastByEndpoint.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum batch executado ainda.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {lastByEndpoint.map(([endpoint, b]) => (
                      <div key={endpoint} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2 text-sm">
                          {b.status === "success" || b.status === "completed" ? (
                            <CheckCircle2 className="size-4 text-success" />
                          ) : b.status === "running" || b.status === "pending" ? (
                            <Loader2 className="size-4 text-primary animate-spin" />
                          ) : (
                            <AlertTriangle className="size-4 text-warning" />
                          )}
                          <span className="font-mono text-xs">{endpoint}</span>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {fmtDateTime(b.finished_at ?? b.started_at)}
                          {(b.error_records ?? 0) > 0 && (
                            <span className="text-warning ml-2">{b.error_records} erros</span>
                          )}
                          {b.processed_records != null && (
                            <span className="ml-2">· {b.processed_records}/{b.total_records ?? "?"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Logs recentes</CardTitle></CardHeader>
            <CardContent>
              {logs.isLoading ? (
                <Skeleton className="h-56" />
              ) : (logs.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem logs.</p>
              ) : (
                <pre className="text-xs font-mono bg-background border border-border rounded-md p-3 overflow-auto max-h-72 text-muted-foreground leading-relaxed">
                  {(logs.data ?? [])
                    .map((l) => `[${fmtDateTime(l.created_at)}] ${l.level.toUpperCase().padEnd(5)} ${l.source_endpoint ?? "-"} — ${l.message}`)
                    .join("\n")}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plano" className="mt-4">
          <PlanoContasTab companyId={cid} />
        </TabsContent>

        <TabsContent value="saldos" className="mt-4">
          <InitialBalancesTab companyId={cid} />
        </TabsContent>

        <TabsContent value="ccrules" className="mt-4">
          <CostCenterRulesTab companyId={cid} />
        </TabsContent>

        <TabsContent value="semcc" className="mt-4">
          <UnassignedEntriesTab companyId={cid} />
        </TabsContent>

        <TabsContent value="orcamento" className="mt-4">
          <BudgetTab companyId={cid} />
        </TabsContent>

        <TabsContent value="previsto" className="mt-4">
          <PrevistoRealizadoTab companyId={cid} />
        </TabsContent>

        <TabsContent value="ajustes" className="mt-4">
          <ManualEntriesTab companyId={cid} />
        </TabsContent>

        <TabsContent value="parametros" className="mt-4">
          <ParametersTab companyId={cid} />
        </TabsContent>

        <TabsContent value="fila" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileWarning className="size-4 text-warning" /> Pendentes de classificação
              </CardTitle>
              <Button size="sm" variant="outline" onClick={handleReclassify} disabled={reclassify.isPending}>
                Reprocessar todos
              </Button>
            </CardHeader>
            <CardContent>
              {unclassified.isLoading ? (
                <Skeleton className="h-32" />
              ) : (unclassified.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem lançamentos pendentes 🎉</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2.5">Data</th>
                      <th className="py-2.5">Histórico</th>
                      <th className="py-2.5">Categoria OMIE</th>
                      <th className="py-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(unclassified.data ?? []).map((f) => (
                      <tr key={f.id} className="border-b border-border/60">
                        <td className="py-2 text-xs">{f.competence_date}</td>
                        <td className="py-2 max-w-md truncate">
                          {f.description ?? f.supplier_name ?? f.customer_name ?? "—"}
                        </td>
                        <td className="py-2 text-xs font-mono text-muted-foreground">{f.category_raw ?? "—"}</td>
                        <td className={`py-2 text-right tabular-nums ${f.amount_signed < 0 ? "text-destructive" : "text-success"}`}>
                          {BRL(f.amount_signed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostico" className="mt-4">
          <DiagnosticoTab companyId={cid} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <Input value={value} readOnly className="bg-input/60 border-border font-mono text-xs" />
    </div>
  );
}

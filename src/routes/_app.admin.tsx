import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  RefreshCw,
  Plug,
  AlertTriangle,
  Loader2,
  DownloadCloud,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useCompany } from "@/lib/queries/company";
import {
  useSyncBatches,
  useSyncLogs,
  useTriggerSync,
  useFullSync,
} from "@/lib/queries/admin";
import { ManualEntriesTab } from "@/components/admin/ManualEntriesTab";
import { ParametersTab } from "@/components/admin/ParametersTab";
import { CostCenterRulesTab } from "@/components/admin/CostCenterRulesTab";
import { PlanoContasTab } from "@/components/admin/PlanoContasTab";
import { SaldosOrcamentoTab } from "@/components/admin/SaldosOrcamentoTab";
import { SaudeDosDadosCard } from "@/components/admin/SaudeDosDadosCard";
import { DiagnosticoTab } from "@/components/admin/DiagnosticoTab";
import { SyncErrorsPanel } from "@/components/admin/SyncErrorsPanel";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin" },
      { name: "description", content: "Sincronização Omie, plano de contas, saldos e ajustes." },
    ],
  }),
  component: AdminPage,
});

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const FULL_SYNC_TOTAL = 17; // OMIE_PRIORITY_ORDER count
const FULL_SYNC_KEY = (cid: string) => `omie:fullSyncStartedAt:${cid}`;

function AdminPage() {
  const { data: company } = useCompany();
  const cid = company?.id;

  const batches = useSyncBatches(cid);
  const logs = useSyncLogs(cid);
  const triggerSync = useTriggerSync(cid);
  const fullSync = useFullSync(cid);

  const [activeTab, setActiveTab] = useState("sync");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fullSyncStartedAt, setFullSyncStartedAt] = useState<number | null>(null);
  const hasActiveSync = (batches.data ?? []).some((b) => b.status === "running" || b.status === "pending");

  useEffect(() => {
    if (!cid) return;
    const raw = localStorage.getItem(FULL_SYNC_KEY(cid));
    setFullSyncStartedAt(raw ? Number(raw) : null);
  }, [cid]);

  const fullSyncProgress = useMemo(() => {
    if (!fullSyncStartedAt) return null;
    const since = (batches.data ?? []).filter(
      (b) => new Date(b.started_at).getTime() >= fullSyncStartedAt - 5_000,
    );
    const done = new Set(
      since
        .filter((b) => ["success", "completed", "error", "failed"].includes(b.status))
        .map((b) => b.source_endpoint),
    );
    const running = since.find((b) => b.status === "running" || b.status === "pending");
    const completed = Math.min(done.size, FULL_SYNC_TOTAL);
    const pct = Math.min(100, Math.round((completed / FULL_SYNC_TOTAL) * 100));
    const hasRecentActivity = since.length > 0;
    const stalled = !running && hasRecentActivity && pct < 100;
    return {
      completed,
      total: FULL_SYNC_TOTAL,
      pct,
      currentEndpoint: running?.source_endpoint ?? null,
      stalled,
      hasRecentActivity,
    };
  }, [fullSyncStartedAt, batches.data]);

  useEffect(() => {
    if (!cid || !fullSyncProgress || fullSyncProgress.pct < 100) return;
    const t = setTimeout(() => {
      localStorage.removeItem(FULL_SYNC_KEY(cid));
      setFullSyncStartedAt(null);
    }, 5_000);
    return () => clearTimeout(t);
  }, [cid, fullSyncProgress]);

  const handleSync = () => {
    toast.promise(triggerSync.mutateAsync(), {
      loading: "Disparando sincronização...",
      success: "Sincronização iniciada — acompanhe o progresso abaixo",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleFullSync = () => {
    if (!confirm("Isso vai recarregar TODOS os endpoints da Omie desde o início (~10 anos). Pode demorar vários minutos. Continuar?")) return;
    const ts = Date.now();
    toast.promise(
      fullSync.mutateAsync().then((r) => {
        if (cid) localStorage.setItem(FULL_SYNC_KEY(cid), String(ts));
        setFullSyncStartedAt(ts);
        return r;
      }),
      {
        loading: "Disparando sincronização completa…",
        success: "Sync completa iniciada — acompanhe o progresso abaixo",
        error: (e) => `Erro: ${e.message}`,
      },
    );
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
          <Button variant="outline" onClick={handleFullSync} disabled={fullSync.isPending || hasActiveSync} className="gap-2">
            {fullSync.isPending ? <Loader2 className="size-4 animate-spin" /> : <DownloadCloud className="size-4" />}
            Sincronizar tudo
          </Button>
          <Button onClick={handleSync} disabled={triggerSync.isPending || hasActiveSync} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {triggerSync.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sincronizar agora
          </Button>
        </div>
      </header>

      {fullSyncProgress && fullSyncProgress.hasRecentActivity && (
        <Card className="bg-card border-border">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 font-medium">
                {fullSyncProgress.stalled ? (
                  <AlertTriangle className="size-4 text-warning" />
                ) : (
                  <Loader2 className="size-4 text-primary animate-spin" />
                )}
                {fullSyncProgress.stalled ? "Sincronização completa sem atividade recente" : "Sincronização completa em andamento"}
              </div>
              <div className="tabular-nums text-muted-foreground">
                {fullSyncProgress.completed}/{fullSyncProgress.total} endpoints
                <span className="ml-3 text-foreground font-semibold">{fullSyncProgress.pct}%</span>
                <span className="ml-2 text-xs">({100 - fullSyncProgress.pct}% restante)</span>
              </div>
            </div>
            <Progress value={fullSyncProgress.pct} className="h-2" />
            {fullSyncProgress.currentEndpoint && (
              <div className="text-xs text-muted-foreground font-mono">
                Processando: {fullSyncProgress.currentEndpoint}
              </div>
            )}
            {fullSyncProgress.stalled && (
              <div className="text-xs text-warning">
                Nenhum lote está em execução agora. Se o progresso não avançar, dispare novamente apenas o endpoint com erro.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto tabs-scroll h-auto flex-nowrap">
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="plano">Plano de Contas</TabsTrigger>
          <TabsTrigger value="saldos">Saldos & Orçamento</TabsTrigger>
        </TabsList>

        {/* === 1. SINCRONIZAÇÃO === */}
        <TabsContent value="sync" className="mt-4 space-y-4">
          <SaudeDosDadosCard companyId={cid} onGoToPlano={() => setActiveTab("plano")} />

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
                  <div className="divide-y divide-border max-h-72 overflow-auto">
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

          <SyncErrorsPanel companyId={cid} />

          {/* === AVANÇADO === colapsado por padrão */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Card className="bg-card border-border">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                    <Settings2 className="size-4" /> Avançado
                    <span className="text-xs font-normal">(diagnóstico, regras, ajustes manuais, parâmetros)</span>
                  </CardTitle>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Tabs defaultValue="diagnostico" className="space-y-4">
                    <TabsList className="bg-background border border-border">
                      <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
                      <TabsTrigger value="ccrules">Regras de CC</TabsTrigger>
                      <TabsTrigger value="ajustes">Ajustes manuais</TabsTrigger>
                      <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
                    </TabsList>
                    <TabsContent value="diagnostico">
                      <DiagnosticoTab companyId={cid} />
                    </TabsContent>
                    <TabsContent value="ccrules">
                      <CostCenterRulesTab companyId={cid} />
                    </TabsContent>
                    <TabsContent value="ajustes">
                      <ManualEntriesTab companyId={cid} />
                    </TabsContent>
                    <TabsContent value="parametros">
                      <ParametersTab companyId={cid} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        {/* === 2. PLANO DE CONTAS === */}
        <TabsContent value="plano" className="mt-4">
          <PlanoContasTab companyId={cid} />
        </TabsContent>

        {/* === 3. SALDOS & ORÇAMENTO === */}
        <TabsContent value="saldos" className="mt-4">
          <SaldosOrcamentoTab companyId={cid} />
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

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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
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

function AdminPage() {
  const { data: company } = useCompany();
  const cid = company?.id;

  const batches = useSyncBatches(cid);
  const logs = useSyncLogs(cid);
  const triggerSync = useTriggerSync(cid);
  const fullSync = useFullSync(cid);

  const [activeTab, setActiveTab] = useState("sync");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleSync = () => {
    toast.promise(triggerSync.mutateAsync(), {
      loading: "Disparando sincronização...",
      success: "Sincronização iniciada — acompanhe o progresso abaixo",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleFullSync = () => {
    if (!confirm("Isso vai recarregar TODOS os endpoints da Omie desde o início (~10 anos). Pode demorar vários minutos. Continuar?")) return;
    toast.promise(fullSync.mutateAsync(), {
      loading: "Disparando sincronização completa…",
      success: "Sync completa iniciada em background — pode levar vários minutos",
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

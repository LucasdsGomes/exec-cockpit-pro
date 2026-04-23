import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, RefreshCw, Plug, AlertTriangle, FileWarning, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
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
} from "@/lib/queries/admin";
import { InitialBalancesTab } from "@/components/admin/InitialBalancesTab";
import { ManualEntriesTab } from "@/components/admin/ManualEntriesTab";
import { ParametersTab } from "@/components/admin/ParametersTab";
import { BudgetTab } from "@/components/admin/BudgetTab";
import { DiagnosticoTab } from "@/components/admin/DiagnosticoTab";

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

  const [filterUnmapped, setFilterUnmapped] = useState(false);

  const handleSync = () => {
    toast.promise(triggerSync.mutateAsync(), {
      loading: "Disparando sincronização OMIE...",
      success: "Sincronização iniciada com sucesso",
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

  const filteredMappings = useMemo(() => {
    const list = mappings.data ?? [];
    return filterUnmapped ? list.filter((m) => !m.dre_category && !m.dfc_category) : list;
  }, [mappings.data, filterUnmapped]);

  const lastByEndpoint = useMemo(() => {
    const map = new Map<string, NonNullable<typeof batches.data>[number]>();
    for (const b of batches.data ?? []) {
      if (!map.has(b.source_endpoint)) map.set(b.source_endpoint, b);
    }
    return [...map.entries()];
  }, [batches.data]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Configurações</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Administração</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {company?.name ?? "—"} · Integrações OMIE, DE-PARA gerencial e ajustes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReclassify} disabled={reclassify.isPending} className="gap-2">
            {reclassify.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Reprocessar
          </Button>
          <Button onClick={handleSync} disabled={triggerSync.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {triggerSync.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sincronizar OMIE
          </Button>
        </div>
      </header>

      <Tabs defaultValue="integracoes">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="depara">DE-PARA ({mappings.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="saldos">Saldos iniciais</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
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
                  Credenciais armazenadas como secrets. Use "Sincronizar OMIE" para iniciar um novo batch.
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

        <TabsContent value="depara" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">DE-PARA: OMIE → gerencial</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={filterUnmapped ? "default" : "outline"}
                  onClick={() => setFilterUnmapped((v) => !v)}
                >
                  Sem mapeamento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mappings.isLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="py-2.5">Código</th>
                        <th className="py-2.5">Descrição OMIE</th>
                        <th className="py-2.5">DRE</th>
                        <th className="py-2.5">DFC</th>
                        <th className="py-2.5">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMappings.map((d) => (
                        <tr key={d.id} className="border-b border-border/60">
                          <td className="py-2 font-mono text-xs">{d.omie_category_code}</td>
                          <td className="py-2">{d.omie_category_description ?? "—"}</td>
                          <td className="py-2">
                            {d.dre_category ? (
                              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">{d.dre_category}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2">
                            {d.dfc_category ? (
                              <Badge variant="outline" className="border-success/30 text-success bg-success/10">{d.dfc_category}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{d.flow_type ?? "—"}</td>
                        </tr>
                      ))}
                      {filteredMappings.length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhuma categoria neste filtro.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saldos" className="mt-4">
          <InitialBalancesTab companyId={cid} />
        </TabsContent>

        <TabsContent value="orcamento" className="mt-4">
          <BudgetTab companyId={cid} />
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
                <table className="w-full text-sm">
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

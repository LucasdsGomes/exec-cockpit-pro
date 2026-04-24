import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CheckCircle2, AlertTriangle, Clock, Database, Loader2, Wrench, Link2, FileText, GitMerge, ShoppingCart, Receipt, Banknote, ArrowLeftRight, FolderKanban, Tag, Landmark } from "lucide-react";
import { useSystemHealth, useCronJobs, useBackfillBalance, useMirrorApAr, useBackfillRefs } from "@/lib/queries/health";
import { useSyncBankStatements, useReconcileBankMovements, useSyncCommercialCommitments, useCommercialCommitmentsSummary, useSyncFiscalDocuments, useFiscalDocumentsSummary, useSyncLancamentosCC, usePairBankTransfers, useBankMovementsSummary, useSyncProjectsAndTags, useLinkEntriesToProjects, useProjectsSummary, useSyncLoans, useLoansSummary } from "@/lib/queries/admin";
import { toast } from "sonner";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const COUNT_LABELS: Record<string, string> = {
  financial_entries: "Lançamentos financeiros",
  unclassified: "Não classificados",
  payable_entries: "Contas a pagar",
  receivable_entries: "Contas a receber",
  dre_base: "DRE (linhas)",
  dfc_realized_base: "DFC realizado",
  dfc_forecast_base: "DFC previsto",
  balance_projection_daily: "Projeção balanço (dias)",
  initial_balances: "Saldos iniciais",
  category_mapping: "DE-PARA ativo",
  alert_rules_active: "Regras de alerta ativas",
};

export function DiagnosticoTab({ companyId }: { companyId: string | null | undefined }) {
  const health = useSystemHealth(companyId);
  const cron = useCronJobs();
  const backfill = useBackfillBalance(companyId);
  const mirror = useMirrorApAr(companyId);
  const refs = useBackfillRefs(companyId);
  const syncStatements = useSyncBankStatements(companyId);
  const reconcile = useReconcileBankMovements(companyId);
  const syncCommitments = useSyncCommercialCommitments(companyId);
  const commitments = useCommercialCommitmentsSummary(companyId);
  const syncFiscal = useSyncFiscalDocuments(companyId);
  const fiscal = useFiscalDocumentsSummary(companyId);
  const syncLancCC = useSyncLancamentosCC(companyId);
  const pairTransfers = usePairBankTransfers(companyId);
  const bmSummary = useBankMovementsSummary(companyId);
  const syncProjects = useSyncProjectsAndTags(companyId);
  const linkProjects = useLinkEntriesToProjects(companyId);
  const projects = useProjectsSummary(companyId);
  const syncLoans = useSyncLoans(companyId);
  const loans = useLoansSummary(companyId);

  const handleBackfill = () => {
    toast.promise(backfill.mutateAsync(30), {
      loading: "Recalculando balanço dos últimos 30 dias...",
      success: (r) => `Balanço recalculado para ${r.processed} dias`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleMirror = () => {
    toast.promise(mirror.mutateAsync(), {
      loading: "Espelhando contas a pagar/receber...",
      success: "Espelhamento concluído",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleBackfillRefs = () => {
    toast.promise(refs.mutateAsync(), {
      loading: "Reprocessando vínculos (banco, fornecedor, cliente)...",
      success: (r) =>
        `Vínculos atualizados em ${r.reprocess.entries_updated} lançamentos · DRE ${r.propagate.dre_base ?? 0}, DFC ${r.propagate.dfc_forecast_base ?? 0}`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleSyncStatements = () => {
    toast.promise(syncStatements.mutateAsync(90), {
      loading: "Sincronizando extratos bancários (últimos 90 dias)…",
      success: "Extratos sincronizados",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleReconcile = () => {
    toast.promise(reconcile.mutateAsync(), {
      loading: "Conciliando movimentos com títulos…",
      success: (r) => `${r.matched} movimento(s) conciliado(s)`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleSyncCommitments = () => {
    toast.promise(syncCommitments.mutateAsync(90), {
      loading: "Sincronizando Pedidos de Venda e Ordens de Compra (últimos 90 dias)…",
      success: (r) =>
        `Compromissos sincronizados · ${r.totals?.inserted ?? 0} novos, ${r.totals?.updated ?? 0} atualizados`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleSyncFiscal = () => {
    toast.promise(syncFiscal.mutateAsync(90), {
      loading: "Sincronizando NF-e e NFS-e emitidas (últimos 90 dias)…",
      success: (r) =>
        `Notas fiscais sincronizadas · ${r.totals?.inserted ?? 0} novas, ${r.totals?.updated ?? 0} atualizadas`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleSyncLancCC = () => {
    toast.promise(syncLancCC.mutateAsync(90), {
      loading: "Sincronizando lançamentos de conta corrente (últimos 90 dias)…",
      success: (r) =>
        `Lançamentos CC sincronizados · ${r.totals?.inserted ?? 0} novos, ${r.totals?.updated ?? 0} atualizados`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handlePairTransfers = () => {
    toast.promise(pairTransfers.mutateAsync(), {
      loading: "Identificando transferências internas…",
      success: (r) => `${r.paired} movimento(s) vinculado(s) como transferência`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleSyncProjects = () => {
    toast.promise(syncProjects.mutateAsync(), {
      loading: "Sincronizando projetos e etiquetas (Omie)…",
      success: (r) =>
        `Projetos & Tags · ${r.totals?.inserted ?? 0} novos, ${r.totals?.updated ?? 0} atualizados`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleLinkProjects = () => {
    toast.promise(linkProjects.mutateAsync(), {
      loading: "Vinculando lançamentos a projetos…",
      success: (r) => `${r.linked} lançamento(s) vinculado(s) a projetos`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleSyncLoans = () => {
    toast.promise(syncLoans.mutateAsync(), {
      loading: "Sincronizando contratos de empréstimo (Omie)…",
      success: (r) =>
        `Empréstimos · ${r.totals?.inserted ?? 0} novos, ${r.totals?.updated ?? 0} atualizados`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  if (health.isLoading) return <Skeleton className="h-96" />;
  const h = health.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Status geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Última sync OMIE" value={fmt(h?.last_sync_at ?? null)} />
            <Row label="Último snapshot KPI" value={h?.last_kpi_snapshot ?? "—"} />
            <Row label="Última projeção de balanço" value={h?.last_balance_projection ?? "—"} />
            <Row
              label="Último batch"
              value={
                h?.last_sync_batch
                  ? `${h.last_sync_batch.source_endpoint} · ${h.last_sync_batch.status} · ${h.last_sync_batch.processed_records ?? 0}/${h.last_sync_batch.total_records ?? "?"}`
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="size-4 text-primary" /> Ações de manutenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={handleMirror} disabled={mirror.isPending} variant="outline" className="w-full justify-start gap-2">
              {mirror.isPending ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
              Espelhar Contas a Pagar / Receber
            </Button>
            <Button onClick={handleBackfillRefs} disabled={refs.isPending} variant="outline" className="w-full justify-start gap-2">
              {refs.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Reprocessar vínculos OMIE (banco / cliente / fornecedor)
            </Button>
            <Button onClick={handleSyncStatements} disabled={syncStatements.isPending} variant="outline" className="w-full justify-start gap-2">
              {syncStatements.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              Sincronizar extratos bancários (OMIE)
            </Button>
            <Button onClick={handleSyncLancCC} disabled={syncLancCC.isPending} variant="outline" className="w-full justify-start gap-2">
              {syncLancCC.isPending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
              Sincronizar Lançamentos de Conta Corrente
            </Button>
            <Button onClick={handlePairTransfers} disabled={pairTransfers.isPending} variant="outline" className="w-full justify-start gap-2">
              {pairTransfers.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
              Identificar transferências internas
            </Button>
            <Button onClick={handleSyncProjects} disabled={syncProjects.isPending} variant="outline" className="w-full justify-start gap-2">
              {syncProjects.isPending ? <Loader2 className="size-4 animate-spin" /> : <FolderKanban className="size-4" />}
              Sincronizar Projetos + Tags (OMIE)
            </Button>
            <Button onClick={handleLinkProjects} disabled={linkProjects.isPending} variant="outline" className="w-full justify-start gap-2">
              {linkProjects.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Vincular lançamentos a projetos
            </Button>
            <Button onClick={handleSyncLoans} disabled={syncLoans.isPending} variant="outline" className="w-full justify-start gap-2">
              {syncLoans.isPending ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
              Sincronizar Empréstimos & Financiamentos (OMIE)
            </Button>
            <Button onClick={handleSyncCommitments} disabled={syncCommitments.isPending} variant="outline" className="w-full justify-start gap-2">
              {syncCommitments.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
              Sincronizar Pedidos de Venda + OCs (OMIE)
            </Button>
            <Button onClick={handleSyncFiscal} disabled={syncFiscal.isPending} variant="outline" className="w-full justify-start gap-2">
              {syncFiscal.isPending ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
              Sincronizar Notas Fiscais (NF-e + NFS-e)
            </Button>
            <Button onClick={handleReconcile} disabled={reconcile.isPending} variant="outline" className="w-full justify-start gap-2">
              {reconcile.isPending ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
              Conciliar movimentos ↔ títulos
            </Button>
            <Button onClick={handleBackfill} disabled={backfill.isPending} variant="outline" className="w-full justify-start gap-2">
              {backfill.isPending ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
              Recalcular balanço (últimos 30 dias)
            </Button>
            <p className="text-xs text-muted-foreground pt-1">
              Use estas ações para forçar uma reconciliação manual fora do cron diário.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderKanban className="size-4 text-primary" /> Projetos & Tags (Omie)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FolderKanban className="size-3" /> Projetos ativos
              </div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(projects.data?.projects ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Tag className="size-3" /> Tags ativas
              </div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(projects.data?.tags ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Lançamentos vinculados</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(projects.data?.entriesLinked ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-3">
            Projetos e Tags são dimensões analíticas independentes do plano de contas. Use para fatiar DRE/DFC por iniciativa, cliente estratégico, ou produto.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="size-4 text-primary" /> Movimentações Bancárias (últimos 90 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Lançamentos CC</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(bmSummary.data?.lancCC ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Transferências internas</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(bmSummary.data?.transferencias ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Tarifas / Juros</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-destructive">
                {((bmSummary.data?.tarifasValor ?? 0) + (bmSummary.data?.jurosValor ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Rendimentos</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-success">
                {(bmSummary.data?.rendimentosValor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-3">
            Transferências internas não geram fluxo (soma zero). Tarifas e juros classificam como Despesas Financeiras; rendimentos como Receitas Financeiras automaticamente.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="size-4 text-primary" /> Compromissos Comerciais (Omie)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pedidos abertos</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(commitments.data?.openPedidos ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">OCs abertas</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(commitments.data?.openOcs ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Entradas previstas (ponderado)</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-success">
                {(commitments.data?.weightedPedidos ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Saídas previstas (ponderado)</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-destructive">
                {(commitments.data?.weightedOcs ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-3">
            Pedidos têm peso de 80% e OCs de 90% na projeção de caixa. Quando viram CR/CP, são automaticamente vinculados e ignorados para evitar dupla contagem.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="size-4 text-primary" /> Notas Fiscais (últimos 90 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">NF-e emitidas</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(fiscal.data?.nfeCount ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">NFS-e emitidas</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(fiscal.data?.nfseCount ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Receita líquida (competência)</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-success">
                {(fiscal.data?.revenueNet90d ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Impostos sobre vendas</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-destructive">
                {(fiscal.data?.taxes90d ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-3">
            A receita por competência aparece no DRE quando você alterna para o regime <strong>Competência</strong> (NF emitida). O regime <strong>Caixa</strong> continua usando o título financeiro.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Contagens por tabela</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(h?.counts ?? {}).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border bg-background/40 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {COUNT_LABELS[k] ?? k}
                </div>
                <div className="text-lg font-semibold tabular-nums mt-0.5">{Number(v).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Categorias OMIE sem mapeamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(h?.unmapped_categories ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" /> Todas as categorias estão mapeadas.
            </p>
          ) : (
            <div className="space-y-1.5">
              {h!.unmapped_categories.map((u) => (
                <div key={u.category_raw} className="flex items-center justify-between text-sm border-b border-border/60 py-1.5">
                  <span className="font-mono text-xs">{u.category_raw}</span>
                  <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
                    {u.count} lançamento{u.count > 1 ? "s" : ""}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Tarefas agendadas (cron)</CardTitle>
        </CardHeader>
        <CardContent>
          {cron.isLoading ? (
            <Skeleton className="h-24" />
          ) : (cron.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum job listado (acesso restrito ou sem cron configurado).</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2">Job</th>
                  <th className="py-2">Agenda</th>
                  <th className="py-2">Última execução</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(cron.data ?? []).map((j) => (
                  <tr key={j.jobname} className="border-b border-border/60">
                    <td className="py-2 font-mono text-xs">{j.jobname}</td>
                    <td className="py-2 font-mono text-xs">{j.schedule}</td>
                    <td className="py-2 text-xs text-muted-foreground">{fmt(j.last_run)}</td>
                    <td className="py-2">
                      {j.last_status === "succeeded" ? (
                        <Badge variant="outline" className="border-success/40 text-success bg-success/10">OK</Badge>
                      ) : j.last_status ? (
                        <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">{j.last_status}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CheckCircle2, AlertTriangle, ShoppingCart, Receipt, Banknote, FolderKanban, Tag, Landmark } from "lucide-react";
import { useSystemHealth, useCronJobs } from "@/lib/queries/health";
import { useCommercialCommitmentsSummary, useFiscalDocumentsSummary, useBankMovementsSummary, useProjectsSummary, useLoansSummary } from "@/lib/queries/admin";

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
  const commitments = useCommercialCommitmentsSummary(companyId);
  const fiscal = useFiscalDocumentsSummary(companyId);
  const bmSummary = useBankMovementsSummary(companyId);
  const projects = useProjectsSummary(companyId);
  const loans = useLoansSummary(companyId);

  if (health.isLoading) return <Skeleton className="h-96" />;
  const h = health.data;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Esta aba é apenas leitura. Use os botões <strong>Sincronizar agora</strong> e <strong>Sincronizar tudo</strong> no topo da página. As ações de pós-processamento (transferências internas, conciliação, vínculos, recálculo de balanço) rodam automaticamente após cada sincronização.
      </div>

      <div className="grid grid-cols-1 gap-4">
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
            <Landmark className="size-4 text-primary" /> Empréstimos & Financiamentos (Omie)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Contratos ativos</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(loans.data?.activeLoans ?? 0).toLocaleString("pt-BR")}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  / {(loans.data?.totalLoans ?? 0).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo devedor</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-destructive">
                {(loans.data?.totalOutstanding ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Vence em 30 dias</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5">
                {(loans.data?.dueNext30d ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Em atraso</div>
              <div className="text-lg font-semibold tabular-nums mt-0.5 text-destructive">
                {(loans.data?.overdueAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-3">
            O saldo devedor das parcelas em aberto é refletido automaticamente na linha "Empréstimos" da Projeção de Balanço, substituindo a entrada manual quando há contratos sincronizados.
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
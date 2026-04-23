import { createFileRoute } from "@tanstack/react-router";
import { useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BRL } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Area, AreaChart, ReferenceLine,
} from "recharts";
import { Download, AlertTriangle, ArrowDownRight, ArrowUpRight, Wallet, Info, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { FUTURE_PRESETS, PERIOD_PRESETS } from "@/components/ui/period-presets";
import { CHART_COLORS, CHART_GRID, CHART_AXIS_TICK, ChartTooltip } from "@/components/ui/chart-primitives";
import { InsightCard } from "@/components/ui/insight-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/lib/queries/company";
import { useCashDaily } from "@/lib/queries/series";
import { useDfcSummary, useDueHeatmap, useCashProjection, useDfcForecastByNature } from "@/lib/queries/dfc";
import { useFilters } from "@/lib/filters-context";
import { downloadCsv } from "@/lib/export-csv";
import { toast } from "sonner";
import { isFuturePreset } from "@/lib/period";

export const Route = createFileRoute("/_app/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Hitech Electric" },
      { name: "description", content: "Projeção forward-looking de caixa, calendário de vencimentos e DFC histórica." },
    ],
  }),
  component: FluxoCaixa,
});

const HORIZON_BY_PRESET: Record<string, number> = {
  next7: 7,
  next30: 30,
  next60: 60,
  next90: 90,
};

function FluxoCaixa() {
  // Default: olhar para frente (30 dias)
  const [period, setPeriod] = useState<string>("next30");
  const { data: company } = useCompany();
  const companyId = company?.id;
  const filters = useFilters();
  const isFuture = isFuturePreset(period);
  const horizonDays = HORIZON_BY_PRESET[period] ?? 30;

  // Forward-looking
  const { data: projection, isLoading: loadingProj } = useCashProjection(
    companyId,
    horizonDays,
    filters,
  );
  const { data: forecastBlocks = [], isLoading: loadingForecast } = useDfcForecastByNature(
    companyId,
    horizonDays,
    filters,
  );

  // Histórico (aba Histórico)
  const { data: dfc, isLoading: loadingDfc } = useDfcSummary(companyId, isFuture ? "30d" : period, filters);
  const { data: caixaDiario = [], isLoading: loadingDaily } = useCashDaily(companyId, isFuture ? "30d" : period, filters);

  // Heatmap próximos 60 dias
  const heatmapDays = Math.min(Math.max(horizonDays, 28), 60);
  const { data: heatmap = [] } = useDueHeatmap(companyId, heatmapDays);

  const exportCsv = () => {
    if (isFuture) {
      if (!projection?.series.length) return;
      downloadCsv(
        projection.series.map((d) => ({
          dia: d.dia,
          entrada: d.entrada,
          saida: d.saida,
          saldo: d.saldo,
        })) as unknown as Record<string, unknown>[],
        `projecao_caixa_${period}`,
        [
          { key: "dia", label: "Dia" },
          { key: "entrada", label: "Entradas previstas" },
          { key: "saida", label: "Saídas previstas" },
          { key: "saldo", label: "Saldo projetado" },
        ],
      );
    } else {
      if (!caixaDiario.length) return;
      downloadCsv(caixaDiario.map((d) => ({ ...d })) as unknown as Record<string, unknown>[], `fluxo_caixa_${period}`, [
        { key: "dia", label: "Dia" },
        { key: "entrada", label: "Entrada" },
        { key: "saida", label: "Saída" },
        { key: "saldo", label: "Saldo" },
      ]);
    }
    toast.success("CSV exportado");
  };

  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Tesouraria"
        title="Fluxo de Caixa"
        description={
          isFuture
            ? `Projeção dos próximos ${horizonDays} dias · baseada em contas a pagar/receber em aberto`
            : "Visão histórica consolidada"
        }
        actions={
          <>
            <CashPeriodPicker value={period} onChange={setPeriod} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
              <Download className="size-3.5" /> Exportar
            </Button>
          </>
        }
      />

      {isFuture ? (
        <ForwardKpis projection={projection} loading={loadingProj} />
      ) : (
        <HistoricalKpis dfc={dfc} />
      )}

      <Tabs defaultValue={isFuture ? "projecao" : "historico"} value={isFuture ? undefined : "historico"}>
        <TabsList className="bg-card border border-border h-9">
          <TabsTrigger value="projecao" disabled={!isFuture}>Projeção</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* PROJEÇÃO ============================================ */}
        <TabsContent value="projecao" className="mt-4 space-y-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Saldo projetado · próximos {horizonDays} dias</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saldo atual + (recebíveis − pagáveis) por data de vencimento
                  </p>
                </div>
                {projection?.saldoMinimoConfig != null && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    Mín. configurado: <span className="text-warning font-medium">{BRL(projection.saldoMinimoConfig)}</span>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-80 pt-2">
              {loadingProj ? <Skeleton className="h-full" /> : !projection || projection.series.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados para projetar.</div>
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={projection.series}>
                    <defs>
                      <linearGradient id="saldo-projecao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="dia" tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.ceil(projection.series.length / 12)} />
                    <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    {projection.saldoMinimoConfig != null && (
                      <ReferenceLine
                        y={projection.saldoMinimoConfig}
                        stroke={CHART_COLORS.negative}
                        strokeDasharray="4 4"
                        label={{ value: `mín. ${BRL(projection.saldoMinimoConfig)}`, fill: CHART_COLORS.negative, fontSize: 10, position: "insideTopRight" }}
                      />
                    )}
                    <ReferenceLine y={0} stroke={CHART_COLORS.negative} strokeOpacity={0.5} />
                    <Tooltip cursor={{ stroke: CHART_GRID }} content={<ChartTooltip formatter={(v: number) => BRL(v)} />} />
                    <Area name="Saldo projetado" dataKey="saldo" stroke={CHART_COLORS.accent} strokeWidth={2.5} fill="url(#saldo-projecao)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {projection && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InsightCard
                level={projection.saldoFinal >= projection.saldoAtual ? "ok" : "warn"}
                title={projection.saldoFinal >= projection.saldoAtual ? "Caixa cresce no horizonte" : "Caixa diminui no horizonte"}
                description={`Variação prevista de ${BRL(projection.saldoFinal - projection.saldoAtual)}.`}
              />
              <InsightCard
                level={projection.minSaldo < 0 ? "error" : projection.saldoMinimoConfig != null && projection.minSaldo < projection.saldoMinimoConfig ? "warn" : "info"}
                title={projection.minSaldoDate ? `Menor saldo em ${new Date(projection.minSaldoDate + "T00:00:00").toLocaleDateString("pt-BR")}` : "Saldo mínimo no horizonte"}
                description={`${BRL(projection.minSaldo)} ${projection.minSaldo < 0 ? "— caixa negativo!" : projection.saldoMinimoConfig != null && projection.minSaldo < projection.saldoMinimoConfig ? "— abaixo do mínimo." : ""}`}
              />
              <InsightCard
                level="info"
                title="Cobertura líquida prevista"
                description={`${BRL(projection.totalEntradas)} entradas vs ${BRL(projection.totalSaidas)} saídas.`}
              />
            </div>
          )}

          <Card className="bg-card border-border surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">DFC Prevista por natureza</CardTitle>
              <p className="text-xs text-muted-foreground">Projeção dos próximos {horizonDays} dias</p>
            </CardHeader>
            <CardContent>
              {loadingForecast ? <Skeleton className="h-32" /> : forecastBlocks.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Sem previsão DFC carregada para o horizonte.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {forecastBlocks.map((b) => (
                      <Fragment key={b.tipo}>
                        <tr>
                          <td colSpan={2} className="pt-4 pb-1.5">
                            <div className="text-eyebrow text-primary">{b.tipo}</div>
                          </td>
                        </tr>
                        {b.itens.map((it) => (
                          <tr key={it.conta} className="border-b border-border/40">
                            <td className="py-2 pl-3 text-muted-foreground">{it.conta}</td>
                            <td className={cn("py-2 text-right tabular-nums", it.valor < 0 ? "text-destructive" : "text-success")}>
                              {BRL(it.valor)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium">Subtotal {b.tipo}</td>
                          <td className={cn("py-2 text-right font-semibold tabular-nums", b.total < 0 ? "text-destructive" : "text-success")}>
                            {BRL(b.total)}
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDÁRIO ============================================ */}
        <TabsContent value="calendario" className="mt-4 space-y-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader className="flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-base">Calendário de vencimentos</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Próximos {heatmapDays} dias</p>
              </div>
              {(() => {
                const max = Math.max(...heatmap.map((h) => h.valor), 0);
                const peaks = heatmap.filter((h) => h.valor > max * 0.7 && max > 0).length;
                if (peaks === 0) return null;
                return (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-warning/10 text-warning border border-warning/30">
                    <AlertTriangle className="size-3" /> {peaks} picos
                  </span>
                );
              })()}
            </CardHeader>
            <CardContent>
              <Heatmap cells={heatmap} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO ============================================ */}
        <TabsContent value="historico" className="mt-4 space-y-4">
          {!isFuture && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SaldoCard label="Saldo inicial" value={BRL(dfc?.saldoInicial ?? 0)} icon={Wallet} />
              <SaldoCard label="Entradas" value={BRL(dfc?.totalEntradas ?? 0)} positive trend={ArrowUpRight} />
              <SaldoCard label="Saídas" value={BRL(dfc?.totalSaidas ?? 0)} negative trend={ArrowDownRight} />
              <SaldoCard label="Saldo final" value={BRL(dfc?.saldoFinal ?? 0)} highlight />
            </div>
          )}
          {isFuture && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-muted-foreground">
                Mostrando histórico dos últimos 30 dias. Para análise retrospectiva detalhada, troque o período acima para um preset passado (7d, 30d, MTD, etc.).
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-card border-border surface-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Saldo diário</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Entradas, saídas e curva de saldo</p>
                  </div>
                  <Legend />
                </div>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                {loadingDaily ? <Skeleton className="h-full" /> : caixaDiario.length === 0 ? (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem movimentações no período.</div>
                ) : (
                <ResponsiveContainer>
                  <ComposedChart data={caixaDiario}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="dia" tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip cursor={{ fill: "oklch(1 0 0 / 4%)" }} content={<ChartTooltip formatter={(v: number) => BRL(v)} />} />
                    <Bar name="Entradas" dataKey="entrada" fill={CHART_COLORS.positive} barSize={5} radius={[2, 2, 0, 0]} />
                    <Bar name="Saídas" dataKey="saida" fill={CHART_COLORS.negative} barSize={5} radius={[2, 2, 0, 0]} />
                    <Line name="Saldo" dataKey="saldo" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border surface-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumo do período</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Líquido vs. saldo final</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo inicial</span><span className="tabular-nums">{BRL(dfc?.saldoInicial ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Entradas</span><span className="tabular-nums text-success">{BRL(dfc?.totalEntradas ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Saídas</span><span className="tabular-nums text-destructive">{BRL(dfc?.totalSaidas ?? 0)}</span></div>
                <div className="border-t border-border pt-2 flex justify-between"><span className="font-medium">Saldo final</span><span className="font-semibold tabular-nums text-primary">{BRL(dfc?.saldoFinal ?? 0)}</span></div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">DFC por natureza</CardTitle>
              <p className="text-xs text-muted-foreground">Operacional, investimento e financiamento</p>
            </CardHeader>
            <CardContent>
              {loadingDfc ? <Skeleton className="h-40" /> : !dfc || dfc.blocos.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Sem movimentações no período.</div>
              ) : (
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-2 font-medium">Saldo inicial</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{BRL(dfc.saldoInicial)}</td>
                  </tr>
                  {dfc.blocos.map((b) => {
                    const subtotal = b.itens.reduce((a, c) => a + c.valor, 0);
                    return (
                      <Fragment key={b.tipo}>
                        <tr>
                          <td colSpan={2} className="pt-5 pb-1.5">
                            <div className="text-eyebrow text-primary">{b.tipo}</div>
                          </td>
                        </tr>
                        {b.itens.map((it) => (
                          <tr key={it.conta} className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors">
                            <td className="py-2 pl-3 text-muted-foreground">{it.conta}</td>
                            <td className={cn("py-2 text-right tabular-nums", it.valor < 0 ? "text-destructive" : "text-success")}>
                              {BRL(it.valor)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b border-border">
                          <td className="py-2 font-medium">Subtotal {b.tipo}</td>
                          <td className={cn("py-2 text-right font-semibold tabular-nums", subtotal < 0 ? "text-destructive" : "text-success")}>
                            {BRL(subtotal)}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  <tr className="bg-primary/[0.06]">
                    <td className="py-3 font-semibold">Saldo final</td>
                    <td className="py-3 text-right font-bold tabular-nums text-primary text-base">{BRL(dfc.saldoFinal)}</td>
                  </tr>
                </tbody>
              </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CashPeriodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <div role="tablist" aria-label="Horizonte" className="inline-flex items-center gap-0.5 rounded-md bg-input/40 border border-primary/30 p-0.5">
        {FUTURE_PRESETS.map((p) => {
          const active = p.v === value;
          return (
            <button key={p.v} role="tab" aria-selected={active} type="button" onClick={() => onChange(p.v)}
              className={cn(
                "px-2.5 h-7 rounded text-[11px] font-medium tabular-nums transition-colors",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}>
              {p.l}
            </button>
          );
        })}
      </div>
      <div role="tablist" aria-label="Histórico" className="inline-flex items-center gap-0.5 rounded-md bg-input/40 border border-border p-0.5">
        {PERIOD_PRESETS.map((p) => {
          const active = p.v === value;
          return (
            <button key={p.v} role="tab" aria-selected={active} type="button" onClick={() => onChange(p.v)}
              className={cn(
                "px-2.5 h-7 rounded text-[11px] font-medium tabular-nums transition-colors",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}>
              {p.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ForwardKpis({ projection, loading }: { projection: ReturnType<typeof useCashProjection>["data"]; loading: boolean }) {
  if (loading || !projection) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }
  const delta = projection.saldoFinal - projection.saldoAtual;
  const deltaPct = projection.saldoAtual !== 0 ? (delta / Math.abs(projection.saldoAtual)) * 100 : undefined;
  const minBelow = projection.saldoMinimoConfig != null && projection.minSaldo < projection.saldoMinimoConfig;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SaldoCard label="Saldo atual" value={BRL(projection.saldoAtual)} icon={Wallet} />
      <SaldoCard label="Entradas previstas" value={BRL(projection.totalEntradas)} positive trend={ArrowUpRight} />
      <SaldoCard label="Saídas previstas" value={BRL(projection.totalSaidas)} negative trend={ArrowDownRight} />
      <SaldoCard
        label="Saldo projetado"
        value={BRL(projection.saldoFinal)}
        highlight
        delta={deltaPct}
        warning={projection.saldoFinal < 0 || minBelow}
        footer={projection.minSaldoDate ? (
          <span className={cn("inline-flex items-center gap-1 text-[11px] tabular-nums", projection.minSaldo < 0 || minBelow ? "text-destructive" : "text-muted-foreground")}>
            <TrendingDown className="size-3" /> Mín. {BRL(projection.minSaldo)} em {new Date(projection.minSaldoDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        ) : null}
      />
    </div>
  );
}

function HistoricalKpis({ dfc }: { dfc: ReturnType<typeof useDfcSummary>["data"] }) {
  const totalEntradas = dfc?.totalEntradas ?? 0;
  const totalSaidas = dfc?.totalSaidas ?? 0;
  const liquido = totalEntradas + totalSaidas;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SaldoCard label="Saldo inicial" value={BRL(dfc?.saldoInicial ?? 0)} icon={Wallet} />
      <SaldoCard label="Entradas" value={BRL(totalEntradas)} positive trend={ArrowUpRight} />
      <SaldoCard label="Saídas" value={BRL(totalSaidas)} negative trend={ArrowDownRight} />
      <SaldoCard label="Saldo final" value={BRL(dfc?.saldoFinal ?? 0)} highlight delta={dfc?.saldoInicial ? (liquido / dfc.saldoInicial) * 100 : undefined} />
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Entradas", color: CHART_COLORS.positive },
    { label: "Saídas", color: CHART_COLORS.negative },
    { label: "Saldo", color: CHART_COLORS.accent },
  ];
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function SaldoCard({
  label, value, positive, negative, highlight, icon: Icon, trend: Trend, delta, warning, footer,
}: {
  label: string; value: string; positive?: boolean; negative?: boolean; highlight?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: React.ComponentType<{ className?: string }>;
  delta?: number;
  warning?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors",
        warning ? "border-destructive/40" : highlight ? "border-primary/30" : "border-border hover:border-border-strong",
      )}
      style={{
        boxShadow: "var(--shadow-card)",
        backgroundImage: highlight && !warning ? "var(--gradient-kpi-accent)" : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-eyebrow truncate">{label}</div>
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {Trend && <Trend className={cn("size-3.5", positive && "text-success", negative && "text-destructive")} />}
      </div>
      <div className={cn(
        "mt-2.5 text-xl font-semibold tabular-nums tracking-tight",
        positive && "text-success",
        negative && "text-destructive",
        highlight && !warning && "text-primary",
        warning && "text-destructive",
      )}>{value}</div>
      {delta !== undefined && (
        <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">{delta >= 0 ? "+" : ""}{delta.toFixed(1)}% no período</div>
      )}
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}

function Heatmap({ cells }: { cells: { dia: number; date: string; valor: number }[] }) {
  if (!cells.length) {
    return <div className="py-6 text-center text-xs text-muted-foreground">Sem vencimentos.</div>;
  }
  const max = Math.max(...cells.map((h) => h.valor), 1);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d) => {
          const intensity = d.valor / max;
          return (
            <div
              key={d.dia}
              title={`${d.date}: ${BRL(d.valor)}`}
              className="aspect-square rounded-md grid place-items-center text-[10px] font-medium tabular-nums cursor-pointer transition-transform hover:scale-105 hover:ring-1 hover:ring-primary"
              style={{
                background: `oklch(0.93 0.18 102 / ${0.06 + intensity * 0.55})`,
                color: intensity > 0.5 ? "oklch(0.15 0 0)" : "oklch(0.92 0.005 95)",
              }}
            >
              {d.dia}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Menor</span>
        <div className="flex gap-0.5">
          {[0.1, 0.25, 0.45, 0.65, 0.85].map((o, i) => (
            <span key={i} className="size-2.5 rounded-sm" style={{ background: `oklch(0.93 0.18 102 / ${o})` }} />
          ))}
        </div>
        <span>Maior</span>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BRL } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Area, AreaChart, ReferenceLine,
} from "recharts";
import { Download, AlertTriangle, ArrowDownRight, ArrowUpRight, Wallet, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { PeriodPresets } from "@/components/ui/period-presets";
import { CHART_COLORS, CHART_GRID, CHART_AXIS_TICK, ChartTooltip } from "@/components/ui/chart-primitives";
import { InsightCard } from "@/components/ui/insight-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/lib/queries/company";
import { useCashDaily } from "@/lib/queries/series";
import { useDfcSummary, useDueHeatmap } from "@/lib/queries/dfc";
import { downloadCsv } from "@/lib/export-csv";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Hitech Electric" },
      { name: "description", content: "DFC realizada e prevista, calendário de vencimentos e projeção de caixa." },
    ],
  }),
  component: FluxoCaixa,
});

function FluxoCaixa() {
  const [period, setPeriod] = useState("30d");
  const { data: company } = useCompany();
  const companyId = company?.id;
  const { data: dfc, isLoading: loadingDfc } = useDfcSummary(companyId, period);
  const { data: caixaDiario = [], isLoading: loadingDaily } = useCashDaily(companyId, period);
  const { data: heatmap = [] } = useDueHeatmap(companyId, 28);

  const totalEntradas = dfc?.totalEntradas ?? 0;
  const totalSaidas = dfc?.totalSaidas ?? 0;
  const liquido = totalEntradas + totalSaidas;

  const exportCsv = () => {
    if (!caixaDiario.length) return;
    downloadCsv(caixaDiario.map((d) => ({ ...d })) as unknown as Record<string, unknown>[], `fluxo_caixa_${period}`, [
      { key: "dia", label: "Dia" },
      { key: "entrada", label: "Entrada" },
      { key: "saida", label: "Saída" },
      { key: "saldo", label: "Saldo" },
    ]);
    toast.success("CSV exportado");
  };

  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Tesouraria"
        title="Fluxo de Caixa"
        description={dfc ? `Visão diária consolidada · ${dfc.isForecast ? "previsão (extratos não sincronizados)" : "realizado"}` : "Carregando…"}
        actions={
          <>
            <PeriodPresets value={period} onChange={setPeriod} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
              <Download className="size-3.5" /> Exportar
            </Button>
          </>
        }
      />

      {dfc?.isForecast && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          <Info className="size-4 text-warning shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-warning">Sincronização de extratos bancários ainda não disponível</div>
            <div className="text-muted-foreground mt-0.5">Mostrando previsão baseada em contas a pagar/receber.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SaldoCard label="Saldo inicial" value={BRL(dfc?.saldoInicial ?? 0)} icon={Wallet} />
        <SaldoCard label="Entradas (mês)" value={BRL(totalEntradas)} positive trend={ArrowUpRight} />
        <SaldoCard label="Saídas (mês)" value={BRL(totalSaidas)} negative trend={ArrowDownRight} />
        <SaldoCard label="Saldo final" value={BRL(dfc?.saldoFinal ?? 0)} highlight delta={dfc?.saldoInicial ? (liquido / dfc.saldoInicial) * 100 : undefined} />
      </div>

      <Tabs defaultValue="realizada">
        <TabsList className="bg-card border border-border h-9">
          <TabsTrigger value="realizada">DFC {dfc?.isForecast ? "Prevista" : "Realizada"}</TabsTrigger>
          <TabsTrigger value="prevista">DFC Prevista</TabsTrigger>
        </TabsList>

        <TabsContent value="realizada" className="mt-4 space-y-4">
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
              <CardHeader className="flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">Vencimentos</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Próximos 28 dias</p>
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
          </div>

          {dfc && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InsightCard level={liquido >= 0 ? "ok" : "warn"} title={liquido >= 0 ? "Geração de caixa positiva" : "Geração de caixa negativa"} description={`Variação de ${BRL(liquido)} no período.`} />
              <InsightCard level="info" title="Saldo final projetado" description={`${BRL(dfc.saldoFinal)} considerando saldo inicial + movimentações.`} />
              <InsightCard level={dfc.isForecast ? "warn" : "ok"} title={dfc.isForecast ? "Dados de previsão" : "Dados realizados"} description={dfc.isForecast ? "Conecte extratos bancários para realizar." : "Conciliação OK."} />
            </div>
          )}

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

        <TabsContent value="prevista" className="mt-4 space-y-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Projeção de caixa · próximos 30 dias</CardTitle>
              <p className="text-xs text-muted-foreground">Baseada em previstos + recorrências</p>
            </CardHeader>
            <CardContent className="h-80 pt-2">
              {caixaDiario.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados para projetar.</div>
              ) : (
              <ResponsiveContainer>
                <AreaChart data={caixaDiario.map(d => ({ ...d, saldo: d.saldo * 1.04 }))}>
                  <defs>
                    <linearGradient id="saldo-prev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="dia" tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <ReferenceLine y={500_000} stroke={CHART_COLORS.negative} strokeDasharray="4 4" label={{ value: "mín. R$ 500k", fill: CHART_COLORS.negative, fontSize: 10, position: "insideTopRight" }} />
                  <Tooltip cursor={{ stroke: CHART_GRID }} content={<ChartTooltip formatter={(v: number) => BRL(v)} />} />
                  <Area name="Saldo previsto" dataKey="saldo" stroke={CHART_COLORS.accent} strokeWidth={2.5} fill="url(#saldo-prev)" />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
  label, value, positive, negative, highlight, icon: Icon, trend: Trend, delta,
}: {
  label: string; value: string; positive?: boolean; negative?: boolean; highlight?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: React.ComponentType<{ className?: string }>;
  delta?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors",
        highlight ? "border-primary/30" : "border-border hover:border-border-strong",
      )}
      style={{
        boxShadow: "var(--shadow-card)",
        backgroundImage: highlight ? "var(--gradient-kpi-accent)" : undefined,
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
        highlight && "text-primary",
      )}>{value}</div>
      {delta !== undefined && (
        <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">{delta >= 0 ? "+" : ""}{delta.toFixed(1)}% no período</div>
      )}
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

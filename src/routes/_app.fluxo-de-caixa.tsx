import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { caixaDiario, dfc, heatmap } from "@/lib/mock-data";
import { BRL } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Area, AreaChart, ReferenceLine,
} from "recharts";
import { Download, AlertTriangle, ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { PeriodPresets } from "@/components/ui/period-presets";
import { CHART_COLORS, CHART_GRID, CHART_AXIS_TICK, ChartTooltip } from "@/components/ui/chart-primitives";
import { InsightCard } from "@/components/ui/insight-card";
import { Fragment } from "react";

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
  const totalEntradas = dfc.blocos.flatMap(b => b.itens).filter(i => i.valor > 0).reduce((a, b) => a + b.valor, 0);
  const totalSaidas = dfc.blocos.flatMap(b => b.itens).filter(i => i.valor < 0).reduce((a, b) => a + b.valor, 0);
  const liquido = totalEntradas + totalSaidas;

  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Tesouraria"
        title="Fluxo de Caixa"
        description="DFC realizada e prevista · 3 contas bancárias · visão diária consolidada."
        actions={
          <>
            <PeriodPresets />
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" /> Exportar
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SaldoCard label="Saldo inicial" value={BRL(dfc.saldoInicial)} icon={Wallet} />
        <SaldoCard label="Entradas (mês)" value={BRL(totalEntradas)} positive trend={ArrowUpRight} />
        <SaldoCard label="Saídas (mês)" value={BRL(totalSaidas)} negative trend={ArrowDownRight} />
        <SaldoCard label="Saldo final" value={BRL(dfc.saldoFinal)} highlight delta={(liquido / dfc.saldoInicial) * 100} />
      </div>

      <Tabs defaultValue="realizada">
        <TabsList className="bg-card border border-border h-9">
          <TabsTrigger value="realizada">DFC Realizada</TabsTrigger>
          <TabsTrigger value="prevista">DFC Prevista</TabsTrigger>
        </TabsList>

        <TabsContent value="realizada" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-card border-border surface-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Saldo diário · 30 dias</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Entradas, saídas e curva de saldo</p>
                  </div>
                  <Legend />
                </div>
              </CardHeader>
              <CardContent className="h-72 pt-2">
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
              </CardContent>
            </Card>

            <Card className="bg-card border-border surface-card">
              <CardHeader className="flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">Vencimentos</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Próximos 28 dias</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-warning/10 text-warning border border-warning/30">
                  <AlertTriangle className="size-3" /> 3 picos
                </span>
              </CardHeader>
              <CardContent>
                <Heatmap />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InsightCard level="warn" title="Pico de pagamento em 30/04" description="Folha + DAS concentrados no mesmo dia (R$ 1,07M)." action={{ label: "Ver calendário" }} />
            <InsightCard level="info" title="Recebíveis concentrados" description="3 clientes respondem por 67% das entradas previstas." />
            <InsightCard level="ok" title="Geração de caixa positiva" description={`Saldo cresceu ${BRL(liquido)} no mês.`} />
          </div>

          <Card className="bg-card border-border surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">DFC por natureza</CardTitle>
              <p className="text-xs text-muted-foreground">Operacional, investimento e financiamento</p>
            </CardHeader>
            <CardContent>
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

function Heatmap() {
  const max = Math.max(...heatmap.map(h => h.valor));
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {heatmap.map((d) => {
          const intensity = d.valor / max;
          return (
            <div
              key={d.dia}
              title={`Dia ${d.dia}: ${BRL(d.valor)}`}
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

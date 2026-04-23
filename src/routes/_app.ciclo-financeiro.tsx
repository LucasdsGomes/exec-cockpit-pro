import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { cicloHist, kpis } from "@/lib/mock-data";
import { Timer, Repeat, Activity } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { BRL } from "@/lib/format";
import { SectionHeader } from "@/components/ui/section-header";
import { CHART_COLORS, CHART_GRID, CHART_AXIS_TICK, ChartTooltip } from "@/components/ui/chart-primitives";
import { InsightCard } from "@/components/ui/insight-card";

export const Route = createFileRoute("/_app/ciclo-financeiro")({
  head: () => ({
    meta: [
      { title: "Ciclo Financeiro — Hitech Electric" },
      { name: "description", content: "PMR, PMP, PME, ciclo operacional e necessidade de capital de giro." },
    ],
  }),
  component: CicloPage,
});

function CicloPage() {
  const ncg = (kpis.cicloFinanceiro / 30) * kpis.receitaLiquida;
  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Capital de giro"
        title="Ciclo Financeiro"
        description="Indicadores operacionais (PMR, PMP, PME) e impacto na necessidade de capital de giro."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="PMR" value={`${kpis.pmr} dias`} delta={3.2} hint="Recebimento" icon={Timer} invertDelta />
        <KpiCard label="PMP" value={`${kpis.pmp} dias`} delta={-1.5} hint="Pagamento" icon={Timer} />
        <KpiCard label="PME" value={`${kpis.pme} dias`} delta={0.8} hint="Estoque" icon={Repeat} invertDelta />
        <KpiCard label="Ciclo Operacional" value={`${kpis.pmr + kpis.pme} dias`} hint="PMR + PME" icon={Activity} invertDelta />
        <KpiCard label="Ciclo Financeiro" value={`${kpis.cicloFinanceiro} dias`} hint="PMR + PME − PMP" icon={Activity} accent invertDelta />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border surface-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Histórico dos indicadores</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos 12 meses</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {[
                  { l: "PMR", c: CHART_COLORS.positive },
                  { l: "PMP", c: CHART_COLORS.negative },
                  { l: "PME", c: CHART_COLORS.neutral },
                  { l: "Ciclo", c: CHART_COLORS.accent },
                ].map((i) => (
                  <span key={i.l} className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ background: i.c }} />
                    {i.l}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-80 pt-2">
            <ResponsiveContainer>
              <LineChart data={cicloHist}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="mes" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}d`} />
                <ReferenceLine y={0} stroke={CHART_GRID} />
                <Tooltip cursor={{ stroke: CHART_GRID }} content={<ChartTooltip formatter={(v: number) => `${v} dias`} />} />
                <Line dataKey="pmr" name="PMR" stroke={CHART_COLORS.positive} strokeWidth={2} dot={false} />
                <Line dataKey="pmp" name="PMP" stroke={CHART_COLORS.negative} strokeWidth={2} dot={false} />
                <Line dataKey="pme" name="PME" stroke={CHART_COLORS.neutral} strokeWidth={2} dot={false} />
                <Line dataKey="ciclo" name="Ciclo" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="bg-card border-border surface-card overflow-hidden relative">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <CardHeader className="pb-2"><CardTitle className="text-base">Necessidade de capital de giro</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums text-primary tracking-tight">{BRL(ncg)}</div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Estimada com base no ciclo financeiro atual ({kpis.cicloFinanceiro} dias) sobre a receita líquida do mês.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-eyebrow">Por dia</div>
                  <div className="font-medium tabular-nums mt-0.5">{BRL(ncg / kpis.cicloFinanceiro)}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-eyebrow">% Receita</div>
                  <div className="font-medium tabular-nums mt-0.5">{((ncg / kpis.receitaLiquida) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <InsightCard level="warn" title="PMR aumentou 3 dias" description="Vs mês anterior — concentração em Construtora Alfa." />
            <InsightCard level="error" title="PMP reduziu 1,5 dias" description="Pressão imediata em caixa. Renegociar prazos." action={{ label: "Ver fornecedores" }} />
            <InsightCard level="info" title="Ajustes manuais de PME" description="Disponíveis em Admin → Ajustes manuais." />
          </div>
        </div>
      </div>
    </div>
  );
}

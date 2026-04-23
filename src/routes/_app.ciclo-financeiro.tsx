import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Timer, Repeat, Activity } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { BRL } from "@/lib/format";
import { SectionHeader } from "@/components/ui/section-header";
import { CHART_COLORS, CHART_GRID, CHART_AXIS_TICK, ChartTooltip } from "@/components/ui/chart-primitives";
import { InsightCard } from "@/components/ui/insight-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/lib/queries/company";
import { useCycleHistory, useCycleMetrics } from "@/lib/queries/cycle";

export const Route = createFileRoute("/_app/ciclo-financeiro")({
  head: () => ({
    meta: [
      { title: "Ciclo Financeiro" },
      { name: "description", content: "PMR, PMP, PME, ciclo operacional e necessidade de capital de giro." },
    ],
  }),
  component: CicloPage,
});

function CicloPage() {
  const { data: company } = useCompany();
  const cid = company?.id;
  const { data: m, isLoading } = useCycleMetrics(cid);
  const { data: hist } = useCycleHistory(cid);

  const pmr = m?.pmr ?? 0;
  const pmp = m?.pmp ?? 0;
  const pme = m?.pme ?? 0;
  const ciclo = m?.cicloFinanceiro ?? 0;
  const ncg = m?.ncg ?? 0;
  const receita = m?.receitaLiquidaMes ?? 0;

  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Capital de giro"
        title="Ciclo Financeiro"
        description="Indicadores operacionais (PMR, PMP, PME) e impacto na necessidade de capital de giro."
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="PMR" value={`${pmr.toFixed(0)} dias`} hint="Recebimento" icon={Timer} invertDelta />
          <KpiCard label="PMP" value={`${pmp.toFixed(0)} dias`} hint="Pagamento" icon={Timer} />
          <KpiCard label="PME" value={`${pme.toFixed(0)} dias`} hint="Estoque (manual)" icon={Repeat} invertDelta />
          <KpiCard label="Ciclo Operacional" value={`${(pmr + pme).toFixed(0)} dias`} hint="PMR + PME" icon={Activity} invertDelta />
          <KpiCard label="Ciclo Financeiro" value={`${ciclo.toFixed(0)} dias`} hint="PMR + PME − PMP" icon={Activity} accent invertDelta />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border surface-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Histórico dos indicadores</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Snapshots dos últimos meses</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {[
                  { l: "PMR", c: CHART_COLORS.positive },
                  { l: "PMP", c: CHART_COLORS.negative },
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
            {!hist || hist.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem histórico — execute o snapshot diário no Admin para começar a popular esta série.
              </div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={hist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="mes" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}d`} />
                  <ReferenceLine y={0} stroke={CHART_GRID} />
                  <Tooltip cursor={{ stroke: CHART_GRID }} content={<ChartTooltip formatter={(v: number) => `${v} dias`} />} />
                  <Line dataKey="pmr" name="PMR" stroke={CHART_COLORS.positive} strokeWidth={2} dot={false} />
                  <Line dataKey="pmp" name="PMP" stroke={CHART_COLORS.negative} strokeWidth={2} dot={false} />
                  <Line dataKey="ciclo" name="Ciclo" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="bg-card border-border surface-card overflow-hidden relative">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <CardHeader className="pb-2"><CardTitle className="text-base">Necessidade de capital de giro</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums text-primary tracking-tight">{BRL(ncg)}</div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Estimada com base no ciclo financeiro atual ({ciclo.toFixed(0)} dias) sobre a receita líquida do mês.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-eyebrow">Por dia</div>
                  <div className="font-medium tabular-nums mt-0.5">{BRL(ciclo > 0 ? ncg / ciclo : 0)}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-eyebrow">% Receita</div>
                  <div className="font-medium tabular-nums mt-0.5">{receita > 0 ? ((ncg / receita) * 100).toFixed(1) : "0.0"}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {pme === 0 && (
              <InsightCard level="info" title="Estoque não integrado" description="Cadastre o valor do estoque em Admin → Ajustes manuais (param_key=inventory_value) para PME real." />
            )}
            {receita === 0 && (
              <InsightCard level="warn" title="Sem receita no mês" description="Sem lançamentos classificados como Receita Líquida no período atual." />
            )}
            <InsightCard level="info" title="Ajustes manuais" description="Disponíveis em Admin → Ajustes manuais." />
          </div>
        </div>
      </div>
    </div>
  );
}

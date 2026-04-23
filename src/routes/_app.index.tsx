import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  TrendingUp,
  Wallet,
  Timer,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { InsightCard, type InsightLevel } from "@/components/ui/insight-card";
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_AXIS_TICK,
  ChartTooltip,
  chartLegendStyle,
} from "@/components/ui/chart-primitives";
import {
  alertas,
  kpis,
  orcadoRealizado,
  proximosPagar,
  proximosReceber,
  caixaDiario,
  tendencia12m,
  sync,
} from "@/lib/mock-data";
import { BRL } from "@/lib/format";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Home Executiva — Hitech Electric" },
      {
        name: "description",
        content:
          "Visão executiva consolidada: receita, EBITDA, caixa, ciclo financeiro e alertas operacionais.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-6">
      {/* Heading */}
      <SectionHeader
        eyebrow="Cockpit Executivo"
        title="Visão geral da operação"
        description={`Última sincronização ${sync.ultima} · ${sync.fonte}`}
        actions={
          <>
            <Badge
              variant="outline"
              className="border-success/40 text-success bg-success/10 gap-1.5 hidden md:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-success" /> Integração ativa
            </Badge>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Download className="size-3.5" />
              PDF
            </Button>
            <Button
              size="sm"
              className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <FileSpreadsheet className="size-3.5" />
              Excel
            </Button>
          </>
        }
      />

      {/* Primary KPIs — destaque executivo */}
      <div>
        <div className="text-eyebrow mb-2.5">Resultado do mês</div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard
            label="Receita Líquida"
            value={BRL(kpis.receitaLiquida)}
            delta={kpis.receitaLiquidaVar}
            hint="vs. mês anterior"
            icon={TrendingUp}
            accent
          />
          <KpiCard
            label="EBITDA"
            value={BRL(kpis.ebitda)}
            delta={kpis.ebitdaVar}
            hint={`Margem ${kpis.margemEbitda}%`}
            icon={Activity}
          />
          <KpiCard
            label="Resultado Líquido"
            value={BRL(kpis.resultadoLiquido)}
            delta={kpis.resultadoLiquidoVar}
            hint="vs. mês anterior"
            icon={ArrowUpRight}
          />
          <KpiCard
            label="Saldo de Caixa"
            value={BRL(kpis.saldoCaixa)}
            delta={kpis.saldoCaixaVar}
            hint="3 contas bancárias"
            icon={Wallet}
          />
          <KpiCard
            label="Geração de Caixa"
            value={BRL(kpis.geracaoCaixa)}
            hint="Mês corrente"
            icon={Banknote}
          />
          <KpiCard
            label="Projeção 30d"
            value={BRL(kpis.projecaoCaixa30d)}
            hint="Caixa projetado"
            icon={CalendarClock}
          />
        </div>
      </div>

      {/* Secondary KPIs */}
      <div>
        <div className="text-eyebrow mb-2.5">Ciclo & operação</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="A Pagar · 7d"
            value={BRL(kpis.contasPagar7d)}
            hint="Próximas obrigações"
            icon={ArrowDownRight}
            size="sm"
          />
          <KpiCard
            label="A Receber · 7d"
            value={BRL(kpis.contasReceber7d)}
            hint="Recebíveis"
            icon={ArrowUpRight}
            size="sm"
          />
          <KpiCard
            label="PMR"
            value={`${kpis.pmr} dias`}
            hint="Prazo médio de recebimento"
            icon={Timer}
            size="sm"
          />
          <KpiCard
            label="PMP"
            value={`${kpis.pmp} dias`}
            hint="Prazo médio de pagamento"
            icon={Timer}
            size="sm"
          />
          <KpiCard
            label="Ciclo Financeiro"
            value={`${kpis.cicloFinanceiro} dias`}
            hint="PMR + PME − PMP"
            icon={Activity}
            size="sm"
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 surface-card border-0">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Tendência: Receita, EBITDA e Caixa</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Últimos 12 meses</p>
            </div>
            <div className="flex items-center gap-2">
              <LegendDot color={CHART_COLORS.accent} label="Receita" />
              <LegendDot color={CHART_COLORS.positive} label="EBITDA" />
              <LegendDot color={CHART_COLORS.neutral} label="Caixa" />
            </div>
          </CardHeader>
          <CardContent className="h-72 pl-0">
            <ResponsiveContainer>
              <ComposedChart data={tendencia12m} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="mes" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                  width={42}
                />
                <Tooltip
                  cursor={{ stroke: CHART_GRID }}
                  content={(p) => (
                    <ChartTooltip {...p} formatter={(v: number) => BRL(v, { compact: true })} />
                  )}
                />
                <Area
                  type="monotone"
                  name="Receita"
                  dataKey="receita"
                  stroke={CHART_COLORS.accent}
                  strokeWidth={2}
                  fill="url(#gReceita)"
                />
                <Bar
                  name="EBITDA"
                  dataKey="ebitda"
                  fill={CHART_COLORS.positive}
                  radius={[3, 3, 0, 0]}
                  barSize={10}
                />
                <Line
                  type="monotone"
                  name="Caixa"
                  dataKey="caixa"
                  stroke={CHART_COLORS.neutral}
                  strokeWidth={1.75}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader>
            <CardTitle className="text-base">Orçado vs Realizado</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Mês corrente</p>
          </CardHeader>
          <CardContent className="h-72 pl-0">
            <ResponsiveContainer>
              <BarChart
                data={orcadoRealizado}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
                barGap={2}
              >
                <CartesianGrid strokeDasharray="2 4" stroke={CHART_GRID} horizontal={false} />
                <XAxis
                  type="number"
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="categoria"
                  tick={{ ...CHART_AXIS_TICK, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={108}
                />
                <Tooltip
                  cursor={{ fill: "oklch(0.32 0.012 285 / 30%)" }}
                  content={(p) => (
                    <ChartTooltip {...p} formatter={(v: number) => BRL(v, { compact: true })} />
                  )}
                />
                <Legend wrapperStyle={chartLegendStyle} iconType="circle" iconSize={6} />
                <Bar
                  name="Orçado"
                  dataKey="orcado"
                  fill={CHART_COLORS.muted}
                  radius={[0, 3, 3, 0]}
                  barSize={8}
                />
                <Bar
                  name="Realizado"
                  dataKey="realizado"
                  fill={CHART_COLORS.accent}
                  radius={[0, 3, 3, 0]}
                  barSize={8}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Daily cashflow + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 surface-card border-0">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Fluxo de caixa diário</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Entradas, saídas e saldo · últimos 30 dias
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LegendDot color={CHART_COLORS.positive} label="Entradas" />
              <LegendDot color={CHART_COLORS.negative} label="Saídas" />
              <LegendDot color={CHART_COLORS.accent} label="Saldo" />
            </div>
          </CardHeader>
          <CardContent className="h-72 pl-0">
            <ResponsiveContainer>
              <ComposedChart data={caixaDiario} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ ...CHART_AXIS_TICK, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <YAxis
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={42}
                />
                <Tooltip
                  cursor={{ fill: "oklch(0.32 0.012 285 / 25%)" }}
                  content={(p) => (
                    <ChartTooltip {...p} formatter={(v: number) => BRL(v, { compact: true })} />
                  )}
                />
                <Bar
                  name="Entradas"
                  dataKey="entrada"
                  fill={CHART_COLORS.positive}
                  barSize={5}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  name="Saídas"
                  dataKey="saida"
                  fill={CHART_COLORS.negative}
                  barSize={5}
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  name="Saldo"
                  type="monotone"
                  dataKey="saldo"
                  stroke={CHART_COLORS.accent}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Alertas e insights</CardTitle>
            <Badge variant="outline" className="text-[10px] border-border">
              {alertas.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a, i) => (
              <InsightCard
                key={i}
                level={a.nivel as InsightLevel}
                title={a.titulo}
                description={a.desc}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AP / AR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentList
          title="Próximos a pagar"
          rows={proximosPagar.map((r) => ({
            nome: r.fornecedor,
            venc: r.venc,
            valor: r.valor,
            status: r.status,
          }))}
          negative
        />
        <PaymentList
          title="Próximos a receber"
          rows={proximosReceber.map((r) => ({
            nome: r.cliente,
            venc: r.venc,
            valor: r.valor,
            status: r.status,
          }))}
        />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function PaymentList({
  title,
  rows,
  negative,
}: {
  title: string;
  rows: { nome: string; venc: string; valor: number; status: string }[];
  negative?: boolean;
}) {
  const total = rows.reduce((a, b) => a + b.valor, 0);
  return (
    <Card className="surface-card border-0">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Próximos 14 dias</p>
        </div>
        <div className="text-right">
          <div className="text-eyebrow">Total</div>
          <div
            className={`text-sm font-semibold tabular-nums mt-0.5 ${
              negative ? "text-destructive" : "text-success"
            }`}
          >
            {negative ? "− " : "+ "}
            {BRL(total)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5 text-sm hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.nome}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Vence {r.venc} · {r.status}
                </div>
              </div>
              <div
                className={`tabular-nums font-medium shrink-0 ml-3 ${
                  negative ? "text-destructive" : "text-success"
                }`}
              >
                {negative ? "− " : "+ "}
                {BRL(r.valor)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  Activity, ArrowDownRight, ArrowUpRight, Banknote, CalendarClock,
  TrendingUp, Wallet, Timer, AlertTriangle, CheckCircle2, Info, XCircle,
} from "lucide-react";
import {
  ResponsiveContainer, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, Line, ComposedChart,
} from "recharts";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  alertas, kpis, orcadoRealizado, proximosPagar, proximosReceber,
  caixaDiario, tendencia12m, sync,
} from "@/lib/mock-data";
import { BRL } from "@/lib/format";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Home Executiva — Hitech Electric" },
      { name: "description", content: "Visão executiva consolidada: receita, EBITDA, caixa, ciclo financeiro e alertas." },
    ],
  }),
  component: HomePage,
});

const chartGrid = "oklch(0.32 0.012 285 / 50%)";
const tickStyle = { fill: "oklch(0.72 0.012 285)", fontSize: 11 };

function HomePage() {
  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Cockpit Executivo</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Visão geral da operação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Última sincronização <span className="text-foreground font-medium">{sync.ultima}</span> · {sync.fonte}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-success/40 text-success bg-success/10 gap-1.5">
            <span className="size-1.5 rounded-full bg-success" /> Integração ativa
          </Badge>
          <Button variant="outline" size="sm">Exportar PDF</Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Exportar Excel</Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard label="Receita Líquida (mês)" value={BRL(kpis.receitaLiquida)} delta={kpis.receitaLiquidaVar} hint="vs. mês anterior" icon={TrendingUp} accent />
        <KpiCard label="EBITDA (mês)" value={BRL(kpis.ebitda)} delta={kpis.ebitdaVar} hint={`Margem ${kpis.margemEbitda}%`} icon={Activity} />
        <KpiCard label="Resultado Líquido" value={BRL(kpis.resultadoLiquido)} delta={kpis.resultadoLiquidoVar} hint="vs. mês anterior" icon={ArrowUpRight} />
        <KpiCard label="Saldo de Caixa" value={BRL(kpis.saldoCaixa)} delta={kpis.saldoCaixaVar} hint="3 contas bancárias" icon={Wallet} />
        <KpiCard label="Geração de Caixa" value={BRL(kpis.geracaoCaixa)} hint="Mês corrente" icon={Banknote} />
        <KpiCard label="Projeção 30d" value={BRL(kpis.projecaoCaixa30d)} hint="Caixa projetado" icon={CalendarClock} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="A Pagar 7d" value={BRL(kpis.contasPagar7d)} hint="Próximas obrigações" icon={ArrowDownRight} />
        <KpiCard label="A Receber 7d" value={BRL(kpis.contasReceber7d)} hint="Recebíveis" icon={ArrowUpRight} />
        <KpiCard label="PMR" value={`${kpis.pmr} dias`} hint="Prazo médio recebimento" icon={Timer} />
        <KpiCard label="PMP" value={`${kpis.pmp} dias`} hint="Prazo médio pagamento" icon={Timer} />
        <KpiCard label="Ciclo Financeiro" value={`${kpis.cicloFinanceiro} dias`} hint="PMR + PME − PMP" icon={Activity} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tendência: Receita, EBITDA e Caixa</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Últimos 12 meses</p>
            </div>
            <Badge variant="outline" className="border-border">Mensal</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={tendencia12m}>
                <defs>
                  <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.93 0.18 102)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.93 0.18 102)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                <XAxis dataKey="mes" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "oklch(0.72 0.012 285)" }} />
                <Area type="monotone" name="Receita" dataKey="receita" stroke="oklch(0.93 0.18 102)" fill="url(#gReceita)" strokeWidth={2} />
                <Bar name="EBITDA" dataKey="ebitda" fill="oklch(0.74 0.16 152)" radius={[4, 4, 0, 0]} barSize={14} />
                <Line type="monotone" name="Caixa" dataKey="caixa" stroke="oklch(0.68 0.14 240)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Orçado vs Realizado</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Mês corrente</p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={orcadoRealizado} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="categoria" tick={tickStyle} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "oklch(0.72 0.012 285)" }} />
                <Bar name="Orçado" dataKey="orcado" fill="oklch(0.5 0.02 285)" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar name="Realizado" dataKey="realizado" fill="oklch(0.93 0.18 102)" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Daily cashflow + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Fluxo de caixa diário</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Entradas, saídas e saldo · últimos 30 dias</p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={caixaDiario}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                <XAxis dataKey="dia" tick={{ ...tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "oklch(0.72 0.012 285)" }} />
                <Bar name="Entradas" dataKey="entrada" fill="oklch(0.74 0.16 152)" barSize={6} radius={[2, 2, 0, 0]} />
                <Bar name="Saídas" dataKey="saida" fill="oklch(0.7 0.18 25)" barSize={6} radius={[2, 2, 0, 0]} />
                <Line name="Saldo" type="monotone" dataKey="saldo" stroke="oklch(0.93 0.18 102)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Alertas e pendências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a, i) => {
              const map = {
                ok: { Icon: CheckCircle2, cls: "text-success bg-success/10 border-success/30" },
                info: { Icon: Info, cls: "text-chart-3 bg-chart-3/10 border-chart-3/30" },
                warn: { Icon: AlertTriangle, cls: "text-warning bg-warning/10 border-warning/30" },
                error: { Icon: XCircle, cls: "text-destructive bg-destructive/10 border-destructive/30" },
              } as const;
              const { Icon, cls } = map[a.nivel];
              return (
                <div key={i} className={`flex gap-3 rounded-md border p-3 ${cls}`}>
                  <Icon className="size-4 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-medium text-foreground">{a.titulo}</div>
                    <div className="text-muted-foreground mt-0.5">{a.desc}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* AP / AR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentList title="Próximos a pagar" rows={proximosPagar.map(r => ({ nome: r.fornecedor, venc: r.venc, valor: r.valor, status: r.status }))} negative />
        <PaymentList title="Próximos a receber" rows={proximosReceber.map(r => ({ nome: r.cliente, venc: r.venc, valor: r.valor, status: r.status }))} />
      </div>
    </div>
  );
}

function PaymentList({ title, rows, negative }: {
  title: string;
  rows: { nome: string; venc: string; valor: number; status: string }[];
  negative?: boolean;
}) {
  const total = rows.reduce((a, b) => a + b.valor, 0);
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className={`text-sm font-semibold tabular-nums ${negative ? "text-destructive" : "text-success"}`}>
          {negative ? "− " : "+ "}{BRL(total)}
        </span>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <div className="font-medium">{r.nome}</div>
                <div className="text-xs text-muted-foreground">Vence {r.venc} · {r.status}</div>
              </div>
              <div className={`tabular-nums font-medium ${negative ? "text-destructive" : "text-success"}`}>
                {negative ? "− " : "+ "}{BRL(r.valor)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 space-y-0.5">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium tabular-nums">{BRL(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
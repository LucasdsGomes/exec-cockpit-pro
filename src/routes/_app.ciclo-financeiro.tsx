import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { cicloHist, kpis } from "@/lib/mock-data";
import { Timer, Repeat, Activity, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { BRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/ciclo-financeiro")({
  head: () => ({
    meta: [
      { title: "Ciclo Financeiro — Hitech Electric" },
      { name: "description", content: "PMR, PMP, PME, ciclo operacional e necessidade de capital de giro." },
    ],
  }),
  component: CicloPage,
});

const tickStyle = { fill: "oklch(0.72 0.012 285)", fontSize: 11 };
const grid = "oklch(0.32 0.012 285 / 50%)";

function CicloPage() {
  const ncg = (kpis.cicloFinanceiro / 30) * kpis.receitaLiquida;
  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Capital de Giro</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Ciclo Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Indicadores operacionais e impacto em caixa</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="PMR" value={`${kpis.pmr} dias`} delta={3.2} hint="Recebimento" icon={Timer} />
        <KpiCard label="PMP" value={`${kpis.pmp} dias`} delta={-1.5} hint="Pagamento" icon={Timer} />
        <KpiCard label="PME" value={`${kpis.pme} dias`} delta={0.8} hint="Estoque" icon={Repeat} />
        <KpiCard label="Ciclo Operacional" value={`${kpis.pmr + kpis.pme} dias`} hint="PMR + PME" icon={Activity} />
        <KpiCard label="Ciclo Financeiro" value={`${kpis.cicloFinanceiro} dias`} hint="PMR + PME − PMP" icon={Activity} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Histórico dos indicadores</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Últimos 12 meses</p>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer>
              <LineChart data={cicloHist}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="mes" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.014 285)", border: "1px solid oklch(0.32 0.012 285)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="pmr" name="PMR" stroke="oklch(0.74 0.16 152)" strokeWidth={2} dot={false} />
                <Line dataKey="pmp" name="PMP" stroke="oklch(0.7 0.18 25)" strokeWidth={2} dot={false} />
                <Line dataKey="pme" name="PME" stroke="oklch(0.68 0.14 240)" strokeWidth={2} dot={false} />
                <Line dataKey="ciclo" name="Ciclo Financeiro" stroke="oklch(0.93 0.18 102)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Necessidade de capital de giro</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums text-primary">{BRL(ncg)}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Estimada com base no ciclo financeiro atual ({kpis.cicloFinanceiro} dias) sobre a receita líquida do mês.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Alertas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10 gap-1.5 w-full justify-start py-2">
                <AlertTriangle className="size-3.5" /> PMR aumentou 3 dias vs mês anterior
              </Badge>
              <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 gap-1.5 w-full justify-start py-2">
                <AlertTriangle className="size-3.5" /> PMP reduziu 1,5 dias — pressão em caixa
              </Badge>
              <p className="text-xs text-muted-foreground pt-2">
                Ajustes manuais de PME disponíveis em <span className="text-primary">Admin → Ajustes manuais</span>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
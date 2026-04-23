import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { dre, type DRELinha, kpis } from "@/lib/mock-data";
import { BRL, PCT } from "@/lib/format";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Download, TrendingUp, Percent, Wallet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { CHART_COLORS, CHART_GRID, CHART_AXIS_TICK, ChartTooltip } from "@/components/ui/chart-primitives";

export const Route = createFileRoute("/_app/dre")({
  head: () => ({
    meta: [
      { title: "DRE — Hitech Electric" },
      { name: "description", content: "Demonstração de Resultados gerencial: orçado, realizado e comparativo." },
    ],
  }),
  component: DREPage,
});

function DREPage() {
  const [period, setPeriod] = useState<"Diário" | "Mensal" | "Acum. Mês" | "Acum. Ano">("Mensal");

  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Resultado"
        title="DRE Gerencial"
        description="Demonstrativo de resultados consolidado · Abril/2026 · drill-down disponível por linha."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" /> Exportar
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Receita líquida" value={BRL(kpis.receitaLiquida)} delta={kpis.receitaLiquidaVar} icon={TrendingUp} hint="vs mês anterior" />
        <KpiCard label="Margem bruta" value={`${(60.4).toFixed(1)}%`} delta={1.4} icon={Percent} hint="3 meses estável" />
        <KpiCard label="EBITDA" value={BRL(kpis.ebitda)} delta={kpis.ebitdaVar} icon={Activity} hint={`Margem ${kpis.margemEbitda}%`} accent />
        <KpiCard label="Lucro líquido" value={BRL(kpis.resultadoLiquido)} delta={kpis.resultadoLiquidoVar} icon={Wallet} hint="15.4% da receita" />
      </div>

      <Tabs defaultValue="realizado">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-card border border-border h-9">
            <TabsTrigger value="realizado">Realizado</TabsTrigger>
            <TabsTrigger value="orcado">Orçado</TabsTrigger>
            <TabsTrigger value="comparativo">Orçado vs Realizado</TabsTrigger>
          </TabsList>
          <div className="inline-flex items-center rounded-lg border border-border bg-card/60 p-0.5">
            {(["Diário", "Mensal", "Acum. Mês", "Acum. Ano"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium rounded-md transition-colors",
                  period === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <TabsContent value="realizado" className="mt-4 space-y-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Construção do resultado · waterfall</CardTitle>
              <p className="text-xs text-muted-foreground">Da receita líquida ao lucro líquido</p>
            </CardHeader>
            <CardContent className="h-72 pt-2">
              <DREWaterfall />
            </CardContent>
          </Card>

          <Card className="bg-card border-border surface-card">
            <CardHeader>
              <CardTitle className="text-base">Demonstrativo do mês</CardTitle>
            </CardHeader>
            <CardContent>
              <DRETable data={dre} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orcado" className="mt-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader><CardTitle className="text-base">Orçado do mês</CardTitle></CardHeader>
            <CardContent>
              <DRETable data={dre.map(d => ({ ...d, valor: Math.round(d.valor * 0.93), varAbs: 0, varPct: 0 }))} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo" className="mt-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader>
              <CardTitle className="text-base">Orçado vs Realizado</CardTitle>
              <p className="text-xs text-muted-foreground">Variações relevantes destacadas</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-eyebrow border-b border-border">
                    <th className="py-2.5 font-medium">Conta</th>
                    <th className="py-2.5 text-right font-medium">Orçado</th>
                    <th className="py-2.5 text-right font-medium">Realizado</th>
                    <th className="py-2.5 text-right font-medium">Δ Abs</th>
                    <th className="py-2.5 text-right font-medium">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {dre.map((d) => {
                    const orc = Math.round(d.valor * 0.93);
                    const delta = d.valor - orc;
                    const pct = (delta / Math.max(1, Math.abs(orc))) * 100;
                    const isTotal = d.destaque === "total";
                    return (
                      <tr
                        key={d.conta}
                        className={cn(
                          "border-b border-border/50 hover:bg-muted/30 transition-colors",
                          isTotal && "bg-primary/[0.04]",
                        )}
                      >
                        <td className={cn("py-2.5", isTotal && "font-semibold")}>{d.conta}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{BRL(orc)}</td>
                        <td className={cn("py-2.5 text-right tabular-nums font-medium", isTotal && "text-primary")}>{BRL(d.valor)}</td>
                        <td className={cn("py-2.5 text-right tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>{BRL(delta)}</td>
                        <td className={cn("py-2.5 text-right tabular-nums text-xs", pct >= 0 ? "text-success" : "text-destructive")}>{PCT(pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DRETable({ data }: { data: DRELinha[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-eyebrow border-b border-border">
            <th className="py-2.5 font-medium">Conta</th>
            <th className="py-2.5 text-right font-medium">Valor</th>
            <th className="py-2.5 text-right font-medium">% Receita</th>
            <th className="py-2.5 text-right font-medium">Δ Abs</th>
            <th className="py-2.5 text-right font-medium">Δ %</th>
            <th className="py-2.5 text-right font-medium pr-2">12 meses</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const isTotal = d.destaque === "total";
            const isSubtotal = d.destaque === "subtotal";
            return (
              <tr key={d.conta} className={cn(
                "border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors",
                isTotal && "bg-primary/[0.04]",
                isSubtotal && "bg-muted/20",
              )}>
                <td className={cn("py-2.5", (isTotal || isSubtotal) && "font-semibold")}>
                  {d.conta}
                </td>
                <td className={cn("py-2.5 text-right tabular-nums font-medium",
                  isTotal && "text-primary text-[15px]",
                  d.destaque === "negativo" && "text-foreground/85"
                )}>{BRL(d.valor)}</td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">{d.pctReceita.toFixed(1)}%</td>
                <td className={cn("py-2.5 text-right tabular-nums text-xs", d.varAbs >= 0 ? "text-success" : "text-destructive")}>
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    {d.varAbs >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {BRL(Math.abs(d.varAbs))}
                  </span>
                </td>
                <td className={cn("py-2.5 text-right tabular-nums text-xs", d.varPct >= 0 ? "text-success" : "text-destructive")}>
                  {d.varPct.toFixed(1)}%
                </td>
                <td className="py-2.5 pr-2">
                  <div className="h-7 w-24 ml-auto">
                    <ResponsiveContainer>
                      <LineChart data={d.spark.map((v, i) => ({ i, v }))}>
                        <Line type="monotone" dataKey="v" stroke={isTotal ? CHART_COLORS.accent : CHART_COLORS.muted} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DREWaterfall() {
  const steps = [
    { name: "Rec. líquida", value: 4_820_000, type: "total" as const },
    { name: "CMV", value: -1_910_000, type: "neg" as const },
    { name: "Margem bruta", value: 2_910_000, type: "subtotal" as const },
    { name: "Desp. Op.", value: -1_730_000, type: "neg" as const },
    { name: "EBITDA", value: 1_180_000, type: "total" as const },
    { name: "Result. Fin.", value: -180_000, type: "neg" as const },
    { name: "Não Op.", value: 25_000, type: "pos" as const },
    { name: "Lucro líquido", value: 742_000, type: "total" as const },
  ];

  let running = 0;
  const data = steps.map((s) => {
    if (s.type === "total" || s.type === "subtotal") {
      running = s.value;
      return { name: s.name, base: 0, delta: s.value, kind: s.type, raw: s.value };
    }
    const prev = running;
    running = prev + s.value;
    const base = s.value >= 0 ? prev : running;
    return { name: s.name, base, delta: Math.abs(s.value), kind: s.type, raw: s.value };
  });

  const colorFor = (kind: string) => {
    if (kind === "total") return CHART_COLORS.accent;
    if (kind === "subtotal") return CHART_COLORS.neutral;
    if (kind === "pos") return CHART_COLORS.positive;
    return CHART_COLORS.negative;
  };

  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
        <ReferenceLine y={0} stroke={CHART_GRID} />
        <Tooltip
          cursor={{ fill: "oklch(1 0 0 / 4%)" }}
          content={<ChartTooltip formatter={(v: number) => BRL(v)} />}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="delta" stackId="a" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor(d.kind)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

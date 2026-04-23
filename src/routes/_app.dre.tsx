import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BRL } from "@/lib/format";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Download, TrendingUp, Percent, Wallet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { CHART_COLORS, CHART_GRID, CHART_AXIS_TICK, ChartTooltip } from "@/components/ui/chart-primitives";
import { PeriodPresets } from "@/components/ui/period-presets";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/lib/queries/company";
import { useKpis } from "@/lib/queries/kpis";
import { useDreLines, useDreWaterfall, type DRELine } from "@/lib/queries/dre";
import { useFilters } from "@/lib/filters-context";
import { downloadCsv } from "@/lib/export-csv";
import { toast } from "sonner";
import { downloadPdfReport } from "@/lib/export-pdf";

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
  const [period, setPeriod] = useState("mtd");
  const { data: company } = useCompany();
  const companyId = company?.id;
  const filters = useFilters();
  const { data: kpis } = useKpis(period, companyId, filters);
  const { data: dre = [], isLoading: loadingDre } = useDreLines(companyId, period, filters);
  const { data: waterfall = [] } = useDreWaterfall(companyId, period, filters);

  const exportCsv = () => {
    if (!dre.length) return;
    downloadCsv(
      dre.map((d) => ({
        conta: d.conta,
        valor: d.valor,
        pct_receita: d.pctReceita.toFixed(1),
        var_abs: d.varAbs,
        var_pct: d.varPct.toFixed(1),
      })),
      `dre_${kpis?.range.start ?? "periodo"}`,
      [
        { key: "conta", label: "Conta" },
        { key: "valor", label: "Valor" },
        { key: "pct_receita", label: "% Receita" },
        { key: "var_abs", label: "Variação Absoluta" },
        { key: "var_pct", label: "Variação %" },
      ],
    );
    toast.success("CSV exportado");
  };

  const exportPdf = () => {
    if (!dre.length) return;
    downloadPdfReport({
      title: "DRE Gerencial",
      subtitle: `${company?.name ?? ""} · ${kpis?.range.label ?? ""}`,
      filename: `dre_${kpis?.range.start ?? "periodo"}`,
      rows: dre as unknown as Record<string, unknown>[],
      summary: kpis ? [
        { label: "Receita líquida", value: BRL(kpis.receitaLiquida) },
        { label: "EBITDA", value: BRL(kpis.ebitda) },
        { label: "Margem EBITDA", value: `${kpis.margemEbitda.toFixed(1)}%` },
        { label: "Lucro líquido", value: BRL(kpis.resultadoLiquido) },
      ] : undefined,
      columns: [
        { key: "conta", label: "Conta" },
        { key: "valor", label: "Valor", align: "right", format: (v) => BRL(Number(v)) },
        { key: "pctReceita", label: "% Receita", align: "right", format: (v) => `${Number(v).toFixed(1)}%` },
        { key: "varAbs", label: "Var. abs.", align: "right", format: (v) => BRL(Number(v)) },
        { key: "varPct", label: "Var. %", align: "right", format: (v) => `${Number(v).toFixed(1)}%` },
      ],
    });
    toast.success("PDF exportado");
  };

  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Resultado"
        title="DRE Gerencial"
        description={kpis ? `Demonstrativo · ${kpis.range.label}` : "Demonstrativo de resultados consolidado"}
        actions={
          <>
            <PeriodPresets value={period} onChange={setPeriod} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
              <Download className="size-3.5" /> Exportar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPdf}>
              <Download className="size-3.5" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Receita líquida" value={BRL(kpis?.receitaLiquida ?? 0)} delta={kpis?.receitaLiquidaVar ?? 0} icon={TrendingUp} hint="vs período anterior" />
        <KpiCard label="Margem bruta" value={`${marginGross(dre).toFixed(1)}%`} icon={Percent} hint="Bruta / Receita líq." />
        <KpiCard label="EBITDA" value={BRL(kpis?.ebitda ?? 0)} delta={kpis?.ebitdaVar ?? 0} icon={Activity} hint={`Margem ${(kpis?.margemEbitda ?? 0).toFixed(1)}%`} accent />
        <KpiCard label="Lucro líquido" value={BRL(kpis?.resultadoLiquido ?? 0)} delta={kpis?.resultadoLiquidoVar ?? 0} icon={Wallet} />
      </div>

      <Tabs defaultValue="realizado">
        <TabsList className="bg-card border border-border h-9">
          <TabsTrigger value="realizado">Realizado</TabsTrigger>
          <TabsTrigger value="orcado">Orçado</TabsTrigger>
          <TabsTrigger value="comparativo">Orçado vs Realizado</TabsTrigger>
        </TabsList>

        <TabsContent value="realizado" className="mt-4 space-y-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Construção do resultado · waterfall</CardTitle>
              <p className="text-xs text-muted-foreground">Da receita líquida ao lucro líquido</p>
            </CardHeader>
            <CardContent className="h-72 pt-2">
              <DREWaterfall steps={waterfall} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border surface-card">
            <CardHeader>
              <CardTitle className="text-base">Demonstrativo · {kpis?.range.label ?? ""}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDre ? <Skeleton className="h-48" /> : dre.length === 0 ? (
                <EmptyState message="Sem lançamentos classificados no período. Acesse Admin → DE-PARA para mapear categorias." />
              ) : <DRETable data={dre} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orcado" className="mt-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader><CardTitle className="text-base">Orçado do período</CardTitle></CardHeader>
            <CardContent>
              <EmptyState message="Cadastre orçamento em Admin → Orçamento para habilitar esta visão." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo" className="mt-4">
          <Card className="bg-card border-border surface-card">
            <CardHeader>
              <CardTitle className="text-base">Orçado vs Realizado</CardTitle>
              <p className="text-xs text-muted-foreground">Variações relevantes destacadas</p>
            </CardHeader>
            <CardContent>
              <EmptyState message="Cadastre orçamento em Admin → Orçamento para habilitar comparativos." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function marginGross(dre: DRELine[]): number {
  const r = dre.find((d) => d.conta.includes("Receita Líquida"))?.valor ?? 0;
  const m = dre.find((d) => d.conta.includes("Margem Bruta"))?.valor ?? 0;
  return r ? (m / r) * 100 : 0;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{message}</div>
  );
}

function DRETable({ data }: { data: DRELine[] }) {
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

function DREWaterfall({ steps }: { steps: { name: string; value: number; type: "total" | "subtotal" | "neg" | "pos" }[] }) {
  if (!steps.length) {
    return <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados para o período.</div>;
  }
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

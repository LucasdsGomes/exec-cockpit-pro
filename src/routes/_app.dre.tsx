import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dre, type DRELinha } from "@/lib/mock-data";
import { BRL } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Resultado</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">DRE Gerencial</h1>
          <p className="text-sm text-muted-foreground mt-1">Abril/2026 · Consolidado · Drill-down disponível por linha</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="size-4" /> Exportar</Button>
        </div>
      </header>

      <Tabs defaultValue="realizado">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="realizado">Realizado</TabsTrigger>
            <TabsTrigger value="orcado">Orçado</TabsTrigger>
            <TabsTrigger value="comparativo">Orçado vs Realizado</TabsTrigger>
          </TabsList>
          <div className="flex gap-1.5">
            {["Diário", "Mensal", "Acum. Mês", "Acum. Ano"].map((v, i) => (
              <Badge key={v} variant={i === 1 ? "default" : "outline"} className={cn(i === 1 && "bg-primary text-primary-foreground", "cursor-pointer")}>
                {v}
              </Badge>
            ))}
          </div>
        </div>

        <TabsContent value="realizado" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Demonstrativo do mês</CardTitle>
            </CardHeader>
            <CardContent>
              <DRETable data={dre} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orcado" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Orçado do mês</CardTitle></CardHeader>
            <CardContent>
              <DRETable data={dre.map(d => ({ ...d, valor: Math.round(d.valor * 0.93), varAbs: 0, varPct: 0 }))} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Orçado vs Realizado</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5">Conta</th>
                    <th className="py-2.5 text-right">Orçado</th>
                    <th className="py-2.5 text-right">Realizado</th>
                    <th className="py-2.5 text-right">Δ Abs</th>
                    <th className="py-2.5 text-right">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {dre.map((d) => {
                    const orc = Math.round(d.valor * 0.93);
                    const delta = d.valor - orc;
                    const pct = (delta / Math.max(1, Math.abs(orc))) * 100;
                    return (
                      <tr key={d.conta} className={cn("border-b border-border/60", d.destaque === "total" && "bg-primary/5")}>
                        <td className={cn("py-2.5", d.destaque === "total" && "font-semibold")}>{d.conta}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{BRL(orc)}</td>
                        <td className={cn("py-2.5 text-right tabular-nums font-medium", d.destaque === "total" && "text-primary")}>{BRL(d.valor)}</td>
                        <td className={cn("py-2.5 text-right tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>{BRL(delta)}</td>
                        <td className={cn("py-2.5 text-right tabular-nums text-xs", pct >= 0 ? "text-success" : "text-destructive")}>{pct.toFixed(1)}%</td>
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
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
          <th className="py-2.5">Conta</th>
          <th className="py-2.5 text-right">Valor</th>
          <th className="py-2.5 text-right">% Receita</th>
          <th className="py-2.5 text-right">Δ Abs</th>
          <th className="py-2.5 text-right">Δ %</th>
          <th className="py-2.5 text-right pr-2">Tendência</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.conta} className={cn(
            "border-b border-border/60 hover:bg-muted/40 cursor-pointer transition-colors",
            d.destaque === "total" && "bg-primary/5",
            d.destaque === "subtotal" && "bg-muted/30",
          )}>
            <td className={cn("py-2.5", (d.destaque === "total" || d.destaque === "subtotal") && "font-semibold")}>
              {d.conta}
            </td>
            <td className={cn("py-2.5 text-right tabular-nums font-medium",
              d.destaque === "total" && "text-primary text-base",
              d.destaque === "negativo" && "text-destructive/90"
            )}>{BRL(d.valor)}</td>
            <td className="py-2.5 text-right tabular-nums text-muted-foreground">{d.pctReceita.toFixed(1)}%</td>
            <td className={cn("py-2.5 text-right tabular-nums text-xs", d.varAbs >= 0 ? "text-success" : "text-destructive")}>
              <span className="inline-flex items-center gap-0.5">
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
                    <Line type="monotone" dataKey="v" stroke="oklch(0.93 0.18 102)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
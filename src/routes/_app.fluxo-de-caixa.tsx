import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { caixaDiario, dfc, heatmap } from "@/lib/mock-data";
import { BRL } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Legend,
} from "recharts";
import { Download, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Hitech Electric" },
      { name: "description", content: "DFC realizada e prevista, calendário de vencimentos e projeção de caixa." },
    ],
  }),
  component: FluxoCaixa,
});

const tickStyle = { fill: "oklch(0.72 0.012 285)", fontSize: 11 };
const grid = "oklch(0.32 0.012 285 / 50%)";

function FluxoCaixa() {
  const totalEntradas = dfc.blocos.flatMap(b => b.itens).filter(i => i.valor > 0).reduce((a, b) => a + b.valor, 0);
  const totalSaidas = dfc.blocos.flatMap(b => b.itens).filter(i => i.valor < 0).reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Tesouraria</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão diária, semanal e mensal · 3 contas bancárias</p>
        </div>
        <Button variant="outline" size="sm"><Download className="size-4" /> Exportar</Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SaldoCard label="Saldo inicial" value={BRL(dfc.saldoInicial)} />
        <SaldoCard label="Entradas (mês)" value={BRL(totalEntradas)} positive />
        <SaldoCard label="Saídas (mês)" value={BRL(totalSaidas)} negative />
        <SaldoCard label="Saldo final" value={BRL(dfc.saldoFinal)} highlight />
      </div>

      <Tabs defaultValue="realizada">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="realizada">DFC Realizada</TabsTrigger>
          <TabsTrigger value="prevista">DFC Prevista</TabsTrigger>
        </TabsList>

        <TabsContent value="realizada" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Saldo diário · realizado vs previsto</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <ComposedChart data={caixaDiario}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="dia" tick={{ ...tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "oklch(0.22 0.014 285)", border: "1px solid oklch(0.32 0.012 285)", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar name="Entradas" dataKey="entrada" fill="oklch(0.74 0.16 152)" barSize={6} />
                    <Bar name="Saídas" dataKey="saida" fill="oklch(0.7 0.18 25)" barSize={6} />
                    <Line name="Saldo" dataKey="saldo" stroke="oklch(0.93 0.18 102)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Calendário de vencimentos</CardTitle>
                <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10 gap-1">
                  <AlertTriangle className="size-3" /> 3 picos
                </Badge>
              </CardHeader>
              <CardContent>
                <Heatmap />
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">DFC por natureza</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-muted/40">
                    <td className="py-2 px-3 font-semibold">Saldo inicial</td>
                    <td className="py-2 px-3 text-right font-semibold tabular-nums">{BRL(dfc.saldoInicial)}</td>
                  </tr>
                  {dfc.blocos.map((b) => {
                    const subtotal = b.itens.reduce((a, c) => a + c.valor, 0);
                    return (
                      <>
                        <tr key={b.tipo} className="bg-card">
                          <td className="pt-4 pb-2 px-3 text-[11px] uppercase tracking-wider text-primary font-semibold">{b.tipo}</td>
                          <td></td>
                        </tr>
                        {b.itens.map((it) => (
                          <tr key={it.conta} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer">
                            <td className="py-2 px-3 pl-6 text-muted-foreground">{it.conta}</td>
                            <td className={cn("py-2 px-3 text-right tabular-nums", it.valor < 0 ? "text-destructive" : "text-success")}>
                              {BRL(it.valor)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/20">
                          <td className="py-2 px-3 font-medium">Subtotal {b.tipo}</td>
                          <td className={cn("py-2 px-3 text-right font-semibold tabular-nums", subtotal < 0 ? "text-destructive" : "text-success")}>
                            {BRL(subtotal)}
                          </td>
                        </tr>
                      </>
                    );
                  })}
                  <tr className="bg-primary/10">
                    <td className="py-3 px-3 font-semibold">Saldo final</td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums text-primary text-base">{BRL(dfc.saldoFinal)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prevista" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Projeção de caixa · próximos 30 dias</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer>
                <ComposedChart data={caixaDiario.map(d => ({ ...d, saldo: d.saldo * 1.04 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="dia" tick={{ ...tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.22 0.014 285)", border: "1px solid oklch(0.32 0.012 285)", borderRadius: 8, fontSize: 12 }} />
                  <Line name="Saldo previsto" dataKey="saldo" stroke="oklch(0.93 0.18 102)" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SaldoCard({ label, value, positive, negative, highlight }: { label: string; value: string; positive?: boolean; negative?: boolean; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4",
      highlight ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
    )} style={{ boxShadow: "var(--shadow-elev)" }}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-xl font-semibold tabular-nums",
        positive && "text-success",
        negative && "text-destructive",
        highlight && "text-primary"
      )}>{value}</div>
    </div>
  );
}

function Heatmap() {
  const max = Math.max(...heatmap.map(h => h.valor));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {heatmap.map((d) => {
        const intensity = d.valor / max;
        return (
          <div
            key={d.dia}
            title={`Dia ${d.dia}: ${BRL(d.valor)}`}
            className="aspect-square rounded grid place-items-center text-[10px] font-medium tabular-nums cursor-pointer hover:ring-1 hover:ring-primary"
            style={{
              background: `oklch(0.93 0.18 102 / ${0.08 + intensity * 0.6})`,
              color: intensity > 0.5 ? "oklch(0.15 0 0)" : "oklch(0.92 0.005 95)",
            }}
          >
            {d.dia}
          </div>
        );
      })}
    </div>
  );
}
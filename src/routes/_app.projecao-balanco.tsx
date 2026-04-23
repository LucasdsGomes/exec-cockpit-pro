import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { balanco } from "@/lib/mock-data";
import { BRL } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { Wallet, TrendingDown, Banknote, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/projecao-balanco")({
  head: () => ({
    meta: [
      { title: "Projeção do Balanço — Hitech Electric" },
      { name: "description", content: "Projeção patrimonial diária: ativo, passivo, patrimônio líquido e indicadores derivados." },
    ],
  }),
  component: BalancoPage,
});

function BalancoPage() {
  const ativoCirc = balanco.ativo.circulante.reduce((a, b) => a + b.valor, 0);
  const ativoNc = balanco.ativo.naoCirculante.reduce((a, b) => a + b.valor, 0);
  const passivoCirc = balanco.passivo.circulante.reduce((a, b) => a + b.valor, 0);
  const passivoNc = balanco.passivo.naoCirculante.reduce((a, b) => a + b.valor, 0);
  const pl = balanco.patrimonio.reduce((a, b) => a + b.valor, 0);

  const ativoTotal = ativoCirc + ativoNc;
  const passivoTotal = passivoCirc + passivoNc;

  const capitalGiro = ativoCirc - passivoCirc;
  const dividaTotal = (balanco.passivo.circulante.find(p => p.conta.toLowerCase().includes("empréstimos"))?.valor || 0) +
    (balanco.passivo.naoCirculante.find(p => p.conta.toLowerCase().includes("empréstimos"))?.valor || 0);
  const caixa = balanco.ativo.circulante.find(a => a.conta.toLowerCase().includes("caixa"))?.valor || 0;
  const dividaLiquida = dividaTotal - caixa;

  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Patrimonial</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Projeção do Balanço</h1>
        <p className="text-sm text-muted-foreground mt-1">Fechamento estimado do mês corrente</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Capital de giro" value={BRL(capitalGiro)} icon={Wallet} accent />
        <KpiCard label="Dívida líquida" value={BRL(dividaLiquida)} icon={TrendingDown} />
        <KpiCard label="Caixa líquido" value={BRL(caixa)} icon={Banknote} />
        <KpiCard label="Total do ativo" value={BRL(ativoTotal)} icon={Scale} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BalancoBloco titulo="Ativo" total={ativoTotal}
          grupos={[
            { nome: "Circulante", subtotal: ativoCirc, itens: balanco.ativo.circulante },
            { nome: "Não circulante", subtotal: ativoNc, itens: balanco.ativo.naoCirculante },
          ]} accent />
        <BalancoBloco titulo="Passivo" total={passivoTotal}
          grupos={[
            { nome: "Circulante", subtotal: passivoCirc, itens: balanco.passivo.circulante },
            { nome: "Não circulante", subtotal: passivoNc, itens: balanco.passivo.naoCirculante },
          ]} />
        <BalancoBloco titulo="Patrimônio Líquido" total={pl}
          grupos={[{ nome: "Composição", subtotal: pl, itens: balanco.patrimonio }]} />
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Verificação contábil</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-muted-foreground text-xs">Ativo total</div><div className="font-semibold tabular-nums">{BRL(ativoTotal)}</div></div>
            <div><div className="text-muted-foreground text-xs">Passivo + PL</div><div className="font-semibold tabular-nums">{BRL(passivoTotal + pl)}</div></div>
            <div>
              <div className="text-muted-foreground text-xs">Diferença</div>
              <div className={cn("font-semibold tabular-nums", Math.abs(ativoTotal - (passivoTotal + pl)) < 1000 ? "text-success" : "text-destructive")}>
                {BRL(ativoTotal - (passivoTotal + pl))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BalancoBloco({ titulo, grupos, total, accent }: {
  titulo: string;
  grupos: { nome: string; subtotal: number; itens: { conta: string; valor: number }[] }[];
  total: number;
  accent?: boolean;
}) {
  return (
    <Card className={cn("bg-card border-border", accent && "border-primary/30")}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <span className={cn("text-sm font-bold tabular-nums", accent ? "text-primary" : "text-foreground")}>{BRL(total)}</span>
      </CardHeader>
      <CardContent>
        {grupos.map((g) => (
          <div key={g.nome} className="mb-4 last:mb-0">
            <div className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-1.5">{g.nome}</div>
            <div className="divide-y divide-border/60">
              {g.itens.map((i) => (
                <div key={i.conta} className="flex justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">{i.conta}</span>
                  <span className="tabular-nums">{BRL(i.valor)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5 pt-1.5 border-t border-border text-sm font-medium">
              <span>Subtotal</span>
              <span className="tabular-nums">{BRL(g.subtotal)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
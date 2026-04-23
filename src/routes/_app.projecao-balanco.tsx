import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { balanco } from "@/lib/mock-data";
import { BRL } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { Wallet, TrendingDown, Banknote, Scale, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";

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
  const totalPP = passivoTotal + pl;

  const capitalGiro = ativoCirc - passivoCirc;
  const dividaTotal = (balanco.passivo.circulante.find(p => p.conta.toLowerCase().includes("empréstimos"))?.valor || 0) +
    (balanco.passivo.naoCirculante.find(p => p.conta.toLowerCase().includes("empréstimos"))?.valor || 0);
  const caixa = balanco.ativo.circulante.find(a => a.conta.toLowerCase().includes("caixa"))?.valor || 0;
  const dividaLiquida = dividaTotal - caixa;
  const liquidezCorrente = ativoCirc / Math.max(1, passivoCirc);

  const diff = ativoTotal - totalPP;
  const balanced = Math.abs(diff) < 1000;

  return (
    <div className="space-y-6 anim-fade-in">
      <SectionHeader
        eyebrow="Patrimonial"
        title="Projeção do Balanço"
        description="Fechamento estimado do mês corrente · ativo, passivo e patrimônio líquido."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Capital de giro" value={BRL(capitalGiro)} icon={Wallet} accent hint={`Liquidez ${liquidezCorrente.toFixed(2)}x`} />
        <KpiCard label="Dívida líquida" value={BRL(dividaLiquida)} icon={TrendingDown} hint="Bruta − caixa" />
        <KpiCard label="Caixa líquido" value={BRL(caixa)} icon={Banknote} hint="3 contas bancárias" />
        <KpiCard label="Total do ativo" value={BRL(ativoTotal)} icon={Scale} hint={`PL ${((pl / ativoTotal) * 100).toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BalancoBloco titulo="Ativo" total={ativoTotal} accent
          grupos={[
            { nome: "Circulante", subtotal: ativoCirc, itens: balanco.ativo.circulante },
            { nome: "Não circulante", subtotal: ativoNc, itens: balanco.ativo.naoCirculante },
          ]} />
        <BalancoBloco titulo="Passivo" total={passivoTotal}
          grupos={[
            { nome: "Circulante", subtotal: passivoCirc, itens: balanco.passivo.circulante },
            { nome: "Não circulante", subtotal: passivoNc, itens: balanco.passivo.naoCirculante },
          ]} />
        <BalancoBloco titulo="Patrimônio Líquido" total={pl}
          grupos={[{ nome: "Composição", subtotal: pl, itens: balanco.patrimonio }]} />
      </div>

      <Card className="bg-card border-border surface-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Verificação contábil</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Ativo deve igualar Passivo + Patrimônio Líquido</p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border",
                balanced
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-destructive/10 text-destructive border-destructive/30",
              )}
            >
              <CheckCircle2 className="size-3" />
              {balanced ? "Balanceado" : "Diferença detectada"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Cell label="Ativo total" value={BRL(ativoTotal)} />
            <Cell label="Passivo + PL" value={BRL(totalPP)} />
            <Cell
              label="Diferença"
              value={BRL(diff)}
              tone={balanced ? "ok" : "bad"}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-eyebrow">{label}</div>
      <div className={cn(
        "mt-1.5 text-lg font-semibold tabular-nums tracking-tight",
        tone === "ok" && "text-success",
        tone === "bad" && "text-destructive",
      )}>
        {value}
      </div>
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
    <Card className={cn("bg-card surface-card", accent ? "border-primary/30" : "border-border")}
      style={accent ? { backgroundImage: "var(--gradient-kpi-accent)" } : undefined}>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <span className={cn(
          "text-[15px] font-bold tabular-nums tracking-tight",
          accent ? "text-primary" : "text-foreground",
        )}>{BRL(total)}</span>
      </CardHeader>
      <CardContent>
        {grupos.map((g) => (
          <div key={g.nome} className="mb-4 last:mb-0">
            <div className="text-eyebrow text-primary mb-2">{g.nome}</div>
            <div className="space-y-0.5">
              {g.itens.map((i) => (
                <div key={i.conta} className="flex justify-between py-1.5 text-sm border-b border-border/40 last:border-b-0">
                  <span className="text-muted-foreground truncate pr-2">{i.conta}</span>
                  <span className="tabular-nums font-medium shrink-0">{BRL(i.valor)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-border text-sm font-medium">
              <span>Subtotal</span>
              <span className="tabular-nums">{BRL(g.subtotal)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

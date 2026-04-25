import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Upload, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { BRL } from "@/lib/format";
import {
  useBudgetVsActual,
  useImportYallaModel,
  type BudgetVsActualRow,
} from "@/lib/queries/admin";

function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

type Period = "current" | "ytd" | "last3" | "next6";

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "current") {
    return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
  if (p === "ytd") {
    return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
  if (p === "last3") {
    return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
  // next6
  return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 6, 0)) };
}

export function PrevistoRealizadoTab({ companyId }: { companyId: string | null | undefined }) {
  const [period, setPeriod] = useState<Period>("ytd");
  const range = useMemo(() => periodRange(period), [period]);
  const q = useBudgetVsActual(companyId, { ...range, scenario: "orcado" });
  const importMut = useImportYallaModel(companyId);

  // Group by managerial_account and sum across the period
  const grouped = useMemo(() => {
    const map = new Map<string, { budget: number; actual: number; rows: BudgetVsActualRow[] }>();
    for (const r of q.data ?? []) {
      const cur = map.get(r.managerial_account) ?? { budget: 0, actual: 0, rows: [] };
      cur.budget += r.budget;
      cur.actual += r.actual;
      cur.rows.push(r);
      map.set(r.managerial_account, cur);
    }
    return [...map.entries()]
      .map(([acc, v]) => {
        const variance = v.actual - v.budget;
        const variance_pct = v.budget !== 0 ? (variance / Math.abs(v.budget)) * 100 : null;
        return { account: acc, ...v, variance, variance_pct };
      })
      .sort((a, b) => a.account.localeCompare(b.account));
  }, [q.data]);

  const totals = useMemo(() => {
    let b = 0, a = 0;
    for (const g of grouped) { b += g.budget; a += g.actual; }
    const variance = a - b;
    const pct = b !== 0 ? (variance / Math.abs(b)) * 100 : null;
    return { budget: b, actual: a, variance, pct };
  }, [grouped]);

  const handleImport = () => {
    toast.promise(importMut.mutateAsync({ scenario: "orcado", clearExisting: true }), {
      loading: "Importando modelo Yalla Green...",
      success: (r) =>
        `Importado: ${r.mapping_rows} contas no plano + ${r.budget_rows} valores em ${r.months} meses`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Previsto x Realizado</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Modelagem Yalla Green — receita por faturamento (NF). Realizado vem do DRE consolidado.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["current", "ytd", "last3", "next6"] as Period[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                onClick={() => setPeriod(p)}
              >
                {p === "current" ? "Mês atual" : p === "ytd" ? "YTD" : p === "last3" ? "Últ. 3 meses" : "Próx. 6 meses"}
              </Button>
            ))}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2" disabled={importMut.isPending}>
                  {importMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Re-importar modelo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Re-importar modelagem Yalla Green</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso substitui o cenário "orçado" para todas as contas gerenciais da modelagem
                    e recria o plano de contas (DE-PARA) Yalla Green. Lançamentos OMIE existentes
                    não são afetados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleImport}>Importar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-64" />
          ) : grouped.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground space-y-3">
              <p>Nenhum dado de Previsto encontrado para este período.</p>
              <p className="text-xs">
                Use "Re-importar modelo" para carregar a modelagem Yalla Green (jan/2026 → dez/2031).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5">Conta gerencial</th>
                    <th className="py-2.5 text-right">Previsto</th>
                    <th className="py-2.5 text-right">Realizado</th>
                    <th className="py-2.5 text-right">Δ</th>
                    <th className="py-2.5 text-right">Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((g) => {
                    const sev = g.variance_pct == null ? 0 : Math.abs(g.variance_pct);
                    const off = sev > 10;
                    return (
                      <tr key={g.account} className="border-b border-border/60">
                        <td className="py-2 font-mono text-xs">{g.account}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">{BRL(g.budget)}</td>
                        <td className="py-2 text-right tabular-nums">{BRL(g.actual)}</td>
                        <td className={`py-2 text-right tabular-nums ${g.variance < 0 ? "text-destructive" : "text-success"}`}>
                          {BRL(g.variance)}
                        </td>
                        <td className="py-2 text-right">
                          {g.variance_pct == null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                off
                                  ? "border-destructive/40 text-destructive bg-destructive/10 gap-1"
                                  : "border-border text-muted-foreground gap-1"
                              }
                            >
                              {g.variance_pct >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                              {g.variance_pct.toFixed(1)}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className="py-3">Total</td>
                    <td className="py-3 text-right tabular-nums">{BRL(totals.budget)}</td>
                    <td className="py-3 text-right tabular-nums">{BRL(totals.actual)}</td>
                    <td className={`py-3 text-right tabular-nums ${totals.variance < 0 ? "text-destructive" : "text-success"}`}>
                      {BRL(totals.variance)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-xs">
                      {totals.pct == null ? "—" : `${totals.pct.toFixed(1)}%`}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Período: {fmtMonth(range.from)} → {fmtMonth(range.to)} · {grouped.length} contas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
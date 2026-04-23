import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { useDreEntriesByLine } from "@/lib/queries/dre";
import type { GlobalFilters } from "@/lib/filters-context";
import { BRL } from "@/lib/format";
import { downloadCsv } from "@/lib/export-csv";
import { toast } from "sonner";

export function DreLineDrilldown({
  open,
  onOpenChange,
  companyId,
  lineLabel,
  period,
  filters,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string | null | undefined;
  lineLabel: string | null;
  period: string;
  filters?: Partial<GlobalFilters>;
}) {
  const { data = [], isLoading } = useDreEntriesByLine(companyId, lineLabel, period, filters);
  const total = data.reduce((s, r) => s + r.amount_signed, 0);

  const handleExport = () => {
    if (!data.length) return;
    downloadCsv(
      data.map((r) => ({
        data: r.competence_date,
        grupo: r.dre_group,
        descricao: r.description ?? r.supplier_name ?? r.customer_name ?? "",
        categoria: r.category_mapped ?? "",
        valor: r.amount_signed,
      })),
      `dre_${(lineLabel ?? "linha").replace(/[^a-z0-9]+/gi, "_")}`,
      [
        { key: "data", label: "Data" },
        { key: "grupo", label: "Grupo DRE" },
        { key: "descricao", label: "Descrição" },
        { key: "categoria", label: "Categoria" },
        { key: "valor", label: "Valor" },
      ],
    );
    toast.success("CSV exportado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Lançamentos · {lineLabel ?? ""}</span>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!data.length} className="gap-1.5">
              <Download className="size-3.5" /> CSV
            </Button>
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : data.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground text-center">
            Nenhum lançamento encontrado para esta linha no período/filtros atuais.
          </p>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2">Data</th>
                  <th className="py-2">Grupo</th>
                  <th className="py-2">Descrição</th>
                  <th className="py-2">Categoria</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-1.5 text-xs">{r.competence_date}</td>
                    <td className="py-1.5 text-xs text-muted-foreground">{r.dre_group}</td>
                    <td className="py-1.5 max-w-sm truncate">
                      {r.description ?? r.supplier_name ?? r.customer_name ?? "—"}
                    </td>
                    <td className="py-1.5 text-xs font-mono text-muted-foreground">{r.category_mapped ?? "—"}</td>
                    <td className={`py-1.5 text-right tabular-nums ${r.amount_signed < 0 ? "text-destructive" : "text-success"}`}>
                      {BRL(r.amount_signed)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td colSpan={4} className="py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Total ({data.length} lançamento{data.length > 1 ? "s" : ""})
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{BRL(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
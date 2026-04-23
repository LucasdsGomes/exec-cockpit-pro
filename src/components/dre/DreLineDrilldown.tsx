import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { useDreEntriesByLine } from "@/lib/queries/dre";
import type { GlobalFilters } from "@/lib/filters-context";
import { BRL } from "@/lib/format";
import { downloadCsv } from "@/lib/export-csv";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const isMobile = useIsMobile();

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

  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate">Lançamentos · {lineLabel ?? ""}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={!data.length}
        className="gap-1.5 shrink-0"
      >
        <Download className="size-3.5" /> CSV
      </Button>
    </div>
  );

  const body = isLoading ? (
    <Skeleton className="h-64" />
  ) : data.length === 0 ? (
    <p className="py-10 text-sm text-muted-foreground text-center">
      Nenhum lançamento encontrado para esta linha no período/filtros atuais.
    </p>
  ) : isMobile ? (
    <div className="space-y-2 overflow-y-auto max-h-[70vh] pr-1">
      {data.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-border bg-card/40 p-3 text-sm"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {r.competence_date}
            </span>
            <span
              className={cn(
                "tabular-nums font-semibold text-sm shrink-0",
                r.amount_signed < 0 ? "text-destructive" : "text-success",
              )}
            >
              {BRL(r.amount_signed)}
            </span>
          </div>
          <div className="text-sm leading-snug break-words">
            {r.description ?? r.supplier_name ?? r.customer_name ?? "—"}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {r.dre_group}
            </span>
            {r.category_mapped && (
              <span className="text-[10px] font-mono text-muted-foreground">
                · {r.category_mapped}
              </span>
            )}
          </div>
        </div>
      ))}
      <div className="sticky bottom-0 -mx-1 mt-2 border-t border-border bg-background pt-2 px-1 flex items-center justify-between text-sm">
        <span className="text-xs text-muted-foreground">
          Total ({data.length} lanç.)
        </span>
        <span className="font-semibold tabular-nums">{BRL(total)}</span>
      </div>
    </div>
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
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle>{header}</SheetTitle>
          </SheetHeader>
          <div className="mt-3 flex-1 min-h-0">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{header}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { BRL } from "@/lib/format";
import {
  useBudgetEntries,
  useUploadBudget,
  type BudgetCsvRow,
  type BudgetScenario,
} from "@/lib/queries/admin";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const SCENARIOS: { v: BudgetScenario; l: string }[] = [
  { v: "orcado", l: "Orçado" },
  { v: "reprojetado", l: "Reprojetado" },
  { v: "realizado", l: "Realizado" },
];

/**
 * Expected CSV columns (header row required):
 *   reference_period (YYYY-MM-DD or YYYY-MM), managerial_account, amount, category_mapped (optional)
 */
function parseCsv(text: string): BudgetCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV vazio ou sem cabeçalho");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const ip = idx("reference_period");
  const ima = idx("managerial_account");
  const ia = idx("amount");
  const ic = idx("category_mapped");
  if (ip < 0 || ima < 0 || ia < 0) {
    throw new Error("Cabeçalhos obrigatórios: reference_period, managerial_account, amount");
  }
  const rows: BudgetCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    let period = cols[ip];
    if (/^\d{4}-\d{2}$/.test(period)) period = `${period}-01`;
    rows.push({
      reference_period: period,
      managerial_account: cols[ima],
      amount: Number(cols[ia].replace(",", ".")),
      category_mapped: ic >= 0 ? cols[ic] || null : null,
    });
  }
  return rows;
}

export function BudgetTab({ companyId }: { companyId: string | null | undefined }) {
  const list = useBudgetEntries(companyId);
  const upload = useUploadBudget(companyId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [scenario, setScenario] = useState<BudgetScenario>("orcado");
  const [filterScenario, setFilterScenario] = useState<BudgetScenario | "all">("all");

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      setPreviewCount(rows.length);
      await toast.promise(upload.mutateAsync({ rows, scenario }), {
        loading: `Importando ${rows.length} linhas (${scenario})...`,
        success: (n) => `${n} linhas importadas`,
        error: (e) => `Erro: ${e.message}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filtered = (list.data ?? []).filter((b) =>
    filterScenario === "all" ? true : b.scenario === filterScenario,
  );

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" /> Importar orçamento (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cabeçalhos obrigatórios: <code className="font-mono">reference_period, managerial_account, amount</code>.
            Opcional: <code className="font-mono">category_mapped</code>. Período em <code>YYYY-MM</code> ou <code>YYYY-MM-DD</code>.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cenário do upload:</span>
            <Select value={scenario} onValueChange={(v) => setScenario(v as BudgetScenario)}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="gap-2">
            <Upload className="size-4" />
            Selecionar arquivo
          </Button>
          {previewCount != null && (
            <p className="text-xs text-muted-foreground">Última importação: {previewCount} linhas.</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Linhas de orçamento ({filtered.length})</CardTitle>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Filtrar:</span>
            <Select value={filterScenario} onValueChange={(v) => setFilterScenario(v as BudgetScenario | "all")}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos cenários</SelectItem>
                {SCENARIOS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <Skeleton className="h-32" /> : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento cadastrado.</p>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5">Período</th>
                    <th className="py-2.5">Conta gerencial</th>
                    <th className="py-2.5">Categoria</th>
                    <th className="py-2.5">Cenário</th>
                    <th className="py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b border-border/60">
                      <td className="py-2 text-xs">{b.reference_period}</td>
                      <td className="py-2">{b.managerial_account}</td>
                      <td className="py-2 text-xs text-muted-foreground">{b.category_mapped ?? "—"}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border text-muted-foreground">
                          {b.scenario}
                        </Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">{BRL(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
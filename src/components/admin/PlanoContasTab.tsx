import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCategoryMappings,
  useUpdateCategoryMapping,
  useBulkUpsertCategoryMappings,
  type CategoryMapImportRow,
} from "@/lib/queries/admin";
import plan from "@/integrations/yalla-green/plan.json";
import { CheckCircle2, Search, AlertCircle, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type StatusFilter = "todos" | "mapeado" | "sem_dre" | "sem_dfc";

const DRE_OPTIONS = [
  ...new Set(
    (plan as { dre_accounts: Array<{ level1_name: string | null }> }).dre_accounts
      .map((a) => a.level1_name)
      .filter((n): n is string => !!n),
  ),
];
const DFC_OPTIONS = [
  ...new Set(
    (plan as { dfc_accounts: Array<{ level1_name: string | null }> }).dfc_accounts
      .map((a) => a.level1_name)
      .filter((n): n is string => !!n),
  ),
];
const NONE = "__none__";

// Heurística de cabeçalho: aceita variações "Código", "codigo_omie", "Code", etc.
function normalizeHeader(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const HEADER_MAP: Record<string, keyof CategoryMapImportRow> = {
  codigo: "omie_category_code",
  code: "omie_category_code",
  omie_category_code: "omie_category_code",
  codigo_omie: "omie_category_code",
  cod: "omie_category_code",
  descricao: "omie_category_description",
  description: "omie_category_description",
  omie_category_description: "omie_category_description",
  nome: "omie_category_description",
  dre: "dre_category",
  dre_category: "dre_category",
  grupo_dre: "dre_category",
  dfc: "dfc_category",
  dfc_category: "dfc_category",
  grupo_dfc: "dfc_category",
  flow_type: "flow_type",
  fluxo: "flow_type",
  tipo_fluxo: "flow_type",
};

export function PlanoContasTab({ companyId }: { companyId: string | null | undefined }) {
  const mappings = useCategoryMappings(companyId);
  const update = useUpdateCategoryMapping(companyId);
  const bulkImport = useBulkUpsertCategoryMappings(companyId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = mappings.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.omie_category_code} ${r.omie_category_description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (status === "mapeado") return !!r.dre_category && !!r.dfc_category;
      if (status === "sem_dre") return !r.dre_category;
      if (status === "sem_dfc") return !r.dfc_category;
      return true;
    });
  }, [rows, search, status]);

  const totalMapped = useMemo(() => rows.filter((r) => !!r.dre_category && !!r.dfc_category).length, [rows]);
  const semDre = useMemo(() => rows.filter((r) => !r.dre_category).length, [rows]);
  const semDfc = useMemo(() => rows.filter((r) => !r.dfc_category).length, [rows]);
  const pct = rows.length === 0 ? 0 : Math.round((totalMapped / rows.length) * 100);

  const handleChange = (id: string, field: "dre_category" | "dfc_category", value: string) => {
    const v = value === NONE ? null : value;
    toast.promise(update.mutateAsync({ id, [field]: v }), {
      loading: "Salvando...",
      success: "Atualizado",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleDownloadTemplate = () => {
    const sample = [
      { codigo: "1.01.01", descricao: "Receita de serviços", dre: "Receita Líquida", dfc: "Receitas Operacionais", flow_type: "operacional" },
      { codigo: "2.01.01", descricao: "Folha de pagamento", dre: "Despesas com Pessoal", dfc: "Pagamentos a Pessoal", flow_type: "operacional" },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DE-PARA");
    XLSX.writeFile(wb, "template_de_para.xlsx");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("Planilha vazia");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!raw.length) throw new Error("Nenhuma linha encontrada");

      // Mapear cabeçalhos para nossos campos
      const parsed: CategoryMapImportRow[] = raw
        .map((r) => {
          const out: Partial<CategoryMapImportRow> = {};
          for (const [k, v] of Object.entries(r)) {
            const key = HEADER_MAP[normalizeHeader(k)];
            if (!key) continue;
            const val = v == null ? "" : String(v).trim();
            (out as Record<string, string | null>)[key] = val || null;
          }
          return out as CategoryMapImportRow;
        })
        .filter((r) => r.omie_category_code);

      if (!parsed.length) {
        toast.error("Nenhuma coluna 'código' identificada. Use o template como referência.");
        return;
      }

      const result = await toast.promise(bulkImport.mutateAsync(parsed), {
        loading: `Importando ${parsed.length} linhas...`,
        success: (r) =>
          `Importado · ${r.created} criadas · ${r.updated} atualizadas · ${r.skipped} ignoradas`,
        error: (err) => `Erro: ${err.message}`,
      });
      void result;
    } catch (err) {
      toast.error(`Falha ao ler planilha: ${(err as Error).message}`);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-base">Plano de Contas</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {totalMapped} de {rows.length} categorias mapeadas ({pct}%) ·{" "}
              <span className={semDre > 0 ? "text-warning" : "text-success"}>{semDre} sem DRE</span> ·{" "}
              <span className={semDfc > 0 ? "text-warning" : "text-success"}>{semDfc} sem DFC</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadTemplate}
              className="gap-1.5 h-8"
              title="Baixar template em Excel"
            >
              <Download className="size-3.5" /> Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={bulkImport.isPending}
              className="gap-1.5 h-8"
            >
              <Upload className="size-3.5" /> Importar XLSX
            </Button>
            <div className="relative">
              <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar código ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 h-8 w-64"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="mapeado">Mapeados</SelectItem>
                <SelectItem value="sem_dre">Sem DRE</SelectItem>
                <SelectItem value="sem_dfc">Sem DFC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Dica: para importar em massa, baixe o <strong>Template</strong>, edite no Excel e use{" "}
          <strong>Importar XLSX</strong>. Aceita as colunas: <code>codigo</code>, <code>descricao</code>,{" "}
          <code>dre</code>, <code>dfc</code>, <code>flow_type</code> (operacional/investimento/financiamento).
        </p>
      </CardHeader>
      <CardContent>
        {mappings.isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2.5 pr-3">Código</th>
                  <th className="py-2.5 pr-3">Descrição</th>
                  <th className="py-2.5 pr-3 w-56">DRE</th>
                  <th className="py-2.5 w-56">DFC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const mapped = !!d.dre_category && !!d.dfc_category;
                  return (
                    <tr key={d.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {mapped ? (
                            <CheckCircle2 className="size-3 text-success" />
                          ) : (
                            <AlertCircle className="size-3 text-warning" />
                          )}
                          {d.omie_category_code}
                        </div>
                      </td>
                      <td className="py-2 pr-3" title={d.flow_type ?? undefined}>
                        {d.omie_category_description ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <InlineSelect
                          value={d.dre_category}
                          options={DRE_OPTIONS}
                          onChange={(v) => handleChange(d.id, "dre_category", v)}
                          tone="primary"
                        />
                      </td>
                      <td className="py-2">
                        <InlineSelect
                          value={d.dfc_category}
                          options={DFC_OPTIONS}
                          onChange={(v) => handleChange(d.id, "dfc_category", v)}
                          tone="success"
                        />
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma categoria neste filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InlineSelect({
  value,
  options,
  onChange,
  tone,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
  tone: "primary" | "success";
}) {
  const cls =
    tone === "primary"
      ? "border-primary/30 text-primary bg-primary/5"
      : "border-success/30 text-success bg-success/5";
  return (
    <Select value={value ?? NONE} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs ${value ? cls : "text-muted-foreground"}`}>
        <SelectValue placeholder="Definir..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

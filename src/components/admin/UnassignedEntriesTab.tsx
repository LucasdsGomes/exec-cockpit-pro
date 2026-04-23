import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FolderTree, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { BRL } from "@/lib/format";
import {
  useUnassignedCcEntries,
  useCostCenters,
  useBulkAssignCostCenter,
  useApplyCostCenterRules,
} from "@/lib/queries/admin";

export function UnassignedEntriesTab({ companyId }: { companyId: string | null | undefined }) {
  const list = useUnassignedCcEntries(companyId);
  const ccs = useCostCenters(companyId);
  const bulk = useBulkAssignCostCenter(companyId);
  const applyRules = useApplyCostCenterRules(companyId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string>("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const all = list.data ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (r) =>
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.supplier_name ?? "").toLowerCase().includes(q) ||
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        (r.category_raw ?? "").toLowerCase().includes(q),
    );
  }, [list.data, search]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = (v: boolean) => {
    const s = new Set(selected);
    for (const r of rows) (v ? s.add : s.delete).call(s, r.id);
    setSelected(s);
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const handleApplyRules = async () => {
    await toast.promise(applyRules.mutateAsync(), {
      loading: "Aplicando regras automáticas…",
      success: (r) => `Regras aplicadas · ${r.entries_updated} lançamentos atualizados`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleApplyBulk = async () => {
    if (!target) { toast.error("Selecione um centro de custo"); return; }
    if (selected.size === 0) { toast.error("Selecione ao menos um lançamento"); return; }
    await toast.promise(
      bulk.mutateAsync({ entryIds: [...selected], costCenterId: target }),
      {
        loading: `Atribuindo CC a ${selected.size} lançamento(s)…`,
        success: (n) => `${n} lançamento(s) atualizados`,
        error: (e) => `Erro: ${e.message}`,
      },
    );
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderTree className="size-4 text-primary" /> Lançamentos sem Centro de Custo
            <Badge variant="outline" className="ml-2 border-border text-muted-foreground">
              {(list.data ?? []).length}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleApplyRules}
            disabled={applyRules.isPending}
          >
            <Wand2 className="size-3.5" /> Aplicar regras automáticas
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-5 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por descrição, fornecedor, categoria…"
                className="pl-7 h-9"
              />
            </div>
            <div className="md:col-span-4">
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Centro de custo destino" />
                </SelectTrigger>
                <SelectContent>
                  {(ccs.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Button
                onClick={handleApplyBulk}
                disabled={bulk.isPending || selected.size === 0 || !target}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
              >
                Aplicar a {selected.size} selecionado(s)
              </Button>
            </div>
          </div>

          {list.isLoading ? (
            <Skeleton className="h-48" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              {(list.data ?? []).length === 0
                ? "Nenhum lançamento sem centro de custo 🎉"
                : "Nenhum resultado para a busca."}
            </p>
          ) : (
            <div className="overflow-auto max-h-[520px] border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pl-3 w-10">
                      <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                    </th>
                    <th className="py-2">Data</th>
                    <th className="py-2">Histórico</th>
                    <th className="py-2">Categoria</th>
                    <th className="py-2 text-right pr-3">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="py-2 pl-3">
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                      </td>
                      <td className="py-2 text-xs">{r.competence_date}</td>
                      <td className="py-2 max-w-md truncate">
                        {r.description ?? r.supplier_name ?? r.customer_name ?? "—"}
                      </td>
                      <td className="py-2 text-xs font-mono text-muted-foreground">
                        {r.category_mapped ?? r.category_raw ?? "—"}
                      </td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${r.amount_signed < 0 ? "text-destructive" : "text-success"}`}>
                        {BRL(r.amount_signed)}
                      </td>
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
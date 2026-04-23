import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Play, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCostCenterRules,
  useUpsertCostCenterRule,
  useDeleteCostCenterRule,
  useApplyCostCenterRules,
} from "@/lib/queries/admin";
import { useCostCenterOptions } from "@/lib/queries/filters";

const MATCH_LABELS: Record<string, string> = {
  category: "Categoria OMIE",
  supplier: "Fornecedor",
  customer: "Cliente",
  description: "Descrição/histórico",
};

export function CostCenterRulesTab({ companyId }: { companyId: string | null | undefined }) {
  const rules = useCostCenterRules(companyId);
  const { data: ccs = [] } = useCostCenterOptions(companyId);
  const upsert = useUpsertCostCenterRule(companyId);
  const del = useDeleteCostCenterRule(companyId);
  const apply = useApplyCostCenterRules(companyId);

  const [draft, setDraft] = useState({
    rule_name: "",
    match_type: "category" as "category" | "supplier" | "customer" | "description",
    match_pattern: "",
    cost_center_id: "",
    priority: 100,
  });

  const handleAdd = () => {
    if (!draft.rule_name || !draft.match_pattern || !draft.cost_center_id) {
      toast.error("Preencha nome, padrão e centro de custo");
      return;
    }
    toast.promise(
      upsert.mutateAsync(draft).then(() => {
        setDraft({ rule_name: "", match_type: "category", match_pattern: "", cost_center_id: "", priority: 100 });
      }),
      { loading: "Salvando regra…", success: "Regra criada", error: (e) => `Erro: ${e.message}` },
    );
  };

  const handleApply = () => {
    toast.promise(apply.mutateAsync(), {
      loading: "Aplicando regras nos lançamentos…",
      success: (r) => `Atribuído CC em ${r.entries_updated} lançamento(s) e ${r.dre_updated} linha(s) do DRE`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="size-4 text-primary" /> Regras de atribuição de centro de custo
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Quando o ERP não preenche o centro de custo, estas regras atribuem automaticamente.
              Use <code>%</code> como curinga (ex.: <code>%energia%</code>).
            </p>
          </div>
          <Button onClick={handleApply} disabled={apply.isPending} className="gap-2">
            {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Aplicar regras agora
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4 p-3 bg-background/50 rounded-md border border-border">
            <Input
              placeholder="Nome da regra"
              value={draft.rule_name}
              onChange={(e) => setDraft({ ...draft, rule_name: e.target.value })}
              className="md:col-span-2"
            />
            <Select
              value={draft.match_type}
              onValueChange={(v) => setDraft({ ...draft, match_type: v as typeof draft.match_type })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MATCH_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Padrão (ex: %energia%)"
              value={draft.match_pattern}
              onChange={(e) => setDraft({ ...draft, match_pattern: e.target.value })}
            />
            <Select
              value={draft.cost_center_id}
              onValueChange={(v) => setDraft({ ...draft, cost_center_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Centro de custo" /></SelectTrigger>
              <SelectContent>
                {ccs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={upsert.isPending} className="gap-2">
              {upsert.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Adicionar
            </Button>
          </div>

          {rules.isLoading ? (
            <Skeleton className="h-32" />
          ) : (rules.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma regra cadastrada. Crie regras acima para atribuir centro de custo automaticamente.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2.5">Prio.</th>
                  <th className="py-2.5">Nome</th>
                  <th className="py-2.5">Tipo</th>
                  <th className="py-2.5">Padrão</th>
                  <th className="py-2.5">→ Centro de custo</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {(rules.data ?? []).map((r) => {
                  const cc = ccs.find((c) => c.id === r.cost_center_id);
                  return (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 text-xs tabular-nums">{r.priority}</td>
                      <td className="py-2">{r.rule_name}</td>
                      <td className="py-2 text-xs text-muted-foreground">{MATCH_LABELS[r.match_type]}</td>
                      <td className="py-2 font-mono text-xs">{r.match_pattern}</td>
                      <td className="py-2 text-xs">
                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                          {cc?.label ?? r.cost_center_id.slice(0, 8)}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {r.active ? (
                          <Badge variant="outline" className="border-success/40 text-success bg-success/10">Ativa</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inativa</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toast.promise(del.mutateAsync(r.id), {
                              loading: "Removendo…",
                              success: "Regra removida",
                              error: (e) => `Erro: ${e.message}`,
                            })
                          }
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
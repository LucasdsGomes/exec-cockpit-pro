import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useManualParameters, useUpsertManualParameter } from "@/lib/queries/admin";

const KNOWN_PARAMS: { key: string; label: string; help: string }[] = [
  { key: "inventory_value", label: "Valor de estoque atual (R$)", help: "Usado para calcular PME (Prazo Médio de Estoque)." },
  { key: "tax_rate", label: "Alíquota de impostos (%)", help: "Usado em projeções." },
  { key: "discount_rate", label: "Taxa de desconto (% a.a.)", help: "Usado em valuation." },
];

export function ParametersTab({ companyId }: { companyId: string | null | undefined }) {
  const list = useManualParameters(companyId);
  const upsert = useUpsertManualParameter(companyId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const valueFor = (key: string) => {
    const existing = list.data?.find((p) => p.param_key === key);
    return drafts[key] ?? (existing?.param_value != null ? String(existing.param_value) : "");
  };

  const save = async (key: string) => {
    const raw = valueFor(key);
    if (!raw) { toast.error("Valor obrigatório"); return; }
    const existing = list.data?.find((p) => p.param_key === key);
    await toast.promise(
      upsert.mutateAsync({
        id: existing?.id,
        param_key: key,
        param_value: Number(raw.replace(",", ".")),
      }),
      { loading: "Salvando...", success: "Parâmetro salvo", error: (e) => `Erro: ${e.message}` },
    );
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base">Parâmetros gerenciais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.isLoading ? <Skeleton className="h-32" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {KNOWN_PARAMS.map((p) => (
              <div key={p.key} className="rounded-lg border border-border p-3 bg-background/40">
                <Label className="text-xs">{p.label}</Label>
                <p className="text-[11px] text-muted-foreground mb-2">{p.help}</p>
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    value={valueFor(p.key)}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
                    placeholder="0,00"
                  />
                  <Button size="sm" onClick={() => save(p.key)} disabled={upsert.isPending}>Salvar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
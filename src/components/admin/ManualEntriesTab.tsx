import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BRL } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useManualEntries, useCreateManualEntry } from "@/lib/queries/admin";

const KINDS = [
  { value: "ajuste_dre", label: "Ajuste DRE" },
  { value: "ajuste_caixa", label: "Ajuste Caixa" },
  { value: "provisao", label: "Provisão" },
  { value: "estorno", label: "Estorno" },
];

export function ManualEntriesTab({ companyId }: { companyId: string | null | undefined }) {
  const { user } = useAuth();
  const list = useManualEntries(companyId);
  const create = useCreateManualEntry(companyId, user?.id ?? null);

  const [form, setForm] = useState({
    description: "",
    reason: "",
    entry_kind: "ajuste_dre",
    amount: "",
    direction: "saida" as "entrada" | "saida",
    reference_date: new Date().toISOString().slice(0, 10),
    dre_group: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.reason || !form.amount) {
      toast.error("Descrição, motivo e valor são obrigatórios");
      return;
    }
    await toast.promise(
      create.mutateAsync({
        description: form.description,
        reason: form.reason,
        entry_kind: form.entry_kind,
        amount: Number(form.amount.replace(",", ".")),
        direction: form.direction,
        reference_date: form.reference_date,
        dre_group: form.dre_group || null,
      }),
      { loading: "Salvando...", success: "Ajuste registrado", error: (e) => `Erro: ${e.message}` },
    );
    setForm({ ...form, description: "", reason: "", amount: "", dre_group: "" });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Novo ajuste manual</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-3">
              <Label className="text-xs">Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Provisão de férias" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.entry_kind} onValueChange={(v) => setForm({ ...form, entry_kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Direção</Label>
              <Select value={form.direction} onValueChange={(v: "entrada" | "saida") => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (+)</SelectItem>
                  <SelectItem value="saida">Saída (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Data ref.</Label>
              <Input type="date" value={form.reference_date} onChange={(e) => setForm({ ...form, reference_date: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Grupo DRE (opcional)</Label>
              <Input value={form.dre_group} onChange={(e) => setForm({ ...form, dre_group: e.target.value })} placeholder="Ex.: Despesas Operacionais" />
            </div>
            <div className="md:col-span-6">
              <Label className="text-xs">Motivo</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Justificativa do ajuste (obrigatório para auditoria)"
                rows={2}
              />
            </div>
            <div className="md:col-span-6">
              <Button type="submit" disabled={create.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Registrar ajuste
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Ajustes registrados</CardTitle></CardHeader>
        <CardContent>
          {list.isLoading ? <Skeleton className="h-32" /> : (list.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ajuste manual registrado.</p>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5">Data</th>
                    <th className="py-2.5">Descrição</th>
                    <th className="py-2.5">Tipo</th>
                    <th className="py-2.5">Motivo</th>
                    <th className="py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data ?? []).map((m) => (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="py-2 text-xs">{m.reference_date}</td>
                      <td className="py-2">{m.description}</td>
                      <td className="py-2 text-xs text-muted-foreground">{m.entry_kind}</td>
                      <td className="py-2 text-xs text-muted-foreground max-w-xs truncate" title={m.reason}>{m.reason}</td>
                      <td className={`py-2 text-right tabular-nums ${m.amount_signed < 0 ? "text-destructive" : "text-success"}`}>
                        {BRL(m.amount_signed)}
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
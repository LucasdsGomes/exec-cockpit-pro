import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { BRL } from "@/lib/format";
import {
  useInitialBalances,
  useUpsertInitialBalance,
  useDeleteInitialBalance,
} from "@/lib/queries/admin";

const TYPES = [
  { value: "caixa", label: "Caixa / Banco" },
  { value: "estoque", label: "Estoques" },
  { value: "imobilizado", label: "Imobilizado" },
  { value: "outros_ativos", label: "Outros ativos" },
  { value: "emprestimos", label: "Empréstimos" },
  { value: "outros_passivos", label: "Outros passivos" },
  { value: "capital", label: "Capital social" },
];

export function InitialBalancesTab({ companyId }: { companyId: string | null | undefined }) {
  const list = useInitialBalances(companyId);
  const upsert = useUpsertInitialBalance(companyId);
  const del = useDeleteInitialBalance(companyId);

  const [form, setForm] = useState({
    account_label: "",
    balance_type: "caixa",
    amount: "",
    reference_date: new Date().toISOString().slice(0, 10),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_label || !form.amount) {
      toast.error("Preencha conta e valor");
      return;
    }
    await toast.promise(
      upsert.mutateAsync({
        account_label: form.account_label,
        balance_type: form.balance_type,
        amount: Number(form.amount.replace(",", ".")),
        reference_date: form.reference_date,
      }),
      { loading: "Salvando...", success: "Saldo inicial cadastrado", error: (e) => `Erro: ${e.message}` },
    );
    setForm({ ...form, account_label: "", amount: "" });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4 text-primary" /> Adicionar saldo inicial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">Conta / descrição</Label>
              <Input
                value={form.account_label}
                onChange={(e) => setForm({ ...form, account_label: e.target.value })}
                placeholder="Ex.: Banco Itaú CC 12345-6"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.balance_type} onValueChange={(v) => setForm({ ...form, balance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label className="text-xs">Data referência</Label>
              <Input
                type="date"
                value={form.reference_date}
                onChange={(e) => setForm({ ...form, reference_date: e.target.value })}
              />
            </div>
            <div className="md:col-span-5">
              <Button type="submit" disabled={upsert.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Saldos cadastrados</CardTitle></CardHeader>
        <CardContent>
          {list.isLoading ? <Skeleton className="h-32" /> : (list.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum saldo inicial cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2.5">Conta</th>
                  <th className="py-2.5">Tipo</th>
                  <th className="py-2.5">Data referência</th>
                  <th className="py-2.5 text-right">Valor</th>
                  <th className="py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((b) => (
                  <tr key={b.id} className="border-b border-border/60">
                    <td className="py-2">{b.account_label ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{b.balance_type}</td>
                    <td className="py-2 text-xs">{b.reference_date}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{BRL(Number(b.amount))}</td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => del.mutate(b.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, Wallet, Sparkles, RefreshCw, Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BRL } from "@/lib/format";
import {
  useInitialBalances,
  useUpsertInitialBalance,
  useDeleteInitialBalance,
  useBankAccounts,
  useSeedInitialBalances,
  useBatchUpdateInitialBalances,
  useBankAccountsStatus,
  useSyncBankStatements,
  useImportBankMovements,
  type ManualBankMovementInput,
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
  const banks = useBankAccounts(companyId);
  const seed = useSeedInitialBalances(companyId);
  const batchUpdate = useBatchUpdateInitialBalances(companyId);
  const status = useBankAccountsStatus(companyId);
  const syncOne = useSyncBankStatements(companyId);
  const importMoves = useImportBankMovements(companyId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<string>("");

  const [form, setForm] = useState({
    account_label: "",
    balance_type: "caixa",
    amount: "",
    reference_date: new Date().toISOString().slice(0, 10),
  });

  // Wizard state: bank-account driven balances
  const bankBalances = useMemo(
    () => (list.data ?? []).filter((b) => b.bank_account_id),
    [list.data],
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const d: Record<string, string> = {};
    for (const b of bankBalances) d[b.id] = String(b.amount ?? 0).replace(".", ",");
    setDraft(d);
  }, [bankBalances]);

  const handleSeed = async () => {
    await toast.promise(seed.mutateAsync(), {
      loading: "Criando linhas para cada conta…",
      success: (r) => `${r?.inserted ?? 0} contas adicionadas`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleSaveAll = async () => {
    const updates = bankBalances.map((b) => ({
      id: b.id,
      amount: Number((draft[b.id] ?? "0").replace(",", ".")) || 0,
    }));
    await toast.promise(batchUpdate.mutateAsync(updates), {
      loading: "Salvando saldos e recalculando caixa…",
      success: (n) => `${n} saldos salvos · projeção atualizada`,
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const showSeedCta = (banks.data ?? []).length > 0 && bankBalances.length === 0;
  const totalBank = bankBalances.reduce(
    (sum, b) => sum + (Number((draft[b.id] ?? "0").replace(",", ".")) || 0),
    0,
  );

  const handleResync = (bankAccountId: string) => {
    toast.promise(syncOne.mutateAsync({ lookbackDays: 90, bankAccountId }), {
      loading: "Resincronizando extrato dessa conta…",
      success: "Extrato atualizado",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const handleImportFile = async (file: File) => {
    if (!importTarget) {
      toast.error("Selecione a conta destino antes de importar");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".ofx")
        ? parseOfx(text, importTarget)
        : parseCsvMovements(text, importTarget);
      if (!rows.length) throw new Error("Nenhuma movimentação reconhecida no arquivo");
      await toast.promise(importMoves.mutateAsync(rows), {
        loading: `Importando ${rows.length} movimento(s)…`,
        success: (n) => `${n} movimento(s) importado(s) e conciliação disparada`,
        error: (e) => `Erro: ${e.message}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
      {/* Status de extratos por conta + import manual */}
      <Card className="bg-card border-border">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Extratos bancários por conta
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={importTarget} onValueChange={setImportTarget}>
              <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Conta destino p/ importar" /></SelectTrigger>
              <SelectContent>
                {(banks.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.ofx,text/csv,application/x-ofx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
            />
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={importMoves.isPending}>
              <Upload className="size-3.5" /> Importar OFX/CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status.isLoading ? <Skeleton className="h-32" /> : (status.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta bancária ativa.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2">Conta</th>
                  <th className="py-2">nCodCC</th>
                  <th className="py-2">Último extrato</th>
                  <th className="py-2 text-right">Movimentos</th>
                  <th className="py-2 text-right">Não concil.</th>
                  <th className="py-2 text-right pr-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(status.data ?? []).map((s) => {
                  const stale = !s.last_movement_date || daysSince(s.last_movement_date) > 7;
                  return (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="py-2">{s.name}</td>
                      <td className="py-2 text-xs font-mono text-muted-foreground">
                        {s.source_record_id ?? <span className="text-warning">não configurado</span>}
                      </td>
                      <td className="py-2 text-xs">
                        {s.last_movement_date ? (
                          <span className={stale ? "text-warning inline-flex items-center gap-1" : "inline-flex items-center gap-1"}>
                            {stale ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3 text-success" />}
                            {s.last_movement_date} · {daysSince(s.last_movement_date)}d atrás
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{s.movement_count}</td>
                      <td className={`py-2 text-right tabular-nums ${s.unreconciled_count > 0 ? "text-warning" : "text-muted-foreground"}`}>
                        {s.unreconciled_count}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={syncOne.isPending || !s.source_record_id}
                          onClick={() => handleResync(s.id)}
                          className="gap-1.5"
                        >
                          {syncOne.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                          Resync
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            CSV esperado: <code className="font-mono">date,amount,description</code> (data <code>YYYY-MM-DD</code>; valor negativo = saída). OFX padrão também aceito.
          </p>
        </CardContent>
      </Card>

      {/* Wizard de saldo inicial por conta bancária */}
      <Card className="border-primary/30 bg-card surface-card" style={{ backgroundImage: "var(--gradient-kpi-accent)" }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> Saldo de abertura por conta bancária
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Informe o saldo atual de cada conta para o caixa do balanço refletir a realidade. {(banks.data ?? []).length} contas ativas.
          </p>
        </CardHeader>
        <CardContent>
          {showSeedCta ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <div className="text-sm">
                <strong>Nenhum saldo inicial vinculado às contas.</strong> Clique para criar uma linha por conta bancária.
              </div>
              <Button onClick={handleSeed} disabled={seed.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                <Sparkles className="size-3.5" /> Criar linhas
              </Button>
            </div>
          ) : bankBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta bancária ativa encontrada.</p>
          ) : (
            <>
              <div className="space-y-2">
                {bankBalances.map((b) => (
                  <div key={b.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                    <div className="col-span-7 truncate">{b.account_label ?? "—"}</div>
                    <div className="col-span-3">
                      <Input
                        inputMode="decimal"
                        value={draft[b.id] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [b.id]: e.target.value })}
                        className="h-8 text-right tabular-nums"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground text-right">{b.reference_date}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <div className="text-sm">
                  Total: <span className="font-semibold tabular-nums">{BRL(totalBank)}</span>
                </div>
                <Button
                  onClick={handleSaveAll}
                  disabled={batchUpdate.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Salvar tudo e recalcular
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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

function daysSince(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/** Parse a simple CSV: header row with `date,amount,description` (description optional). */
function parseCsvMovements(text: string, bankAccountId: string): ManualBankMovementInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV vazio ou sem cabeçalho");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const di = headers.indexOf("date");
  const ai = headers.indexOf("amount");
  const desci = headers.indexOf("description");
  if (di < 0 || ai < 0) throw new Error("Cabeçalhos obrigatórios: date, amount (description opcional)");
  const rows: ManualBankMovementInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const date = cols[di];
    const amt = Number(cols[ai].replace(",", "."));
    if (!date || !Number.isFinite(amt)) continue;
    rows.push({
      bank_account_id: bankAccountId,
      movement_date: date,
      amount: Math.abs(amt),
      direction: amt < 0 ? "saida" : "entrada",
      description: desci >= 0 ? cols[desci] ?? null : null,
    });
  }
  return rows;
}

/** Minimal OFX parser: extracts <STMTTRN> blocks. Handles both SGML and XML-ish OFX. */
function parseOfx(text: string, bankAccountId: string): ManualBankMovementInput[] {
  const out: ManualBankMovementInput[] = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const tag = (block: string, name: string): string | null => {
    const m = block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"));
    return m ? m[1].trim() : null;
  };
  for (const b of blocks) {
    const dt = tag(b, "DTPOSTED");
    const amt = tag(b, "TRNAMT");
    const memo = tag(b, "MEMO") ?? tag(b, "NAME");
    const fitid = tag(b, "FITID");
    if (!dt || !amt) continue;
    const yyyy = dt.slice(0, 4), mm = dt.slice(4, 6), dd = dt.slice(6, 8);
    const n = Number(amt.replace(",", "."));
    if (!Number.isFinite(n)) continue;
    out.push({
      bank_account_id: bankAccountId,
      movement_date: `${yyyy}-${mm}-${dd}`,
      amount: Math.abs(n),
      direction: n < 0 ? "saida" : "entrada",
      description: memo,
      source_record_id: fitid ? `ofx:${fitid}` : null,
    });
  }
  return out;
}
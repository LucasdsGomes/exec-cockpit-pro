# Puxar saldo de cada conta direto do Omie

## Por que hoje não puxa

Resposta direta: **não puxa porque a integração atual nunca chamou o endpoint de saldo do Omie.** A sincronização cobre 8 endpoints (`contas_pagar`, `contas_receber`, `extrato`, `categorias`, `departamentos`, `clientes`, `fornecedores`, `contacorrente`), mas **nenhum deles retorna saldo**. O `geral/contacorrente` traz só os metadados da conta (nome, banco, agência), não o valor.

O saldo inicial usado hoje vem da tabela `initial_balances`, preenchida manualmente na aba **Admin → Saldos Iniciais** (ou semeada com 0 via `seed_initial_balances_from_bank_accounts`). A projeção de caixa (`compute_balance_projection`) parte desse valor manual e soma o líquido do DFC realizado.

Isso foi uma decisão de simplicidade inicial — mas o Omie **expõe sim** o saldo atual de cada conta corrente via `financas/saldobancario` (call `ListarPosicaoBancaria`) e snapshot por data via `ListarSaldoBancario`. Dá pra automatizar 100%.

## O que muda

Adicionar um nono endpoint `saldos_bancarios` no catálogo Omie e consumi-lo a cada sync. O saldo retornado vira a fonte de verdade do caixa, substituindo o input manual de "Caixa / Banco" em `initial_balances`.

### 1. Novo endpoint Omie

`src/integrations/omie/endpoints.ts`:

```text
saldos_bancarios:
  endpoint: "financas/saldobancario"
  call:     "ListarPosicaoBancaria"
  idField:  "nCodCC"
```

Retorna por conta: `nCodCC`, `cCodCCInt`, `nSaldoAtual`, `dDtSaldo`, `nSaldoBloqueado`.

### 2. Nova tabela `bank_balances_snapshots`

```text
bank_balances_snapshots
  id              uuid pk
  company_id      uuid fk companies
  bank_account_id uuid fk bank_accounts
  snapshot_date   date         -- data do saldo segundo o Omie
  balance         numeric      -- nSaldoAtual
  blocked         numeric      -- nSaldoBloqueado
  source          text         -- 'omie' | 'manual'
  synced_at       timestamptz
  unique (company_id, bank_account_id, snapshot_date)
```

RLS: `select` para membros da company; `insert/update` só via service role (sync server). Sem políticas de write para client — a UI lê, o sync escreve.

### 3. Mapper + sync

`src/integrations/omie/sync.server.ts`:
- novo handler `syncSaldosBancarios(companyId)` que chama `ListarPosicaoBancaria`, casa cada `nCodCC` com `bank_accounts.source_record_id`, faz upsert em `bank_balances_snapshots` com `snapshot_date = dDtSaldo` (ou `CURRENT_DATE`).
- registra batch em `omie_raw_sync_batches` como qualquer outro endpoint.
- entra na `OMIE_PRIORITY_ORDER` logo depois de `contas_correntes`.

### 4. Projeção de caixa usa o saldo do Omie

Atualizar `public.compute_balance_projection`:
- em vez de somar `initial_balances` tipo `caixa_banco` + variação do DFC realizado desde sempre,
- buscar o **snapshot mais recente do Omie ≤ `_date`** em `bank_balances_snapshots` (somando todas as contas ativas da company), e somar **apenas a variação do DFC realizado entre `snapshot_date` e `_date`**.
- fallback: se não houver snapshot Omie, mantém a lógica atual com `initial_balances` (não quebra empresas sem Omie).

### 5. UI: Saldos Iniciais

Em `src/components/admin/InitialBalancesTab.tsx`:
- bloco "Caixa / Banco" passa a mostrar o saldo do Omie por conta (read-only, com data do snapshot e botão "Sincronizar agora").
- linhas `balance_type = 'caixa_banco'` em `initial_balances` ficam desabilitadas para edição quando há snapshot Omie da mesma conta — com aviso "Saldo vindo do Omie. Edite para sobrescrever."
- demais tipos (estoque, imobilizado, capital, etc.) continuam manuais como hoje.

### 6. Cron diário

`run_daily_pipeline_all` já existe — adicionar chamada ao novo endpoint de saldos antes de `compute_balance_projection`. Sem nova infra de cron.

## Arquivos editados

- `src/integrations/omie/endpoints.ts` — adiciona `saldos_bancarios`.
- `src/integrations/omie/sync.server.ts` — handler + mapper + upsert.
- **Migração SQL** — tabela `bank_balances_snapshots` + RLS + atualização de `compute_balance_projection`.
- `src/lib/queries/admin.ts` — hook `useBankBalanceSnapshots(companyId)`.
- `src/components/admin/InitialBalancesTab.tsx` — exibir snapshots Omie e desabilitar edição manual quando houver.
- (opcional) `src/utils/omie.functions.ts` — server fn `syncBankBalancesNow` para botão manual.

## Detalhes técnicos

- O Omie tem **rate limit por call** (4/seg). `ListarPosicaoBancaria` retorna todas as contas em uma chamada paginada — sem custo significativo.
- Se uma conta no Omie não tiver match em `bank_accounts.source_record_id` (raro, só se sync de `contas_correntes` ainda não rodou), pula com warning em `omie_sync_logs`.
- A coluna `bank_accounts.current_balance` que existe hoje (se existir) **não é tocada** — o saldo vive em `bank_balances_snapshots` por dia, dando histórico para gráficos futuros.
- Sem mudanças em DRE, DFC, KPIs ou outras telas. Apenas a projeção de balanço/caixa fica mais precisa.

## Fora de escopo

- Importar histórico completo de saldos passados do Omie (a API retorna só atual + por data específica — exigiria varredura dia-a-dia).
- Conciliação automática de divergência entre saldo Omie e DFC calculado (fica como insight visual em iteração futura).
- Substituir saldos não-bancários (estoque, imobilizado, etc.) — esses não existem no Omie financeiro.

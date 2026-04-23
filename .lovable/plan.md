

# Destravar o Saldo de Caixa

## Por que está zerado

A fórmula do caixa é `saldos iniciais + movimentações realizadas`. Hoje as duas fontes estão vazias:

| Fonte | Linhas | Status |
|---|---|---|
| `initial_balances` (saldos de abertura por conta) | 0 | Nunca cadastrado |
| `dfc_realized_base` (pagamentos liquidados) | 0 | OMIE só envia títulos "previstos" |
| `bank_movements` (extrato bancário) | 0 | Sync de extrato não implementado |
| `financial_entries.cash_date` preenchido | 0 | OMIE Contas a Pagar/Receber não trazem data de quitação no payload atual |

O resultado: a base 100% para o caixa não existe.

## Frente 1 — Saldo inicial obrigatório (resolve hoje)

Cobre o cenário "quero ver o caixa atual mesmo sem extrato OMIE".

1. **Wizard de saldo inicial** no Admin → Saldos Iniciais:
   - Detecta se `initial_balances` está vazio.
   - Lista todas as `bank_accounts` ativas (já temos 14) e pré-popula uma linha por conta com `balance_type = 'caixa_banco'` e `reference_date = hoje` zerada.
   - Usuário só preenche o valor de cada conta e salva em batch.
2. **Alerta global no topo da Home/Balanço** quando saldo inicial estiver vazio: `"Cadastre os saldos iniciais para ver o caixa real"` → link direto para o wizard.
3. **Recalcular balanço automaticamente** após salvar saldos: chama `compute_balance_projection` para a data atual.

Resultado imediato: o KPI "Saldo de Caixa" passa a refletir o valor cadastrado.

## Frente 2 — Sync de extratos OMIE (caixa real, automatizado)

Cobre o cenário "quero o caixa atualizado todo dia sem digitar nada" (Etapa E que estava pendente).

1. Adicionar endpoint `financas/extrato → ListarExtrato` em `src/integrations/omie/endpoints.ts`.
2. Implementar `syncBankStatements(companyId)` em `sync.server.ts`:
   - Loop por cada `bank_account` ativa.
   - Chama `ListarExtrato` por `nCodCC` para o período (default últimos 90 dias, configurável).
   - Mapeia cada linha em `bank_movements` via o `mapMovimento` que já existe.
3. O trigger `bank_movements_mirror` (já criado) se encarrega de propagar para `dfc_realized_base` automaticamente.
4. Adicionar a chamada em `run_daily_pipeline_all` para rodar todo dia.
5. Botão **"Sincronizar Extratos"** em Admin → Integrações para disparo manual.

Resultado: cada movimentação real do banco entra em `dfc_realized_base.amount_signed`, e o caixa passa a se atualizar sozinho. Também desbloqueia o filtro "Realizado" do Fluxo de Caixa.

## Frente 3 — Aproveitar `data_pagamento` que já vem da OMIE

Curto-circuito enquanto extrato não está implementado: alguns títulos OMIE já trazem `data_pagamento` no detalhe (campo `det.data_pagamento` que o mapper hoje lê mas pode estar vindo `null`). Verificar nos `omie_raw_payloads` quantos têm `data_pagamento` real e, se houver, o `reprocess_raw_payloads` precisa ser estendido para também propagar `cash_date`. Isso enriquece `dfc_realized_base` sem precisar de extrato.

## Detalhes técnicos

- Arquivos: `src/components/admin/InitialBalancesTab.tsx` (wizard de pré-população), `src/routes/_app.index.tsx` + `_app.projecao-balanco.tsx` (alerta), `src/integrations/omie/sync.server.ts` (sync de extrato), `src/integrations/omie/endpoints.ts` (endpoint), nova migration estendendo `reprocess_raw_payloads` para também atualizar `cash_date` quando o payload tiver `data_pagamento`.
- Após cadastro de saldo inicial, disparar `compute_balance_projection(company, hoje)` + `snapshot_kpis(company, hoje)` para o KPI da Home se atualizar.
- A Frente 2 pode levar mais tempo (depende do payload do extrato OMIE retornar como esperado e de o usuário ter `nCodCC` configurado em todas as contas) — Frente 1 destrava o número hoje.

## Ordem sugerida

1. **Frente 1 (wizard de saldo inicial)** — caixa volta a ser exibido em minutos depois do cadastro.
2. **Frente 3 (data_pagamento do payload)** — ganho grátis de "realizado" sem nova integração.
3. **Frente 2 (extrato OMIE)** — automação completa.

## Fora de escopo

- Conciliação bancária (matching extrato ↔ títulos).
- Importação de OFX/CSV manual como fallback do extrato OMIE.


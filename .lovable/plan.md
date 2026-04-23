

# Diagnóstico do problema "filtros não batem com a integração"

Os filtros globais agora **funcionam mecanicamente**, mas selecioná-los **zera os números** porque os dados-base não têm a chave que o filtro exige:

| Tabela | `cost_center_id` | `bank_account_id` | `business_unit` |
|---|---|---|---|
| `financial_entries` (543) | 0 | 0 | — |
| `dre_base` (537) | 0 | — | 0 |
| `dfc_forecast_base` (537) | — | 0 | — |
| `dfc_realized_base` | 0 linhas no total | — | — |
| `initial_balances` | — | 0 linhas no total | — |

**Causa raiz:** o sync OMIE (`src/integrations/omie/sync.server.ts`) só extrai `codigo_categoria` dos títulos. Ignora `codigo_projeto` (centro de custo / unidade), `codigo_conta_corrente` (banco) e os códigos de cliente/fornecedor. As funções `classify_financial_entry` e `mirror_payables_receivables` então propagam `NULL` adiante. Resultado: qualquer filtro de Unidade/Conta/CC zera tudo.

# O que falta — em ordem de impacto

## 1. Enriquecer ingestão OMIE (resolve o problema dos filtros)

**`mapContaPagar` / `mapContaReceber`** passam a capturar do payload bruto:
- `cab.codigo_projeto` → resolver para `cost_centers.id` por `source_record_id`.
- `det.codigo_conta_corrente` (ou `nCodCC`) → resolver para `bank_accounts.id`.
- `cab.codigo_cliente_fornecedor` → resolver para `suppliers.id` (pagar) ou `customers.id` (receber).
- Persistir o payload completo em `metadata` (hoje vem `{}`) para reprocessamento futuro.

**`mapMovimento`** já tem `bank_account_id`; alimentar via `nCodCC` do extrato.

Adicionar helper `resolveLocalRefs(record, companyId)` que faz upsert/lookup nas tabelas mapeadoras (`cost_center_mapping`, `chart_of_accounts_mapping`) e devolve os UUIDs.

## 2. Backfill em SQL (sem reimportar do OMIE)

Migration que:
1. Para cada `financial_entries` existente, lê `metadata` (após reprocessamento do raw — ver passo 3) e popula as FKs faltantes.
2. Atualiza `dre_base`, `dfc_forecast_base`, `dfc_realized_base`, `payable_entries`, `receivable_entries` com base no `source_entry_id` / `financial_entry_id` correspondente — evita rerodar a classificação.
3. Atualiza `dre_base.business_unit` e `dre_base.department` via `cost_centers.business_unit/department`.

## 3. Reprocessar `omie_raw_payloads` para preencher `metadata`

Função SQL `reprocess_raw_payloads(company)` que percorre `omie_raw_payloads` (que tem o JSON bruto completo), faz match com `financial_entries` por `source_record_id` e atualiza `metadata` com o objeto original. Roda 1x e fica disponível como botão no Admin → Diagnóstico.

## 4. Sync de extratos bancários (Etapa E pendente)

Implementar `ListarExtrato` por `bank_account` em `sync.server.ts`:
- novo endpoint em `OMIE_ENDPOINTS`: `financas/extrato → ListarExtrato`.
- popular `bank_movements` (já existe `mapMovimento`).
- trigger `mirror_bank_movement_to_dfc_realized` para alimentar `dfc_realized_base`.
- desbloquia o modo "Realizado" no Fluxo de Caixa.

## 5. Saldo inicial obrigatório no onboarding

- Alerta no topo do Balanço quando `initial_balances` está vazio: "Cadastre os saldos iniciais para ver o balanço completo" → link para Admin → Saldos.
- Pré-popular saldos iniciais zerados (1 linha por `bank_account` ativa) na primeira abertura da aba, para o usuário só preencher os valores.

## 6. Pequenos ajustes de UX nos filtros

- Se um filtro retorna 0 dados, mostrar aviso "Nenhum lançamento desta unidade/conta no período" em vez de KPIs zerados sem contexto.
- Botão "Limpar filtros" no top bar (já existe `reset()` no contexto, falta o botão visível).
- Indicador na badge do filtro: "Conta: BB · 2.341 lançamentos" para o usuário saber que casou.

## Detalhes técnicos

- Arquivos editados: `src/integrations/omie/sync.server.ts` (mappers + resolvers), nova migration de backfill + função `reprocess_raw_payloads`, novo endpoint `financas/extrato` em `endpoints.ts`, atualização de `classify_financial_entry` para propagar as novas FKs, `AppShell.tsx` (botão limpar + contagem), `_app.projecao-balanco.tsx` (aviso de saldo inicial).
- A reclassificação em massa pode ser feita via `run_full_pipeline(company)` após o backfill — sem necessidade de novo sync OMIE.
- Etapa 4 (extratos) pode ficar em segundo passo; etapas 1, 2, 3, 5, 6 resolvem o sintoma reportado.

## Fora deste escopo

- Drill-down por centro de custo dentro do DRE (cada linha clicável abrindo lançamentos) — pode ser próxima frente.
- PME real via integração de estoque OMIE.
- Cenários múltiplos de orçamento.


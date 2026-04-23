

# Revisão do estado atual e pendências

## O que já está pronto (validado contra o banco)

| Item | Status | Evidência |
|---|---|---|
| Home / DRE / DFC / Ciclo / Balanço lendo dados reais | ✅ | 537 linhas no `dre_base`, queries refatoradas |
| Subtotais DRE (Margem Bruta, EBITDA, Lucro Líquido) | ✅ | `dre-subtotals.ts` + `snapshot_kpis` corrigido |
| Trigger de auto-classificação | ✅ | `tg_classify_entry` ativo em `financial_entries` |
| Pipeline diário (snapshot + balanço) | ✅ | Snapshot e balanço de 2026-04-23 presentes |
| Admin completo | ✅ | Abas Integrações, DE-PARA, Saldos, Orçamento, Ajustes, Parâmetros, Fila |
| Exportação PDF/CSV | ✅ | `export-pdf.ts` e `export-csv.ts` |

## Pendências reais identificadas

### 1. Dados ainda zerados nas tabelas operacionais
- `receivable_entries` e `payable_entries` = **0 linhas** → Home mostra "Próximos a receber/pagar" vazio, e o Ciclo Financeiro calcula PMR/PMP zerados.
- `bank_movements` = 0 → DFC realizada continua vazia.
- `dfc_realized_base` = 0 → Fluxo de Caixa cai no fallback "previsão".
- `initial_balances` = 0 → Balanço só mostra resultado acumulado, sem ativos/passivos.

**Causa:** o sync OMIE atual popula `financial_entries` (543), mas não está espelhando para `payable_entries`/`receivable_entries` nem chamando `ListarExtrato` para movimentos bancários.

### 2. Lacunas funcionais menores
- `alert_rules` = 0 → bloco de alertas na Home sempre vazio (falta seed de regras padrão).
- 6 lançamentos ainda sem classificação (DE-PARA faltante para 6 categorias OMIE).
- Botão "Reprocessar fila" no Admin existe, mas não há indicador de quais 6 categorias precisam mapeamento manual.

### 3. UX / polimento
- Home: estados vazios das listas AP/AR não orientam o usuário a sincronizar.
- Admin → Integrações: não mostra um "próxima execução do cron" nem permite forçar `compute_balance_projection` por data passada (backfill).
- Falta uma tela/aba simples de **diagnóstico** consolidando: última sync, contagens por tabela, regras inativas, categorias sem mapeamento.

## Plano de fechamento (ordem sugerida)

### Etapa A — Espelhar AP/AR a partir de `financial_entries` (destrava Home + Ciclo)
1. Migration: função `mirror_payables_receivables(_company)` que para cada `financial_entries` com `direction='saida'`/`'entrada'` e `due_date IS NOT NULL` faz upsert em `payable_entries`/`receivable_entries` (chave `source_record_id` + `company_id`).
2. Trigger `AFTER INSERT OR UPDATE ON financial_entries` chamando essa função para a linha nova.
3. Backfill único: rodar `mirror_payables_receivables` para cada empresa ativa.
4. Incluir a função no `run_daily_pipeline_all` para garantir consistência.

### Etapa B — Seed de regras de alerta padrão
Migration que insere em `alert_rules` por empresa ativa (idempotente):
- `caixa_minimo` < R$ 50.000 (severity warning)
- `entradas_nao_classificadas` > 0 (info)
- `contas_vencendo_7d` > 0 (warning)
- `ciclo_financeiro` > 60 dias (info)

Hook `useAlerts` já existe → só passa a retornar resultados.

### Etapa C — Aba "Diagnóstico" no Admin
Nova aba lendo via RPC `system_health(company)` que retorna JSON com:
- contagens por tabela (financial/AP/AR/dre/dfc/balance)
- última sync OMIE, último snapshot, último balance projection
- categorias OMIE sem mapeamento (lista clicável → preenche linha do DE-PARA)
- regras inativas

### Etapa D — Backfill de balanço e ações no Admin
- Botão "Recalcular balanço (últimos 30 dias)" em Integrações dispara loop de `compute_balance_projection` por dia.
- Mostrar `cron.job` ativos (via RPC `list_cron_jobs` security definer restrita a admin) com próximas execuções.

### Etapa E (opcional) — Sync de extratos bancários OMIE
- Endpoint `ListarExtrato` por `bank_account` populando `bank_movements` e `dfc_realized_base`. Remove o aviso "mostrando previsão" no Fluxo de Caixa. Já estava marcado como fora de escopo no plano original; manter assim a menos que você priorize.

## Detalhes técnicos

- Todas migrations usam `CREATE OR REPLACE` e `ON CONFLICT DO UPDATE` para serem reentrantes.
- `mirror_payables_receivables` faz match por `(company_id, source_record_id)` e atualiza `paid_amount`/`received_amount` quando `cash_date IS NOT NULL` para refletir status `realizado`.
- Seed de `alert_rules` usa `ON CONFLICT (company_id, metric) DO NOTHING` (adicionar índice único se faltar).
- Aba Diagnóstico é client-side: 1 query agregada via novo arquivo `src/lib/queries/health.ts`, reaproveitando hooks existentes onde possível.
- Backfill de balanço roda no cliente (loop de 30 dias chamando RPC) com `toast.promise` mostrando progresso.

## Fora de escopo (mantido como antes)

- Sync de extratos OMIE (Etapa E) — apenas se priorizado.
- Cenários múltiplos de orçamento, drill-down por centro de custo, integração de estoque real (PME via inventário automatizado).


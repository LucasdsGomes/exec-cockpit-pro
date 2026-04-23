

# Plano de fechamento — conectar dashboards aos dados reais

## Diagnóstico

A integração OMIE já trouxe os dados para o banco (543 lançamentos, 14 contas bancárias, 176 categorias, 1.785 clientes, 1.448 fornecedores). Mas **todas as 5 telas ainda leem `src/lib/mock-data.ts`** — nenhuma faz query no Supabase. Por isso:

- **Home**: KPIs, gráficos, AP/AR, alertas — 100% mock. Botões PDF/Excel não funcionam.
- **DRE**: Tabela e waterfall hard-coded; tabs Realizado/Orçado/Comparativo trocam mas mostram o mesmo mock.
- **Fluxo de Caixa**: `PeriodPresets` não tem `onChange`, gráficos usam mock, botão Exportar inerte.
- **Ciclo Financeiro**: PMR/PMP/PME do mock; tabela `financial_cycle_metrics` está vazia.
- **Projeção do Balanço**: 100% mock; `balance_projection_daily` e `initial_balances` vazias.
- **Admin**: Lista hard-coded de integrações OMIE; botão "Atualizar agora" não chama o endpoint `/api/public/hooks/omie-sync-now` que já existe.

Além disso, falta popular: `dfc_realized_base` (0 linhas, sync de extratos bancários ainda desativado), `financial_cycle_metrics`, `balance_projection_daily`, e `initial_balances` (sem saldos iniciais não dá pra projetar caixa nem balanço).

## Escopo do plano

### 1. Camada de dados compartilhada (`src/lib/queries/`)
Criar hooks TanStack Query reutilizáveis, todos com filtro de `company_id` (via empresa atual do usuário) e período:
- `useCompany()` — empresa do usuário logado (cacheada).
- `useKpis(period)` — agrega de `dre_base` + `dfc_forecast_base` + `bank_accounts` + `receivable_entries`/`payable_entries` (próximos 7d).
- `useDreLines(period, scenario)` — agrupa `dre_base` por `dre_group`/`dre_subgroup`, calcula % receita, variação vs período anterior e sparkline 12m.
- `useDfcRealized(range)` / `useDfcForecast(range)` — séries diárias.
- `useCashDaily(range)` — entradas/saídas/saldo por dia.
- `useUpcomingPayables(days)` / `useUpcomingReceivables(days)`.
- `useCycleMetrics()` — lê `financial_cycle_metrics` ou calcula on-the-fly se vazio.
- `useBalanceProjection(date)` — lê `balance_projection_daily`.
- `useAlerts()` — deriva de `alert_rules` + thresholds reais (saldo < mínimo, lançamentos não classificados etc).

### 2. Tornar `PeriodPresets` controlado de verdade
Adicionar `value` opcional, manter `onChange`, e expor um helper `periodToRange(preset)` → `{ start, end }`. Toda página passa a ter estado de período no topo e propaga para os hooks.

### 3. Refatorar telas para consumir dados reais

**Home (`_app.index.tsx`)**
- Adicionar `PeriodPresets` no header (hoje só tem botões PDF/Excel).
- KPIs primários e secundários vindos de `useKpis`.
- Gráfico tendência 12m: agrupa `dre_base` + `dfc_realized_base` por mês.
- Orçado vs Realizado: une `budget_entries` + `dre_base` por categoria.
- Fluxo diário: `useCashDaily(30d)`.
- Alertas: `useAlerts()`.
- AP/AR próximos: `useUpcomingPayables/Receivables(14)`.
- Estados vazios: skeleton enquanto carrega; mensagem "Sem dados no período" quando vazio (ex.: balanço/ciclo ainda zerados).

**DRE (`_app.dre.tsx`)**
- Substituir `dre` (mock) por `useDreLines`. Cada linha agrega `amount_signed` por `dre_group`, calcula subtotais (Receita Líquida, Margem Bruta, EBITDA, Lucro Líquido) no SQL/cliente.
- Tabs Orçado/Comparativo: usar `budget_entries`. Quando não houver orçamento cadastrado, mostrar CTA "Importar orçamento" linkando para `/admin?tab=orcamento`.
- Waterfall vindo dos mesmos subtotais.

**Fluxo de Caixa (`_app.fluxo-de-caixa.tsx`)**
- `PeriodPresets` controlado; range alimenta `useDfcRealized` e `useDfcForecast`.
- DFC Realizada lê `dfc_realized_base` (hoje vazia → exibir alerta "Sincronização de extratos bancários ainda não disponível, mostrando previsão"); fallback automático para `dfc_forecast_base` agrupado por grupo.
- Heatmap de vencimentos: agrega `payable_entries.due_date` próximos 28 dias.
- Botão Exportar: gera CSV client-side dos dados visíveis.

**Ciclo Financeiro (`_app.ciclo-financeiro.tsx`)**
- KPIs e histórico de `useCycleMetrics`. Como a tabela está vazia, criar função SQL `compute_cycle_metrics(company_id, period)` que calcula PMR/PMP/PME a partir de `receivable_entries`/`payable_entries`/estoque (sem estoque ainda → PME = 0 + nota explicativa "Estoque não integrado, ajuste manualmente em Admin").

**Projeção do Balanço (`_app.projecao-balanco.tsx`)**
- Lê `balance_projection_daily`. Como vazia, criar pipeline simples: hoje = saldo bancário atual (`bank_accounts` + soma de movimentos) + AR + AP + saldos iniciais cadastrados.
- Quando faltarem saldos iniciais (caso atual), exibir CTA "Cadastrar saldos iniciais" linkando para `/admin?tab=saldos`.

**Admin (`_app.admin.tsx`)**
- Aba **Integrações**: ler `omie_credentials`, `omie_raw_sync_batches` (status real, última execução, contagem de erros) e `omie_sync_logs` (últimas 50 linhas). Botão "Atualizar agora" dispara POST para `/api/public/hooks/omie-sync-now` com a `companyId` e mostra toast de progresso.
- Aba **DE-PARA**: CRUD em `category_mapping` (lista de 176 categorias com filtro "sem mapeamento" no topo).
- Aba **Orçamento**: upload de CSV → grava em `budget_entries`.
- Aba **Saldos iniciais**: form para `initial_balances` por conta bancária.
- Aba **Ajustes manuais**: CRUD em `manual_entries` com campo "motivo".
- Aba **Fila de classificação**: lista `financial_entries.is_classified=false` com ação "classificar" (atribui `category_mapped`).

### 4. Pipelines SQL faltantes (migrations)
- `snapshot_kpis` já existe — adicionar **cron diário** chamando-a (pg_cron) + recomputar `financial_cycle_metrics` e `balance_projection_daily`.
- `compute_balance_projection(company_id, date)` — função nova.
- Trigger `after insert/update on financial_entries` → reclassifica automático via `category_mapping` (hoje só roda em batch).

### 5. Exportações
Componente `useExport(rows, filename, format)` com helpers para CSV (todas telas) e PDF (Home/DRE) usando `jspdf` + `jspdf-autotable`. Substitui os botões hoje inertes.

### 6. Empty states e loading consistentes
Skeletons reutilizáveis por tipo de bloco (KPI, gráfico, tabela). Mensagem padronizada quando uma fonte ainda não tem dado, com CTA para a ação que destrava (ex.: "Sincronizar agora", "Cadastrar saldos iniciais", "Mapear categorias").

## Detalhes técnicos

- Nova pasta `src/lib/queries/` com um arquivo por domínio (`kpis.ts`, `dre.ts`, `dfc.ts`, `cycle.ts`, `balance.ts`, `admin.ts`).
- Cada hook usa `useSuspenseQuery` com `queryKey=[domain, companyId, period]` e `select` para mapear ao formato que os componentes já consomem (minimiza refactor de UI).
- `mock-data.ts` removido das imports das rotas; mantido apenas se algum componente puramente decorativo precisar.
- `PeriodPresets`: prop `value`/`defaultValue`, helper `periodToRange` em `src/lib/period.ts`.
- Endpoint `/api/public/hooks/omie-sync-now`: Admin chama via `fetch` com `Authorization: Bearer <SUPABASE_PUBLISHABLE_KEY>`.
- Migrations:
  - `compute_cycle_metrics(uuid, daterange)` (PL/pgSQL).
  - `compute_balance_projection(uuid, date)` (PL/pgSQL).
  - `pg_cron`: snapshot diário 06:10 UTC.
  - Trigger de auto-classificação em `financial_entries`.

## Ordem de execução

1. Camada de queries + `PeriodPresets` controlado + `useCompany`.
2. Refactor Home → DRE → Fluxo → Ciclo → Balanço (uma por commit, mantendo build verde).
3. Admin real (integrações + de-para + saldos iniciais primeiro, depois orçamento/ajustes/fila).
4. Migrations de cálculo + cron.
5. Exportações CSV/PDF e empty states finais.

## Fora de escopo (próximas iterações)

- Sincronização de extratos bancários OMIE (`ListarExtrato` por conta) — destrava `dfc_realized_base` real.
- Integração de estoque (PME real).
- Cenários de orçamento múltiplos (`budget_scenario`).
- Gráficos drill-down por centro de custo / unidade de negócio.



# Integração Omie — Pedidos de Venda e Ordens de Compra

## Objetivo

Trazer do Omie os **pedidos de venda** (entradas previstas) e **ordens de compra** (saídas previstas) que ainda não viraram Conta a Receber/Pagar, para enriquecer a **Projeção de Caixa** com compromissos comerciais antecipados.

## Por que isso importa

Hoje a projeção só enxerga compromissos depois que viram título financeiro (CR/CP). Pedidos aprovados e ordens de compra emitidas geralmente acontecem **15–60 dias antes** disso. Trazê-los aumenta o horizonte e a confiança da projeção.

## Escopo

### 1. Novos endpoints no catálogo Omie
Adicionar em `src/integrations/omie/endpoints.ts`:
- `pedidos_venda` → `produtos/pedido` / `ListarPedidos`
- `ordens_compra` → `produtos/ordemcompra` / `ListarOrdemCompra`

### 2. Nova tabela: `commercial_commitments`
Tabela única para os dois tipos (pedidos e ordens), análoga a `financial_entries` mas dedicada ao "ainda-não-financeiro":

```text
commercial_commitments
├─ id, company_id
├─ source_system='omie', source_endpoint, source_record_id (único)
├─ kind: 'pedido_venda' | 'ordem_compra'
├─ direction: 'entrada' | 'saida'
├─ status: 'aberto' | 'parcial' | 'faturado' | 'cancelado'
├─ issue_date (emissão)
├─ expected_date (previsão de entrega/faturamento)
├─ amount, amount_signed
├─ party_id (customer_id ou supplier_id), party_name
├─ document_number (número do pedido/OC)
├─ description
├─ linked_financial_entry_id (quando vira CR/CP)
├─ confidence_pct (default 80% pedido, 90% OC — ajustável)
├─ metadata jsonb (raw)
├─ synced_at, created_at, updated_at
```

RLS padrão: `select_member` + `modify_editor` (mesmo padrão das outras tabelas).

### 3. Mappers e upserts em `sync.server.ts`
- `mapPedidoVenda(r, companyId, batchId)` → lê `cabecalho` (codigo_pedido, data_previsao, etapa, total_pedido) e `informacoes_adicionais`.
- `mapOrdemCompra(r, companyId, batchId)` → lê `cabecalho_oc` e `total_oc`.
- `upsertCommercialCommitment(...)` com resolução de FK (customer/supplier por `source_record_id`).
- Filtro por etapa: ignorar canceladas (`etapa='99'` no Omie) e marcar como `faturado` quando o pedido tem `codigo_lancamento_omie` populado (já virou CR).

### 4. Integração na pipeline
- Adicionar `pedidos_venda` e `ordens_compra` ao `OMIE_PRIORITY_ORDER` **depois** de `clientes`/`fornecedores` e **antes** de `contas_pagar`/`contas_receber`.
- Incluir cases no `switch` de `runOmieSync` com filtro de período (`filtrar_por_data_de`/`ate` no formato BR).
- Defaults da janela: mesmo `lookbackDays` da sync atual.

### 5. Atualizar projeção de caixa
A função `compute_balance_projection` (e `dfc_forecast_base`) hoje só considera `financial_entries` previstos. Vamos:
- Criar uma **view** `cash_forecast_extended` que une:
  - `financial_entries` previstos (peso 100%)
  - `commercial_commitments` abertos não vinculados a CR/CP (peso = `confidence_pct`)
- Atualizar o cálculo da projeção para usar essa view.
- Evitar dupla contagem: quando `linked_financial_entry_id` está preenchido, o commitment é ignorado.

### 6. UI — Aba Diagnóstico e KPIs
- Em **Admin → Diagnóstico**, adicionar os dois novos endpoints na lista de sync (com botões "Sincronizar agora" individuais).
- Em **Fluxo de Caixa / Projeção**, adicionar um toggle **"Incluir pedidos e OCs"** (default ligado) e uma legenda mostrando quanto da projeção vem de commitments vs. CR/CP.
- Drill-down: ao clicar num dia da projeção, listar separadamente "Títulos financeiros" e "Compromissos comerciais".

## Detalhes técnicos

**Endpoints Omie usados:**
- `POST /produtos/pedido/` call=`ListarPedidos`, paginação padrão (`pagina`, `registros_por_pagina`).
- `POST /produtos/ordemcompra/` call=`ListarOrdemCompra`, paginação padrão.

**Conversão de status Omie → nosso enum** (mapa em `mapPedidoVenda`):
- etapa `10/20/50/60` → `aberto`
- etapa `70` (faturado parcial) → `parcial`
- etapa `80` (faturado) → `faturado`
- etapa `90/99` → `cancelado`

**Migração SQL:**
1. CREATE TABLE `commercial_commitments` + índices em `(company_id, expected_date)`, `(company_id, kind, status)`, único em `(company_id, source_endpoint, source_record_id)`.
2. RLS policies.
3. CREATE OR REPLACE VIEW `cash_forecast_extended`.
4. CREATE OR REPLACE FUNCTION `compute_balance_projection` para usar a view.

**Arquivos a editar:**
- `src/integrations/omie/endpoints.ts` (catálogo)
- `src/integrations/omie/sync.server.ts` (mappers + runners + switch)
- `src/components/admin/DiagnosticoTab.tsx` (UI sync)
- `src/lib/queries/dfc.ts` + `src/routes/_app.fluxo-de-caixa.tsx` (toggle e drill-down)
- Nova migração SQL

## Fora de escopo

- Itens do pedido (linha-a-linha de produtos) — só capturamos o cabeçalho/total.
- Notas Fiscais Emitidas (NF-e) — fica para a próxima fase ("fechamento contábil").
- Edição manual de commitments na UI (somente leitura nesta versão).
- Conciliação automática entre pedido → CR (faremos por `linked_financial_entry_id` quando o Omie já populou; reconciliação fuzzy fica para depois).

## Próximo passo após aprovação

Executo na ordem: migração SQL → endpoints/sync → DiagnósticoTab → projeção/UI. Depois você roda um sync manual em Admin → Diagnóstico para popular.

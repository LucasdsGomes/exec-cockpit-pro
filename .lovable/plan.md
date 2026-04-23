

# O que ainda falta — checkpoint pós-Frente A

## Status

| Frente | Status |
|---|---|
| Filtros globais + badge de contagem | ✅ |
| Backfill OMIE (banco/cliente/fornecedor) | ✅ |
| Wizard de saldo inicial | ✅ |
| Sync de extratos OMIE + reconciliação | ✅ |
| Regras de Centro de Custo | ✅ |
| Cron diário (`pg_cron` 6h UTC) | ✅ |
| Checklist de onboarding na Home | ✅ |
| **Frente A — Fluxo de Caixa forward-looking** | ✅ |

## Pendências (Frente B do plano aprovado)

### B.1. Status de extrato por conta bancária
Em **Admin → Saldos Iniciais**: coluna "Último extrato em…" por `bank_account` (lendo `max(movement_date)` de `bank_movements`) + botão de resync individual chamando `runBankStatementsSync` para uma conta específica.

### B.2. Drill-down DRE → lançamentos
Linhas do DRE clicáveis abrindo modal com os `financial_entries` que compõem o número, respeitando filtros ativos (período, unidade, CC, conta). Inclui export CSV do recorte.

### B.3. Override manual de Centro de Custo em massa
Nova aba **Admin → Lançamentos sem CC**: lista paginada de `financial_entries` com `cost_center_id IS NULL`, seleção múltipla (checkbox), atribuição em batch via dropdown de CC + botão "Aplicar a N selecionados". Complementa as regras automáticas para casos pontuais.

### B.4. Cenários múltiplos de orçamento
Seletor `orcado | revisado | tendencia` em `BudgetTab` (criação/edição) e nas comparações Realizado vs Orçado em DRE/Fluxo. Schema `budget_scenario` já suporta — só falta UI.

### B.5. Importação OFX/CSV manual
Upload de OFX/CSV em **Admin → Saldos Iniciais** como fallback para contas sem `nCodCC` na OMIE. Parser básico → popula `bank_movements` direto + dispara reconciliação.

## Pendências menores (carry-over)

- **View de execuções do cron** em Admin → Diagnóstico lendo `cron.job_run_details` (mostra última rodada de `daily-financial-pipeline` com status/duração).
- **Empty state inteligente** nas páginas que mostram zero quando filtros não casam: aviso "Nenhum lançamento — [Limpar filtro]" em vez de KPIs zerados sem contexto.

## Detalhes técnicos

- **B.1**: nova query `useBankAccountsStatus(companyId)` agregando `bank_movements` por conta; botão chama `runBankStatementsSync(company, bankAccountId)` (a função já aceita parâmetro opcional ou precisará aceitar).
- **B.2**: novo componente `<DreLineDrilldown>` reutilizável; query `useDreEntriesByGroup(companyId, group, range, filters)` em `src/lib/queries/dre.ts`.
- **B.3**: nova rota/aba `UnassignedEntriesTab.tsx`; mutation `bulkAssignCostCenter(entryIds[], costCenterId)`.
- **B.4**: alterar `BudgetTab` para aceitar `scenario` no formulário e nos selects; query de leitura passa a filtrar por cenário ativo (default `orcado`).
- **B.5**: dependência `ofx-js` ou parser próprio (OFX é XML simples); CSV parsing já viável com `papaparse` se já instalado, ou parser manual.
- **Migration**: nenhuma nova tabela necessária — todos os campos já existem.

## Ordem sugerida

1. **B.1** — visibilidade rápida do estado dos extratos.
2. **B.3** — destrava o filtro de CC para lançamentos que escapam das regras.
3. **B.2** — drill-down DRE (alto valor de UX).
4. **View do cron** + **empty states** — polimento.
5. **B.4** — cenários de orçamento.
6. **B.5** — importação manual OFX/CSV (último porque depende menos da automação).

## Fora de escopo

- What-if simulator (mexer em premissas e ver impacto na projeção).
- Cenários de projeção otimista/pessimista lado a lado.
- Conciliação contábil completa por plano de contas.
- Forecast com ML/sazonalidade.


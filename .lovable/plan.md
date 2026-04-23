

# O que falta — checkpoint

## Status

| Frente | Status |
|---|---|
| Filtros globais funcionais | ✅ |
| Backfill OMIE (banco/cliente/fornecedor) | ✅ |
| Wizard de saldo inicial | ✅ |
| Sync de extratos OMIE + trigger DFC realizado | ✅ |
| `cash_date` via `data_pagamento` | ✅ |
| Regras de Centro de Custo (Admin) | ✅ |
| Reconciliação extrato ↔ títulos | ✅ |
| Botão manual de extratos + diário no `run_daily_pipeline_all` | ✅ |
| Badge de contagem + botão limpar filtros | ✅ |
| Checklist de onboarding na Home | ✅ |

## O que ainda falta — em ordem

### 1. Erro de runtime atual (bloqueador silencioso)

`Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry` — aparece no console agora. Provável import quebrado após últimas refatorações (algum arquivo apagado/renomeado ainda referenciado). Investigar `AppShell.tsx`, `_app.index.tsx`, `DiagnosticoTab.tsx` e `CostCenterRulesTab.tsx` recém-tocados. Resolver antes de avançar — pode estar mascarando bugs.

### 2. Cron diário de fato agendado (pg_cron)

`run_daily_pipeline_all` foi atualizado, mas não há job `pg_cron` chamando-o todo dia às 6h. Sem isso, a automação só roda se alguém clicar manualmente. Criar:
- Job `pg_cron` chamando `select run_daily_pipeline_all();` diariamente.
- View "Última execução do pipeline" em Admin → Diagnóstico mostrando `cron.job_run_details` da última rodada.

### 3. Status visível por conta bancária (extrato)

Hoje o usuário não sabe se cada conta foi sincronizada. Adicionar em Admin → Saldos Iniciais (ou nova aba "Contas Bancárias") coluna "Último extrato em…" e botão por conta para resync individual.

### 4. Drill-down DRE → lançamentos

Clicar em uma linha do DRE (ex.: "Despesas Operacionais — R$ 45k") abre modal listando os `financial_entries` que compõem aquele número, com filtros respeitando o período/unidade ativos. Aumenta confiança no número e ajuda auditoria.

### 5. Override manual de Centro de Custo em massa

`ManualEntriesTab` permite criar lançamentos manuais, mas não editar CC de lançamentos OMIE existentes em lote. Adicionar tela "Lançamentos sem CC" com seleção múltipla e atribuição de CC — complementa as regras automáticas para casos pontuais.

### 6. Cenários múltiplos de orçamento

Schema `budget_scenario` já suporta `orcado | revisado | tendencia`, mas a UI só lê `orcado`. Adicionar seletor de cenário em `BudgetTab` e nas comparações Realizado vs Orçado.

### 7. Importação OFX/CSV manual (fallback)

Quando OMIE não tem `nCodCC` configurado para uma conta, o `ListarExtrato` falha. Permitir upload de OFX/CSV em Admin → Saldos Iniciais como fallback popula `bank_movements` direto.

## Ordem sugerida

1. **Frente 1** — corrigir runtime error (essencial).
2. **Frente 2** — agendar `pg_cron` diário (fecha o ciclo de automação).
3. **Frente 3** — visibilidade do status de extrato por conta.
4. **Frente 4** — drill-down do DRE (alto valor de UX).
5. **Frente 5** — override manual de CC (complementa Frente 1 da rodada anterior).
6. **Frentes 6 e 7** — incrementais.

## Fora de escopo

- Conciliação contábil completa (débito/crédito por plano de contas).
- Multi-empresa com consolidação automática.
- App mobile.


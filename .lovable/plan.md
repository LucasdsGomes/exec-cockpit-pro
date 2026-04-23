

# O que falta — visão geral pós-implementações

## Status atual

| Frente | Status |
|---|---|
| Filtros globais funcionais (Unidade, Conta, CC, Modo) | ✅ |
| Backfill de vínculos OMIE (bank_account_id, supplier, customer) | ✅ |
| Wizard de saldo inicial por conta bancária | ✅ |
| Sync de extratos OMIE (`ListarExtrato`) + trigger para `dfc_realized_base` | ✅ |
| `cash_date` populado a partir de `data_pagamento` | ✅ |
| KPI de Saldo de Caixa funcionando | ⚠️ depende do usuário cadastrar saldos iniciais e/ou rodar sync de extratos |

## O que ainda falta — em ordem de impacto

### 1. Preencher `cost_center_id` (filtro de Centro de Custo / Unidade segue zerando)

O backfill resolveu banco/cliente/fornecedor, mas o **centro de custo segue NULL** porque o payload OMIE de `distribuicao` está vazio nos títulos atuais. Sem isso, filtrar por CC ou Unidade zera tudo.

**Solução em duas vias:**
- **a)** Aba no Admin → Mapeamentos → "Atribuir Centro de Custo por regra" — permite criar regras (por categoria, fornecedor, descrição) que aplicam `cost_center_id` em massa nos lançamentos sem CC. Útil quando o ERP não preenche distribuição.
- **b)** Campo manual de override em `ManualEntriesTab` para corrigir lançamentos pontuais (já existe estrutura — só falta UI de edição em massa).

### 2. Botão "Sincronizar Extratos" + automação diária

A função `runBankStatementsSync` está implementada, mas:
- Falta botão visível em **Admin → Diagnóstico** para disparo manual (hoje só é chamado via sync completo).
- Falta incluir no `run_daily_pipeline_all` para rodar todo dia às 6h.
- Falta status visível "Último extrato sincronizado em…" por conta bancária.

### 3. UX dos filtros — empty state inteligente

Quando o filtro retorna 0 dados, hoje a tela mostra KPIs zerados sem explicação. Adicionar:
- Aviso contextual: *"Nenhum lançamento para Conta X no período. [Limpar filtro]"*.
- Badge nos seletores do top bar: *"Conta: BB · 142 lançamentos"* — usuário vê na hora se o filtro casou.
- Botão "Limpar filtros" visível no top bar (já existe `reset()` no contexto).

### 4. Onboarding guiado (primeira execução)

Hoje o usuário precisa adivinhar a ordem: configurar OMIE → sincronizar → cadastrar saldos → ver dashboard. Adicionar checklist na Home quando faltarem etapas:
- ☐ Credenciais OMIE configuradas
- ☐ Sync inicial executado
- ☐ Saldos iniciais cadastrados
- ☐ Centros de custo mapeados (se aplicável)

### 5. Conciliação extrato ↔ títulos (qualidade do realizado)

Quando o extrato OMIE entrar em `bank_movements`, idealmente cada movimento deveria ser linkado ao título correspondente em `financial_entries` (via `financial_entry_id`, que já existe na coluna). Hoje fica solto. Sem isso, o usuário pode contar duas vezes (título previsto + movimento realizado) no mesmo dia se misturar visões.

**Implementação:** função SQL `reconcile_bank_movements(company)` que faz match por (valor, data ±2 dias, conta) e popula `financial_entry_id`. Botão em Admin para rodar.

### 6. Pendências menores

- **Erro de runtime atual**: `Failed to fetch dynamically imported module` — precisa verificar se ficou alguma referência quebrada após as últimas refatorações.
- **Drill-down DRE**: clicar em "Despesas Operacionais" abre lista dos lançamentos que compõem aquela linha (próxima frente de UX).
- **Cenários de orçamento**: hoje só existe 1 cenário (`orcado`), o schema já suporta múltiplos (`budget_scenario` enum) — falta UI.

## Ordem sugerida

1. **Frente 1 (Centro de Custo via regras)** — destrava o filtro de Unidade/CC que ainda zera.
2. **Frente 6 (corrigir runtime error)** — bloqueador silencioso.
3. **Frente 2 (botão extrato + cron diário)** — automação do realizado.
4. **Frente 3 (UX dos filtros)** — confiança do usuário.
5. **Frente 5 (conciliação)** — qualidade do dado.
6. **Frente 4 (onboarding)** — escala para novos clientes.

## Fora de escopo desta rodada

- Importação de OFX/CSV manual.
- Drill-down clicável no DRE.
- Múltiplos cenários de orçamento.


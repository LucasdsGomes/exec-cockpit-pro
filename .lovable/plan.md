

# Fluxo de Caixa olhando para frente + pendências

## Confirmação do diagnóstico

**Sim, confere.** Hoje o Fluxo de Caixa olha **só para trás**:

- `periodToRange("30d")` retorna `[hoje−29, hoje]` — janela passada.
- A aba "DFC Prevista" usa exatamente os mesmos dados realizados, multiplicados por `1.04` (placeholder, não é projeção real).
- O heatmap de vencimentos é a única parte forward-looking (próximos 28 dias), mas fica isolado.
- KPIs ("Saldo final", "Entradas/Saídas") referem-se ao período passado, não ao caixa projetado de fato.

Resultado: um diretor abre a tela esperando "vou ter caixa para os próximos 60 dias?" e vê "tive caixa nos últimos 30 dias".

## Frente A — Reorientar Fluxo de Caixa para o futuro (prioridade desta rodada)

### A.1. Presets de período com horizonte futuro
Adicionar opções no `PeriodPresets` específicas de tesouraria:
- **Próximos 7 dias**, **Próximos 30 dias**, **Próximos 60 dias**, **Próximos 90 dias** (default na página de Fluxo).
- Estender `periodToRange` com casos `next7`, `next30`, `next60`, `next90` retornando `[hoje, hoje+N]`.
- Manter os presets retrospectivos disponíveis para análise histórica.
- Default da página `/fluxo-de-caixa`: **`next30`**.

### A.2. Projeção real de saldo (substituir o `*1.04` placeholder)
Construir série diária verdadeira em `useCashProjection(companyId, days)`:
1. Saldo inicial = saldo atual de caixa (saldos iniciais + realizados até hoje).
2. Para cada dia futuro D em `[hoje, hoje+N]`:
   - Entradas previstas = `receivable_entries` com `due_date = D` e ainda não recebidos.
   - Saídas previstas = `payable_entries` com `due_date = D` e ainda não pagos.
   - (Opcional) recorrências fixas de `manual_entries` marcadas como recorrentes.
3. Saldo do dia = saldo anterior + entradas − saídas.
4. Marcar dias com saldo negativo ou abaixo do mínimo configurado.

### A.3. KPIs reescritos para perspectiva futura
- **Saldo atual** (hoje) — substitui "Saldo inicial".
- **Entradas previstas** (no horizonte selecionado).
- **Saídas previstas** (no horizonte selecionado).
- **Saldo projetado ao final** + delta vs. hoje.
- Badge extra: **"Menor saldo no período: R$ X em DD/MM"** com cor de alerta se < mínimo configurável.

### A.4. Reorganizar as abas
Trocar "DFC Realizada / DFC Prevista" por:
- **Projeção** (default) — gráfico de área com saldo projetado, linha de saldo mínimo, marcadores de dias críticos.
- **Calendário** — heatmap de 28 dias (já existe, expandir para 60).
- **Histórico** — DFC realizada por natureza (operacional/investimento/financiamento), com janela retrospectiva selecionável.

### A.5. Tabela DFC orientada ao futuro
Na aba Projeção, mostrar tabela **DFC Prevista por natureza** agregando `dfc_forecast_base` por `flow_type` no horizonte futuro — não o realizado retrospectivo.

### A.6. Alerta de saldo mínimo
Campo configurável em **Admin → Parâmetros**: "Saldo mínimo de caixa" (já tem `Parameters` mas precisa expor essa chave). Aparece como `ReferenceLine` no gráfico e dispara `InsightCard` quando a projeção cruza para baixo.

## Frente B — Pendências carry-over (continuação do roadmap)

### B.1. Status visível por conta bancária (Frente 3 anterior)
Em **Admin → Saldos Iniciais**, adicionar coluna "Último extrato em…" e botão de resync individual por `bank_account`.

### B.2. Drill-down DRE → lançamentos (Frente 4 anterior)
Modal listando os `financial_entries` que compõem cada linha do DRE, respeitando filtros ativos.

### B.3. Override manual de Centro de Custo em massa (Frente 5 anterior)
Tela "Lançamentos sem CC" com seleção múltipla e atribuição em batch.

### B.4. Cenários múltiplos de orçamento
Seletor `orcado | revisado | tendencia` em `BudgetTab` e nas comparações.

### B.5. Importação OFX/CSV manual
Fallback para contas sem `nCodCC` configurado na OMIE.

## Detalhes técnicos

- Arquivos: `src/lib/period.ts` (presets futuros), `src/components/ui/period-presets.tsx` (UI), `src/lib/queries/dfc.ts` (nova `useCashProjection`), `src/routes/_app.fluxo-de-caixa.tsx` (reorganização das abas e KPIs), `src/components/admin/ParametersTab.tsx` (saldo mínimo), `src/components/admin/InitialBalancesTab.tsx` (status de extrato).
- Migration: nenhum schema novo necessário para A — `payable_entries`, `receivable_entries` e `dfc_forecast_base` já têm `due_date`/`forecast_date`. Para B.4 já existe enum `budget_scenario`.
- Default do filtro de modo na página Fluxo: forçar **`previsto`** quando o horizonte for futuro.

## Ordem sugerida

1. **A.1 + A.2 + A.3** — núcleo: presets futuros, projeção real, KPIs forward-looking.
2. **A.4 + A.5** — abas e tabela reorganizadas.
3. **A.6** — saldo mínimo configurável.
4. **B.1 → B.5** — pendências do roadmap, na ordem indicada.

## Fora de escopo

- Simulação what-if (alterar premissas e ver impacto).
- Cenários múltiplos de projeção (otimista/pessimista) lado a lado.
- Forecast com ML/sazonalidade — só matemática determinística por enquanto.


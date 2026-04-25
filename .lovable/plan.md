
# Simplificação Omie + Previsto x Realizado + DE-PARA enxuto

Quatro frentes, todas no Admin. Objetivo: menos botões, fluxos mais óbvios, e adicionar comparação Previsto x Realizado baseada na sua modelagem Excel (Yalla Green = NewCo).

---

## 1. Sincronização Omie — reduzir para 3 ações

Hoje há ~12 botões de sync espalhados (Diagnóstico + barra superior + InitialBalances). Vamos consolidar em **três ações apenas**:

**a) Sincronizar tudo (full reload)** — botão primário grande, no topo do Admin.
- Puxa todos os endpoints desde a primeira data do Omie (lookback 10 anos), na ordem de prioridade existente. Usa o `useFullSync` que já existe.
- Mostra progresso por endpoint num painel inline (não só toast).

**b) Sincronizar agora (incremental)** — botão secundário no topo.
- Roda o cron diário sob demanda (últimos 7 dias de tudo). Substitui o botão "Sincronizar OMIE" atual e o "Reprocessar".

**c) Sincronizar apenas uma conta bancária** — dentro de InitialBalances/Extratos, por linha. Mantém o botão "Resync" por conta (já existe).

**Removidos da UI** (continuam funcionando via cron, só somem dos botões):
- Espelhar Contas a Pagar/Receber → roda dentro do incremental
- Reprocessar vínculos OMIE → roda no fim do full
- Sincronizar extratos / lanc CC / projetos / loans / fiscal / pedidos individualmente → tudo via Full ou Incremental
- Identificar transferências internas / Conciliar / Vincular projetos / Recalcular balanço → executados automaticamente como **pós-processamento** ao final de cada sync.

A aba Diagnóstico vira só **leitura**: status por endpoint, último sync, contagem de registros, alertas. Sem botões de ação.

## 2. DE-PARA simplificado

Hoje a aba DE-PARA mostra uma tabela longa de categorias Omie com chips DRE/DFC, mas a edição em si não acontece nela (é só leitura). Mudanças:

- **Renomear aba para "Plano de Contas"** (mais claro que "DE-PARA").
- Adicionar **filtro único**: dropdown `Status: [Todos | Mapeado | Sem mapeamento DRE | Sem mapeamento DFC]`. Remove o toggle atual.
- Adicionar **edição inline**: clicar no chip DRE/DFC abre um Select com as opções da modelagem Yalla Green (carregadas da planilha). Salva direto no `category_mapping`.
- Adicionar **busca por código/descrição** no topo.
- Adicionar **contador no topo**: "X de Y categorias mapeadas (Z%)".
- Mover `flow_type` para tooltip — não é informação primária.

Aba **Centro de Custo** e **Sem CC** continuam como estão (já são objetivas).

## 3. Previsto x Realizado (novo)

Baseado na sua modelagem Excel (Yalla Green = NewCo). Como primeiro passo da implementação eu vou **ler a planilha em build mode** com pandas para extrair:
- a estrutura de contas gerenciais (linhas do DRE/DFC modelo),
- o DE-PARA Omie → Yalla Green (que linhas Omie alimentam cada conta gerencial),
- os valores **Previstos** mensais.

A partir disso:

**a) Carga inicial automatizada:**
- Edge function `import-yalla-modelo` que lê uma versão do Excel salva no Storage (ou via upload na UI), e popula:
  - `category_mapping` com o DE-PARA da planilha (sobrescreve o atual da Yalla Green, com confirmação).
  - `budget_entries` com os valores Previstos mensais (cenário `orcado`), por `managerial_account` e `reference_period`.

**b) Nova aba "Previsto x Realizado":**
- Tabela mensal com colunas: `Conta gerencial | Previsto | Realizado | Δ | Δ%`.
- Realizado = soma do `dre_base` agrupado por `managerial_account` e mês (já temos).
- Previsto = `budget_entries` cenário `orcado`.
- Período no topo (mês corrente, último trimestre, YTD).
- Drilldown por linha: clicar abre as transações Omie que somaram o realizado (reusa `DreLineDrilldown`).
- Linha destacada em vermelho quando |Δ%| > 10% (configurável em Parâmetros).

**c) Botão "Re-importar modelo Yalla Green"** dentro desta aba — re-executa a carga sem duplicar (upsert por `reference_period + managerial_account`).

## 4. Saldos iniciais — simplificar

A integração de **saldos bancários do Omie** já está funcionando (view `omieBalances` na UI). Quando há saldo do Omie, ele já é a fonte de verdade.

Mudanças:
- Se houver pelo menos 1 saldo do Omie, **esconder** o card "Saldo de abertura por conta bancária" (wizard manual) e o formulário "Adicionar saldo inicial" — eles viram um expansor `> Modo manual (avançado)` colapsado.
- Quando **não** houver saldo do Omie, mostrar um aviso amarelo: "Sem saldo do Omie — usando entrada manual. Rode Sincronizar tudo para puxar do Omie."
- Manter saldos manuais para tipos **não bancários** (estoque, imobilizado, empréstimos não-Omie, capital) — esses o Omie não fornece, então continuam necessários e ganham um card próprio "Outros ativos e passivos".
- Card de extratos por conta (status + import OFX/CSV) continua igual.

Resultado: na tela já integrada, o usuário vê só "Saldos do Omie" + "Extratos" + um expansor avançado.

---

## Detalhes técnicos

**Banco de dados:**
- Nenhuma tabela nova obrigatória — `budget_entries` já comporta o cenário `orcado`. Possível adicionar coluna `dre_group` em `budget_entries` para agrupar visualmente na tela.
- Possível view `vw_budget_vs_actual_monthly` (managerial_account, reference_period, budget, actual, variance) para a query da nova aba ser simples.

**Edge functions / server:**
- `import-yalla-modelo`: server function em `src/routes/api/admin/import-yalla-modelo.ts` que recebe o arquivo, parseia com `xlsx` (já é Worker-compatível), valida abas esperadas, faz upsert em `category_mapping` + `budget_entries`. Pré-requisito: `bun add xlsx`.
- Pós-processamento automático no `runOmieSync`: ao final, encadear `pairBankTransfers → reconcileBankMovements → linkEntriesToProjects → backfillBalance(30)` num único `Promise.allSettled` para que o usuário não precise clicar nada.

**UI:**
- `DiagnosticoTab` vira só leitura (remover botões de ação, manter painéis de status).
- Novo header global no Admin com 3 botões: Sync tudo / Sync agora / Última sync.
- Nova aba `Previsto x Realizado` no `_app.admin.tsx` (ou rota dedicada `/_app/previsto-realizado` se preferir).
- Renomear `DE-PARA` → `Plano de Contas`, adicionar edição inline (Popover com Select).
- `InitialBalancesTab` reorganizado conforme descrito.

**Hooks a remover do JSX (mantidos no código se ainda usados pelo cron):**
`useMirrorApAr`, `useBackfillRefs`, `useSyncBankStatements` (do botão global; mantém o por-conta), `useSyncLancamentosCC`, `useSyncProjectsAndTags`, `useLinkEntriesToProjects`, `useSyncLoans`, `useSyncCommercialCommitments`, `useSyncFiscalDocuments`, `useReconcileBankMovements`, `usePairBankTransfers`, `useBackfillBalance`.

**Primeiro passo na implementação:** parsear o Excel `Hitech-e_-_Modelagem_v5_NewCo_Vendas_VF.xlsx` para mapear (a) abas, (b) estrutura de contas Yalla Green, (c) coluna do DE-PARA Omie, (d) layout do Previsto mensal. Posso então te confirmar antes de gerar a edge function de import.



# Por que Margem Bruta, EBITDA e Lucro Líquido aparecem zerados

## Diagnóstico

O `dre_base` armazena **categorias analíticas** vindas das regras automáticas (ex.: `Receita Líquida`, `Custos Diretos`, `Despesas Administrativas`, `Despesas com Pessoal`, `Despesas Financeiras`, `Despesas Tributárias`, `Outras Receitas`, `Outras Saídas`, `Deduções de Receita`). Não existem — e nunca existirão — linhas com `dre_group = 'Margem Bruta'`, `'EBITDA'`, `'Margem Bruta'` ou `'Lucro Líquido'`, porque esses são **subtotais calculados**, não categorias de lançamento.

Mas:
- `useKpis` faz `sumDre(group='EBITDA')` e `sumDre(group='Lucro Líquido')` → sempre 0.
- `useDreLines` percorre uma lista `ORDER` que tem `'CMV'`, `'Margem Bruta'`, `'EBITDA'`, `'Lucro Líquido'` e tenta lê-los do `dre_base` → sempre 0.
- `snapshot_kpis` faz o mesmo SELECT direto, por isso `dashboard_kpi_snapshots` também tem ebitda = 0 e resultado_liquido = 0.

Margem Bruta % aparece 0 porque `Margem Bruta = 0 / Receita Líquida = 0%`.

Os dados existem (R$ 3,5M de receita líquida, R$ 1,58M de custos diretos, R$ 248k de despesas administrativas, etc.) — falta apenas **calcular os subtotais** a partir das categorias analíticas.

## O que vou corrigir agora

### 1. Centralizar o cálculo de subtotais DRE

Criar `src/lib/dre-subtotals.ts` com a estrutura padrão brasileira:

```text
Receita Bruta       = Receita Líquida + |Deduções de Receita|
(-) Deduções        = Deduções de Receita
Receita Líquida     = soma das categorias "Receita Líquida" e "Outras Receitas (operacionais)"
(-) CMV/Custos      = Custos Diretos
Margem Bruta        = Receita Líquida + Custos Diretos
(-) Despesas Op.    = Despesas Administrativas + Despesas com Pessoal + Despesas Operacionais + Despesas Tributárias + Outras Saídas
EBITDA              = Margem Bruta + Despesas Operacionais
(-) Result. Fin.    = Despesas Financeiras
Lucro Líquido       = EBITDA + Resultado Financeiro
```

Função única `computeDreSubtotals(map: Map<group, valor>)` que retorna o objeto com todos os totais e subtotais, usada por:
- `useKpis` (EBITDA, Lucro Líquido, Margem EBITDA).
- `useDreLines` (linhas + sparkline 12m).
- `useDreWaterfall` (steps).

### 2. Reescrever `useDreLines`

- Aggregar **uma vez** por mês durante 12m (uma só query).
- Para cada mês aplicar `computeDreSubtotals` e montar a sparkline correta dos subtotais.
- Para o período corrente: aplicar a fórmula → todas as linhas (analíticas + subtotais) recebem valor real, % receita e variação.

### 3. Reescrever `useKpis`

- Remover `sumDre('EBITDA')` e `sumDre('Lucro Líquido')`.
- Trazer os 9 grupos analíticos numa única query (corrente + período anterior) e derivar EBITDA/Lucro/Margem via `computeDreSubtotals`.
- Manter snapshot só como fallback de saldo de caixa.

### 4. Atualizar a função SQL `snapshot_kpis`

Migration que substitui os SELECTs diretos de `'EBITDA'` e `'Lucro Líquido'` pela mesma fórmula (CTE somando os grupos analíticos). Depois rodar `snapshot_kpis(company, today)` para popular o histórico correto.

### 5. Detalhes técnicos finais
- Sparkline 12m: agregar por `date_trunc('month', competence_date)` direto na query, evitar 12 chamadas.
- `useDreWaterfall` usa os subtotais reais (Receita líquida → Custos → Margem bruta → Desp. Op. → EBITDA → Result. Fin. → Lucro líquido).
- Tratar grupos ainda sem dado (PME/estoque, balanço sem `initial_balances`) com nota explicativa já existente.

---

# O que ainda falta para concluir o app

Depois desse fix, sobram 5 frentes (todas previstas no plano original):

### A. Pipeline diário automatizado (migration)
- Criar trigger `AFTER INSERT OR UPDATE ON financial_entries` chamando `classify_financial_entry(NEW.id)` → novos lançamentos OMIE classificam sozinhos.
- Cron `pg_cron` 06:10 UTC chamando `run_full_pipeline(company)` para todas as empresas ativas → snapshots e métricas atualizadas todo dia.

### B. Saldos iniciais e projeção de balanço
- Tela `/admin?tab=saldos`: form para `initial_balances` (uma linha por conta bancária + capital social, lucros acumulados).
- Função SQL `compute_balance_projection(company, date)` populando `balance_projection_daily` (saldo bancário + AR + AP + initial_balances).
- Cron diário rodando essa função.

### C. Admin — abas faltantes
- **Orçamento**: upload CSV → `budget_entries` (destrava tabs Orçado/Comparativo do DRE).
- **Ajustes manuais**: CRUD `manual_entries` com campo "motivo".
- **Parâmetros**: form para `manual_parameters` (ex.: `inventory_value` para destravar PME real).

### D. Exportações reais
- PDF na Home e DRE via `jspdf` + `jspdf-autotable` (CSV já funciona em todas as telas).

### E. Sincronização de extratos bancários OMIE (fora do escopo imediato)
- Endpoint `ListarExtrato` por conta para popular `dfc_realized_base` real e remover o aviso "mostrando previsão" no Fluxo de Caixa.

## Ordem sugerida

1. **Agora**: itens 1–4 desta mensagem (corrige os zeros visíveis em DRE/Home/Snapshots).
2. Trigger de auto-classificação + cron diário (A).
3. Saldos iniciais + balanço (B).
4. Demais abas do Admin (C).
5. PDF exports (D).
6. Extratos OMIE quando priorizar (E).


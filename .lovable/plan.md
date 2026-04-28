## Diagnóstico — o que tem hoje na tela Admin

São **11 abas**, mas olhando o que o Omie já entrega vs o que sobra de configuração manual, dá pra cortar bastante. Estado real do banco da Hitech Electric:

| O que | Vem do Omie? | Linhas hoje | Precisa config manual? |
|---|---|---|---|
| Bancos (`bank_accounts`) | ✅ | 14 | Não |
| Centros de custo (`cost_centers`) | ✅ | 8 | Não |
| Plano de contas / categorias (`category_mapping`) | ✅ código + descrição | 231 (95% mapeadas) | **Só revisar DRE/DFC das ~10 não mapeadas** |
| Lançamentos (`financial_entries`) | ✅ | 2.987 (35 sem categoria) | Não |
| Saldos iniciais (`initial_balances`) | parcial (saldo bancário) | 14 | **Sim** — capital, estoque, imobilizado, empréstimos |
| Orçamento (`budget_entries`) | ❌ | 3.956 (já importado da Yalla) | Re-importar quando mudar |
| Regras de centro de custo | ❌ | **0** (ninguém usa) | Opcional |
| Lançamentos manuais (ajustes) | ❌ | — | Raro |
| Parâmetros gerenciais | ❌ | **0** (ninguém usa) | Opcional |

**Conclusão**: hoje 5 das 11 abas estão vazias ou redundantes com o que o Omie já traz.

## Proposta — colapsar 11 abas em 4 grupos

```text
Admin
├── 1. Sincronização          (cards do topo + status + logs + diagnóstico)
├── 2. Plano de Contas        (231 categorias do Omie, edição inline DRE/DFC)
├── 3. Saldos & Orçamento     (saldos iniciais + orçamento + previsto x realizado)
└── 4. Avançado  (collapsible, fechado por padrão)
    ├── Regras de centro de custo
    ├── Ajustes manuais
    └── Parâmetros gerenciais
```

### Detalhamento

**1. Sincronização** (junta `Integrações` + `Diagnóstico` + `Fila`)
- Botões "Sincronizar agora" / "Sincronizar tudo" no topo (já existem)
- Card "Status dos endpoints" + "Logs recentes" (já existe)
- Card novo **"Saúde dos dados"**: 35 lançamentos pendentes · 12 categorias sem DRE/DFC · última sync há X · próximo cron — com botão "Ir para Plano de Contas" / "Reprocessar fila"
- Remove a aba "Diagnóstico" separada (vira card aqui)
- Remove a aba "Fila" separada (vira link nesse card)

**2. Plano de Contas** (mantém como está — é a aba principal da Joice)
- Já tem busca, filtro "Sem DRE / Sem DFC", select inline
- Único ajuste: badge no topo "219/231 com DRE · 226/231 com DFC" (já existe um %)
- Some a aba "Sem CC" — vira filtro/coluna aqui ou cai pro Avançado

**3. Saldos & Orçamento** (junta `Saldos iniciais` + `Orçamento` + `Previsto x Realizado`)
- Sub-tabs internas: **Saldos iniciais** | **Orçamento** | **Previsto x Realizado**
- Faz sentido juntar porque os 3 falam de "o que não vem do Omie e impacta DRE/DFC/Balanço"

**4. Avançado** (collapsible, fechado)
- `Regras de centro de custo` — 0 regras hoje, raramente usado
- `Ajustes manuais` — exceções pontuais
- `Parâmetros gerenciais` — 0 valores hoje (só PME/min_cash etc)

## Sobre o Excel que você mandou

Não tenho mais o arquivo (uploads são temporários), **mas isso não é problema porque o conteúdo dele já foi absorvido**: temos 231 categorias na `category_mapping`, das quais 219 já têm DRE e 226 já têm DFC. Sobram só ~10 para a Joice classificar manualmente — exatamente o caso de uso da aba **Plano de Contas** (filtro "Sem DRE" / "Sem DFC", select inline, salva ao escolher).

Se quiser **re-aplicar/atualizar o DE-PARA via Excel** no futuro, posso adicionar um botão "Importar DE-PARA (.xlsx)" dentro da aba Plano de Contas que aceita as colunas `código | descrição | DRE | DFC | flow_type` e faz upsert. **Faz isso agora junto?**

## Resumo das mudanças concretas

- `src/routes/_app.admin.tsx`: reduzir de 11 `TabsTrigger` para 4. Mover conteúdo de `Diagnóstico`, `Fila` e `Sem CC` para dentro de "Sincronização" (como cards). Mover `CostCenterRules`, `ManualEntries`, `Parameters` para dentro de um `<Collapsible>` "Avançado".
- Criar `src/components/admin/SaldosOrcamentoTab.tsx` que envolve os 3 componentes existentes (`InitialBalancesTab`, `BudgetTab`, `PrevistoRealizadoTab`) em sub-tabs.
- Criar `src/components/admin/SaudeDosDadosCard.tsx` que junta os indicadores hoje em `DiagnosticoTab`.
- **Nada é deletado** — só reorganizado. Todos os componentes atuais continuam existindo.
- Opcional (decidir agora): botão "Importar DE-PARA (.xlsx)" em Plano de Contas.

## O que preciso confirmar

1. Topa essa estrutura de **4 grupos** (Sincronização / Plano de Contas / Saldos & Orçamento / Avançado)?
2. Posso **mover** (não deletar) Regras de CC, Ajustes manuais e Parâmetros para dentro do "Avançado" colapsado?
3. Adiciono o **botão "Importar DE-PARA (.xlsx)"** em Plano de Contas agora ou deixa pra depois?

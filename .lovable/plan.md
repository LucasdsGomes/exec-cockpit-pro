

# Refino mobile da aplicação (sem mexer em lógica)

## Diagnóstico

Hoje o app é desktop-first:
- **Sidebar fixa de 240px** sempre visível — em mobile ocupa 70% da tela.
- **Header** com busca de 320px + botões — quebra abaixo de 768px.
- **Barra de filtros globais** com 4 selects + presets de período em linha — força scroll horizontal.
- **KPIs em 6 colunas** (`xl:grid-cols-6`) — em telas pequenas funcionam parcialmente, mas o `text-3xl` do número fica apertado.
- **Gráficos** com altura fixa `h-72` e legendas ao lado do título — legenda colide com o título no mobile.
- **Tabelas** (DRE, Fluxo, Drilldown, Admin) usam `<Table>` puro — geram scroll horizontal em telas <600px.
- **Modal de drilldown DRE** com tabela de 5 colunas — ilegível no mobile.
- **Admin** com 7 abas em linha + formulários com `grid-cols-12` — quebra mal.

Nenhuma query, mutation, cálculo ou rota muda. Só camada visual.

## Mudanças

### 1. Shell (`AppShell.tsx`) — navegação mobile

- **Sidebar**: em `<lg` vira **drawer** (Sheet `side="left"`) acionado por botão "menu" (`Menu` icon) no header. Em `≥lg` continua fixa como hoje.
- **Header mobile**: esconde a busca larga (vira ícone que expande), reduz para `h-14`, mantém avatar + sino.
- **Bottom navigation** em `<md`: barra fixa inferior com os 5 itens principais (Home, DRE, Fluxo, Ciclo, Admin) usando ícones + label minúsculo. Sidebar drawer fica como acesso secundário/completo.
- **Filtros globais**: em `<lg` viram botão **"Filtros (N)"** que abre Sheet `side="bottom"` com os 4 selects empilhados + período + botão "Aplicar/Limpar". Badge de contagem de lançamentos vai dentro do Sheet.
- Padding do `<main>` reduz para `px-4 py-4` em mobile, mantém `p-6` em desktop.

### 2. KPIs (`kpi-card.tsx` + grids nas páginas)

- Grids passam para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` (era `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`) — empilhamento real em <640px só quando o card é grande; cards "size=sm" mantêm 2 colunas para densidade.
- `KpiCard`: número principal aumenta no mobile (`text-2xl sm:text-3xl`), hint vira `text-[11px]` truncado em uma linha com `title` (tooltip nativo). Delta e ícone permanecem.

### 3. Tabelas → listas em mobile

Padrão reutilizável: criar componente `<ResponsiveTable>` (wrapper) ou aplicar direto nas tabelas críticas:

- **DRE** (`_app.dre.tsx`): em `<md`, troca `<Table>` por lista vertical onde cada linha é card compacto com label à esquerda, valor à direita, indentação por nível. Subtotais em destaque. Tap continua abrindo `DreLineDrilldown`.
- **DreLineDrilldown** (modal): em `<md`, vira `Sheet side="bottom"` com altura 90vh; tabela de lançamentos colapsa para lista de cards (data + descrição em cima, valor em destaque embaixo, badge da categoria).
- **Fluxo de Caixa** — tabela de projeção dia-a-dia: em mobile vira accordion por semana, exibindo só saldo final da semana; expandir mostra os dias.
- **Admin → tabelas** (saldos iniciais, regras CC, lançamentos sem CC, orçamento): em `<md` viram lista de cards com 2-3 campos visíveis e botão "Ver detalhes" expandindo o restante.

### 4. Gráficos (Recharts)

- Container: altura responsiva `h-56 sm:h-64 lg:h-72` (mais baixa em mobile para caber sem scroll).
- Margens: `margin={{ left: 0, right: 8 }}` em mobile, com `YAxis width={36}` e `tickFormatter` mais curto (`1.2M` em vez de `R$ 1.234.567`).
- Legendas: em `<sm` vão **abaixo** do gráfico (não ao lado do título). Implementação: legenda vira `flex-wrap gap-2` no `CardHeader` e quebra naturalmente.
- `XAxis interval`: aumenta o `interval` em mobile (mostrar 1 em cada 5 ticks) via `useIsMobile`.
- Tooltip: já existe `ChartTooltip`; garantir `wrapperStyle={{ zIndex: 50 }}` e tap-friendly.

### 5. Período / `PeriodPresets`

- Em mobile, vira `Select` com as opções (em vez de pílulas em linha). Em desktop continua como pílulas.

### 6. Admin (`_app.admin.tsx`)

- `<TabsList>`: ativa `overflow-x-auto` com `scroll-snap-x` — abas roláveis horizontalmente sem quebrar layout (UX comum em mobile, melhor que dropdown para 7 itens).
- Formulários internos: trocar `grid-cols-12 / md:grid-cols-6` por `grid-cols-1 sm:grid-cols-2`. Inputs com `h-10` e fonte 16px (evita zoom no iOS).

### 7. Tipografia e tokens

Adicionar em `styles.css`:
```css
@layer utilities {
  .num-hero { font-size: clamp(1.5rem, 5vw, 2rem); }
  .text-mobile-meta { font-size: 11px; line-height: 1.3; }
}
```
- Body já tem font-smoothing — manter.
- `SectionHeader`: ações quebram em segunda linha em `<md` (`flex-wrap` + `gap-2`).

### 8. Touch targets

- Botões `size="sm"` pequenos demais para tap: aplicar `min-h-9 min-w-9` em ícones-only no mobile via `sm:min-h-8 sm:min-w-8` (mantém densidade desktop).
- Espaçamento entre cards: `gap-3 sm:gap-4` (já consistente, validar nos arquivos).

## Arquivos editados

- `src/components/layout/AppShell.tsx` — drawer + bottom nav + filtros em sheet.
- `src/components/ui/kpi-card.tsx` — tipografia responsiva.
- `src/components/ui/section-header.tsx` — wrap das ações.
- `src/components/ui/period-presets.tsx` — variant select em mobile.
- `src/components/ui/chart-primitives.tsx` — helpers para legenda mobile.
- `src/routes/_app.index.tsx` — grids + alturas de gráficos.
- `src/routes/_app.dre.tsx` — tabela → lista mobile.
- `src/routes/_app.fluxo-de-caixa.tsx` — tabela diária → accordion semanal mobile.
- `src/routes/_app.ciclo-financeiro.tsx` — grids.
- `src/routes/_app.projecao-balanco.tsx` — grids + bloco de balanço empilhado.
- `src/routes/_app.admin.tsx` — tabs roláveis.
- `src/components/admin/*.tsx` (todos os 7) — tabelas → cards em `<md`, formulários em coluna única.
- `src/components/dre/DreLineDrilldown.tsx` — Dialog → Sheet bottom em mobile + lista de cards.
- `src/styles.css` — utilities `num-hero` e `text-mobile-meta`.

## Detalhes técnicos

- Hook `useIsMobile()` (já existe em `src/hooks/use-mobile.tsx`, breakpoint 768) é usado para alternar render de tabela vs lista, modal vs sheet, legenda lateral vs inferior.
- Drawer da sidebar usa `Sheet` (já instalado, `src/components/ui/sheet.tsx`).
- Bottom nav: novo subcomponente dentro de `AppShell.tsx` — `<nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t bg-background md:hidden">`. Adicionar `pb-16 md:pb-0` no `<main>` para não cobrir conteúdo.
- Tabelas grandes que não dá para reescrever inteiras (ex.: `BudgetTab` complexa) recebem fallback `overflow-x-auto` em wrapper + `min-w-[640px]` na tabela — preserva layout desktop e permite scroll horizontal local somente naquela tabela, sem afetar a página.
- Sem alteração de schema, queries, mutations, RLS, edge functions ou rotas.
- Desktop (≥`lg`, 1024px+): zero mudança visual perceptível — todos os ajustes são em breakpoints `<md` e `<lg`.

## Fora de escopo

- PWA / instalação no home screen.
- Gestos custom (swipe entre abas, pull-to-refresh).
- Dark/light toggle (já é dark fixo).
- Refatoração visual desktop.
- Otimização de bundle / lazy load de rotas.


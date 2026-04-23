/**
 * Central calculator for DRE subtotals from analytical groups.
 *
 * dre_base only stores analytical categories (Receita Líquida, Custos Diretos,
 * Despesas Administrativas, etc.). Subtotals like Margem Bruta, EBITDA and
 * Lucro Líquido must be derived. This module is the single source of truth.
 *
 * Sign convention in dre_base.amount_signed:
 *   - Revenue groups: positive (e.g. Receita Líquida, Outras Receitas)
 *   - Expense/cost groups: already negative
 *   - Deduções de Receita: stored as positive but logically subtracts from revenue
 */

export const ANALYTICAL_GROUPS = [
  "Receita Líquida",
  "Outras Receitas",
  "Deduções de Receita",
  "Custos Diretos",
  "CMV",
  "Despesas Administrativas",
  "Despesas com Pessoal",
  "Despesas Operacionais",
  "Despesas Tributárias",
  "Outras Saídas",
  "Despesas Financeiras",
] as const;

export type AnalyticalGroup = (typeof ANALYTICAL_GROUPS)[number];

export interface DreTotals {
  receitaLiquida: number;
  outrasReceitas: number;
  deducoes: number; // negative (signed)
  receitaBruta: number;
  custos: number; // negative
  margemBruta: number;
  despesasAdministrativas: number;
  despesasPessoal: number;
  despesasOperacionais: number;
  despesasTributarias: number;
  outrasSaidas: number;
  despesasOperacionaisTotal: number; // sum of all op expenses, negative
  ebitda: number;
  resultadoFinanceiro: number; // negative
  lucroLiquido: number;
}

const get = (m: Map<string, number>, k: string): number => m.get(k) ?? 0;

/**
 * Compute all DRE subtotals from a map of analytical-group => signed sum.
 */
export function computeDreSubtotals(totals: Map<string, number>): DreTotals {
  const receitaLiquida = get(totals, "Receita Líquida");
  const outrasReceitas = get(totals, "Outras Receitas");
  // Deduções stored as positive, but subtracts from gross revenue
  const deducoesRaw = get(totals, "Deduções de Receita");
  const deducoes = -Math.abs(deducoesRaw);

  const receitaBruta = receitaLiquida + outrasReceitas - deducoes; // -deducoes adds back the |x|
  // i.e. receitaBruta = receitaLiquida + outrasReceitas + |deducoes|

  const custos = get(totals, "Custos Diretos") + get(totals, "CMV"); // negative
  const margemBruta = receitaLiquida + outrasReceitas + custos;

  const despesasAdministrativas = get(totals, "Despesas Administrativas");
  const despesasPessoal = get(totals, "Despesas com Pessoal");
  const despesasOperacionais = get(totals, "Despesas Operacionais");
  const despesasTributarias = get(totals, "Despesas Tributárias");
  const outrasSaidas = get(totals, "Outras Saídas");
  const despesasOperacionaisTotal =
    despesasAdministrativas +
    despesasPessoal +
    despesasOperacionais +
    despesasTributarias +
    outrasSaidas;

  const ebitda = margemBruta + despesasOperacionaisTotal;
  const resultadoFinanceiro = get(totals, "Despesas Financeiras"); // negative
  const lucroLiquido = ebitda + resultadoFinanceiro;

  return {
    receitaLiquida,
    outrasReceitas,
    deducoes,
    receitaBruta,
    custos,
    margemBruta,
    despesasAdministrativas,
    despesasPessoal,
    despesasOperacionais,
    despesasTributarias,
    outrasSaidas,
    despesasOperacionaisTotal,
    ebitda,
    resultadoFinanceiro,
    lucroLiquido,
  };
}

/** Read a "logical" DRE line value (analytical or computed subtotal) from a totals map. */
export function dreValueOf(t: DreTotals, key: DreLineKey): number {
  switch (key) {
    case "Receita Bruta": return t.receitaBruta;
    case "Deduções": return t.deducoes;
    case "Receita Líquida": return t.receitaLiquida + t.outrasReceitas;
    case "Custos": return t.custos;
    case "Margem Bruta": return t.margemBruta;
    case "Despesas Administrativas": return t.despesasAdministrativas;
    case "Despesas com Pessoal": return t.despesasPessoal;
    case "Despesas Operacionais": return t.despesasOperacionais;
    case "Despesas Tributárias": return t.despesasTributarias;
    case "Outras Saídas": return t.outrasSaidas;
    case "Despesas Operacionais Totais": return t.despesasOperacionaisTotal;
    case "EBITDA": return t.ebitda;
    case "Resultado Financeiro": return t.resultadoFinanceiro;
    case "Lucro Líquido": return t.lucroLiquido;
  }
}

export type DreLineKey =
  | "Receita Bruta"
  | "Deduções"
  | "Receita Líquida"
  | "Custos"
  | "Margem Bruta"
  | "Despesas Administrativas"
  | "Despesas com Pessoal"
  | "Despesas Operacionais"
  | "Despesas Tributárias"
  | "Outras Saídas"
  | "Despesas Operacionais Totais"
  | "EBITDA"
  | "Resultado Financeiro"
  | "Lucro Líquido";
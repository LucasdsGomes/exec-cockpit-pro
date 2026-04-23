// Hitech Electric — Mock dataset (consistent enough for executive demos)

export const empresa = {
  nome: "Hitech Electric",
  unidades: ["Matriz - SP", "Filial - RJ", "Filial - MG"],
  contasBancarias: ["Itaú CC 12345-6", "Bradesco CC 98765-4", "Santander CC 55555-1"],
  centrosCusto: ["Comercial", "Operações", "Administrativo", "Engenharia", "Logística"],
  categorias: ["Vendas Produto", "Vendas Serviço", "CMV", "Pessoal", "Aluguel", "Marketing", "Impostos", "Financeiro"],
};

export const sync = {
  ultima: "Hoje, 09:42",
  status: "ok" as "ok" | "warn" | "error",
  fonte: "OMIE • API v2",
};

// KPIs mês corrente
export const kpis = {
  receitaLiquida: 4_820_000,
  receitaLiquidaVar: 8.4,
  ebitda: 1_180_000,
  ebitdaVar: 12.1,
  margemEbitda: 24.5,
  resultadoLiquido: 742_000,
  resultadoLiquidoVar: 6.7,
  saldoCaixa: 3_215_000,
  saldoCaixaVar: -2.1,
  geracaoCaixa: 412_000,
  projecaoCaixa30d: 3_640_000,
  contasPagar7d: 685_000,
  contasReceber7d: 921_000,
  pmr: 38,
  pmp: 47,
  pme: 21,
  cicloFinanceiro: 12,
};

// Tendência últimos 12 meses
const meses = ["Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr"];
export const tendencia12m = meses.map((m, i) => {
  const base = 3_800_000 + i * 95_000 + (i % 3) * 120_000;
  const ebitda = base * (0.21 + (i % 4) * 0.01);
  return {
    mes: m,
    receita: Math.round(base),
    ebitda: Math.round(ebitda),
    caixa: Math.round(2_400_000 + i * 80_000 + (i % 5) * 60_000),
  };
});

// Fluxo de caixa diário (últimos 30 dias)
export const caixaDiario = Array.from({ length: 30 }, (_, i) => {
  const dia = i + 1;
  const entrada = 120_000 + ((i * 37) % 95_000) + (i % 7 === 0 ? 180_000 : 0);
  const saida = 95_000 + ((i * 53) % 80_000) + (i % 5 === 0 ? 120_000 : 0);
  return {
    dia: `${String(dia).padStart(2, "0")}/04`,
    entrada,
    saida,
    saldo: 2_800_000 + (entrada - saida) * 0.6 + i * 9000,
  };
});

// Orçado vs realizado (mês)
export const orcadoRealizado = [
  { categoria: "Receita Líquida", orcado: 4_500_000, realizado: 4_820_000 },
  { categoria: "CMV", orcado: 1_800_000, realizado: 1_910_000 },
  { categoria: "Pessoal", orcado: 920_000, realizado: 905_000 },
  { categoria: "Marketing", orcado: 180_000, realizado: 215_000 },
  { categoria: "Administrativo", orcado: 410_000, realizado: 398_000 },
  { categoria: "EBITDA", orcado: 1_050_000, realizado: 1_180_000 },
];

// DRE (mês corrente)
export type DRELinha = {
  conta: string;
  valor: number;
  pctReceita: number;
  varAbs: number;
  varPct: number;
  destaque?: "total" | "subtotal" | "negativo";
  spark: number[];
};

const sparkOf = (base: number, vol = 0.15) =>
  Array.from({ length: 12 }, (_, i) => Math.round(base * (1 + Math.sin(i / 1.7) * vol)));

export const dre: DRELinha[] = [
  { conta: "Receita Bruta", valor: 5_420_000, pctReceita: 112.4, varAbs: 410_000, varPct: 8.2, spark: sparkOf(5_200_000) },
  { conta: "(-) Deduções", valor: -600_000, pctReceita: -12.4, varAbs: -45_000, varPct: 8.1, destaque: "negativo", spark: sparkOf(-580_000) },
  { conta: "Receita Líquida", valor: 4_820_000, pctReceita: 100, varAbs: 365_000, varPct: 8.4, destaque: "subtotal", spark: sparkOf(4_600_000) },
  { conta: "(-) CMV", valor: -1_910_000, pctReceita: -39.6, varAbs: -110_000, varPct: 6.1, destaque: "negativo", spark: sparkOf(-1_850_000) },
  { conta: "Margem Bruta", valor: 2_910_000, pctReceita: 60.4, varAbs: 255_000, varPct: 9.6, destaque: "subtotal", spark: sparkOf(2_750_000) },
  { conta: "(-) Despesas Operacionais", valor: -1_730_000, pctReceita: -35.9, varAbs: -85_000, varPct: 5.2, destaque: "negativo", spark: sparkOf(-1_700_000) },
  { conta: "EBITDA", valor: 1_180_000, pctReceita: 24.5, varAbs: 170_000, varPct: 12.1, destaque: "total", spark: sparkOf(1_050_000) },
  { conta: "Resultado Financeiro", valor: -180_000, pctReceita: -3.7, varAbs: 12_000, varPct: -6.3, destaque: "negativo", spark: sparkOf(-200_000) },
  { conta: "Resultado Não Operacional", valor: 25_000, pctReceita: 0.5, varAbs: 5_000, varPct: 25, spark: sparkOf(20_000) },
  { conta: "Lucro Líquido", valor: 742_000, pctReceita: 15.4, varAbs: 47_000, varPct: 6.7, destaque: "total", spark: sparkOf(700_000) },
];

// Fluxo de caixa por natureza
export const dfc = {
  saldoInicial: 2_803_000,
  saldoFinal: 3_215_000,
  blocos: [
    {
      tipo: "Operacional",
      itens: [
        { conta: "Recebimento de clientes", valor: 4_910_000 },
        { conta: "Pagamento a fornecedores", valor: -1_980_000 },
        { conta: "Folha e encargos", valor: -905_000 },
        { conta: "Impostos", valor: -612_000 },
        { conta: "Despesas gerais", valor: -480_000 },
      ],
    },
    {
      tipo: "Investimento",
      itens: [
        { conta: "Aquisição de imobilizado", valor: -210_000 },
        { conta: "Venda de ativos", valor: 35_000 },
      ],
    },
    {
      tipo: "Financiamento",
      itens: [
        { conta: "Captação", valor: 0 },
        { conta: "Amortização de dívidas", valor: -148_000 },
        { conta: "Juros pagos", valor: -68_000 },
      ],
    },
  ],
};

// Heatmap vencimentos (próximos 28 dias)
export const heatmap = Array.from({ length: 28 }, (_, i) => ({
  dia: i + 1,
  valor: Math.round(40_000 + ((i * 73) % 320_000) + (i % 7 === 5 ? 250_000 : 0)),
}));

// Ciclo financeiro histórico
export const cicloHist = meses.map((m, i) => ({
  mes: m,
  pmr: 36 + ((i * 3) % 8),
  pmp: 45 + ((i * 2) % 7),
  pme: 19 + ((i * 5) % 6),
  ciclo: 36 + ((i * 3) % 8) + 19 + ((i * 5) % 6) - (45 + ((i * 2) % 7)),
}));

// Balanço projetado (fechamento do mês)
export const balanco = {
  ativo: {
    circulante: [
      { conta: "Caixa e equivalentes", valor: 3_640_000 },
      { conta: "Contas a receber", valor: 5_120_000 },
      { conta: "Estoques", valor: 2_180_000 },
      { conta: "Outros ativos circulantes", valor: 410_000 },
    ],
    naoCirculante: [
      { conta: "Imobilizado (líquido)", valor: 6_840_000 },
      { conta: "Intangível", valor: 320_000 },
    ],
  },
  passivo: {
    circulante: [
      { conta: "Fornecedores", valor: 2_410_000 },
      { conta: "Obrigações tributárias", valor: 685_000 },
      { conta: "Obrigações trabalhistas", valor: 510_000 },
      { conta: "Empréstimos curto prazo", valor: 980_000 },
      { conta: "Demais passivos circulantes", valor: 240_000 },
    ],
    naoCirculante: [
      { conta: "Empréstimos longo prazo", valor: 3_120_000 },
    ],
  },
  patrimonio: [
    { conta: "Capital social", valor: 6_000_000 },
    { conta: "Reservas", valor: 2_840_000 },
    { conta: "Resultado acumulado projetado", valor: 1_745_000 },
  ],
};

// Alertas e pendências
export const alertas = [
  { nivel: "warn", titulo: "Saldo crítico previsto em 12 dias", desc: "Conta Itaú CC abaixo do mínimo de R$ 500k" },
  { nivel: "info", titulo: "PMR subiu 3 dias vs mês anterior", desc: "Concentração no cliente Construtora Alfa" },
  { nivel: "error", titulo: "12 lançamentos sem classificação gerencial", desc: "Pendentes de revisão pelo financeiro" },
  { nivel: "ok", titulo: "EBITDA acima do orçado em 12,4%", desc: "Mix de produto puxando margem" },
] as const;

export const proximosPagar = [
  { fornecedor: "Energisa", venc: "26/04", valor: 142_000, status: "Em dia" },
  { fornecedor: "Distribuidora Volt", venc: "27/04", valor: 320_000, status: "Em dia" },
  { fornecedor: "Folha Abril", venc: "30/04", valor: 905_000, status: "Programado" },
  { fornecedor: "DAS Simples", venc: "20/05", valor: 168_000, status: "Programado" },
];

export const proximosReceber = [
  { cliente: "Construtora Alfa", venc: "25/04", valor: 412_000, status: "A vencer" },
  { cliente: "Indústria Beta", venc: "28/04", valor: 285_000, status: "A vencer" },
  { cliente: "Comércio Gama", venc: "02/05", valor: 198_000, status: "A vencer" },
  { cliente: "Engenharia Delta", venc: "05/05", valor: 540_000, status: "A vencer" },
];
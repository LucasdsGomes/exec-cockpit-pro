// OMIE endpoint catalog used by sync routines.
// Each entry encapsulates: API path, method name, mapper to normalized record.

export type OmieEndpointKey =
  | "contas_pagar"
  | "contas_receber"
  | "movimentacoes_bancarias"
  | "categorias"
  | "centros_de_custo"
  | "clientes"
  | "fornecedores"
  | "contas_correntes"
  | "saldos_bancarios";

export interface OmieEndpointDef {
  key: OmieEndpointKey;
  label: string;
  endpoint: string;
  call: string;
  // Field name in the response that uniquely identifies the record
  idField: string;
}

export const OMIE_ENDPOINTS: Record<OmieEndpointKey, OmieEndpointDef> = {
  contas_pagar: {
    key: "contas_pagar",
    label: "Contas a Pagar",
    endpoint: "financas/contapagar",
    call: "ListarContasPagar",
    idField: "codigo_lancamento_omie",
  },
  contas_receber: {
    key: "contas_receber",
    label: "Contas a Receber",
    endpoint: "financas/contareceber",
    call: "ListarContasReceber",
    idField: "codigo_lancamento_omie",
  },
  movimentacoes_bancarias: {
    key: "movimentacoes_bancarias",
    label: "Movimentações Bancárias",
    endpoint: "financas/extrato",
    call: "ListarExtrato",
    idField: "nCodTitulo",
  },
  categorias: {
    key: "categorias",
    label: "Categorias (Plano de Contas)",
    endpoint: "geral/categorias",
    call: "ListarCategorias",
    idField: "codigo",
  },
  centros_de_custo: {
    key: "centros_de_custo",
    label: "Centros de Custo",
    endpoint: "geral/departamentos",
    call: "ListarDepartamentos",
    idField: "codigo",
  },
  clientes: {
    key: "clientes",
    label: "Clientes",
    endpoint: "geral/clientes",
    call: "ListarClientes",
    idField: "codigo_cliente_omie",
  },
  fornecedores: {
    key: "fornecedores",
    label: "Fornecedores",
    endpoint: "geral/clientes",
    call: "ListarClientes",
    idField: "codigo_cliente_omie",
  },
  contas_correntes: {
    key: "contas_correntes",
    label: "Contas Correntes",
    endpoint: "geral/contacorrente",
    call: "ListarContasCorrentes",
    idField: "nCodCC",
  },
  saldos_bancarios: {
    key: "saldos_bancarios",
    label: "Saldos Bancários",
    endpoint: "financas/saldobancario",
    call: "ListarPosicaoBancaria",
    idField: "nCodCC",
  },
};

export const OMIE_PRIORITY_ORDER: OmieEndpointKey[] = [
  "categorias",
  "centros_de_custo",
  "contas_correntes",
  "saldos_bancarios",
  "clientes",
  "fornecedores",
  "contas_pagar",
  "contas_receber",
  "movimentacoes_bancarias",
];
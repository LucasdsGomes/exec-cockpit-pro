// Server-only sync pipeline for OMIE → Supabase.
// Uses supabaseAdmin (service role) since this runs in trusted server context
// triggered by authenticated server functions or cron with verified caller.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callOmie, paginateOmie } from "./client.server";
import { OMIE_ENDPOINTS, OMIE_PRIORITY_ORDER, type OmieEndpointKey } from "./endpoints";

export interface SyncRunOptions {
  companyId: string;
  endpoints?: OmieEndpointKey[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  triggeredBy?: string | null;
  mode?: "incremental" | "full" | "reprocess";
  /** Restrict bank-statements sync to a single bank account id */
  bankAccountId?: string | null;
}

export interface SyncRunResult {
  ok: boolean;
  endpoints: Array<{
    key: OmieEndpointKey;
    batchId: string;
    inserted: number;
    updated: number;
    errors: number;
    durationMs: number;
  }>;
  totals: { inserted: number; updated: number; errors: number };
  pipeline?: { classified: number; snapshotId: string | null };
}

function logCtx(level: "info" | "warn" | "error", message: string, ctx: Record<string, unknown>) {
  // Console output goes to server logs
  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](`[OMIE SYNC] ${message}`, ctx);
}

async function logToDb(companyId: string, batchId: string | null, level: string, message: string, endpoint: string | null, context: Record<string, unknown> = {}) {
  await supabaseAdmin.from("omie_sync_logs").insert([{
    company_id: companyId,
    batch_id: batchId,
    level,
    message,
    source_endpoint: endpoint,
    context: context as never,
  }]);
}

async function recordError(companyId: string, batchId: string | null, endpoint: string, message: string, payload: unknown, code?: string) {
  await supabaseAdmin.from("omie_sync_errors").insert([{
    company_id: companyId,
    batch_id: batchId,
    source_endpoint: endpoint,
    error_message: message,
    error_code: code ?? null,
    payload: (payload ?? null) as never,
  }]);
}

async function startBatch(companyId: string, endpoint: string, triggeredBy: string | null, metadata: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("omie_raw_sync_batches")
    .insert([{
      company_id: companyId,
      source_endpoint: endpoint,
      status: "running",
      triggered_by: triggeredBy,
      metadata: metadata as never,
    }])
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to start batch: ${error?.message}`);
  return data.id as string;
}

async function finishBatch(batchId: string, status: "success" | "error" | "partial", processed: number, errors: number, total: number) {
  await supabaseAdmin
    .from("omie_raw_sync_batches")
    .update({
      status,
      processed_records: processed,
      error_records: errors,
      total_records: total,
      finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}
function asNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function brDateToISO(s: unknown): string | null {
  const v = asString(s);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// --- Mappers ----

type AnyRec = Record<string, unknown>;

function mapContaPagar(r: AnyRec, companyId: string, batchId: string) {
  const cab = (r["cabecTitulo"] as AnyRec) ?? r;
  const det = (r["detalhesTitulo"] as AnyRec) ?? {};
  const amount = asNumber(cab["valor_documento"] ?? cab["valor_titulo"] ?? 0);
  const due = brDateToISO(cab["data_vencimento"]);
  const competence = brDateToISO(cab["data_emissao"]) ?? due ?? new Date().toISOString().slice(0, 10);
  const cash = brDateToISO(det["data_pagamento"] ?? cab["data_pagamento"] ?? null);
  const status = cash ? "realizado" : "previsto";
  return {
    company_id: companyId,
    source_system: "omie",
    source_endpoint: "financas/contapagar",
    source_record_id: asString(cab["codigo_lancamento_omie"] ?? cab["codigo_lancamento_integracao"]),
    imported_batch_id: batchId,
    competence_date: competence,
    reference_date: competence,
    due_date: due,
    cash_date: cash,
    amount: Math.abs(amount),
    amount_signed: -Math.abs(amount),
    direction: "saida" as const,
    status: status as "previsto" | "realizado",
    description: asString(cab["observacao"] ?? cab["numero_documento"]),
    document_number: asString(cab["numero_documento"]),
    category_raw: asString(cab["codigo_categoria"]),
    customer_name: null as string | null,
    supplier_name: asString(cab["codigo_cliente_fornecedor"]),
    is_classified: false,
    metadata: r as Record<string, unknown>,
    _bank_src: asString(cab["id_conta_corrente"] ?? det["id_conta_corrente"]),
    _party_src: asString(cab["codigo_cliente_fornecedor"]),
  };
}

function mapContaReceber(r: AnyRec, companyId: string, batchId: string) {
  const cab = (r["cabecTitulo"] as AnyRec) ?? r;
  const det = (r["detalhesTitulo"] as AnyRec) ?? {};
  const amount = asNumber(cab["valor_documento"] ?? cab["valor_titulo"] ?? 0);
  const due = brDateToISO(cab["data_vencimento"]);
  const competence = brDateToISO(cab["data_emissao"]) ?? due ?? new Date().toISOString().slice(0, 10);
  const cash = brDateToISO(det["data_pagamento"] ?? cab["data_pagamento"] ?? null);
  const status = cash ? "realizado" : "previsto";
  return {
    company_id: companyId,
    source_system: "omie",
    source_endpoint: "financas/contareceber",
    source_record_id: asString(cab["codigo_lancamento_omie"] ?? cab["codigo_lancamento_integracao"]),
    imported_batch_id: batchId,
    competence_date: competence,
    reference_date: competence,
    due_date: due,
    cash_date: cash,
    amount: Math.abs(amount),
    amount_signed: Math.abs(amount),
    direction: "entrada" as const,
    status: status as "previsto" | "realizado",
    description: asString(cab["observacao"] ?? cab["numero_documento"]),
    document_number: asString(cab["numero_documento"]),
    category_raw: asString(cab["codigo_categoria"]),
    customer_name: asString(cab["codigo_cliente_fornecedor"]),
    supplier_name: null as string | null,
    is_classified: false,
    metadata: r as Record<string, unknown>,
    _bank_src: asString(cab["id_conta_corrente"] ?? det["id_conta_corrente"]),
    _party_src: asString(cab["codigo_cliente_fornecedor"]),
  };
}

function mapMovimento(r: AnyRec, companyId: string) {
  // OMIE ListarExtrato returns: nCodTitulo, dDtMovimento, nValorMovimento, cTipoOperacao ('C'=credit, 'D'=debit), cDescricao
  const amountRaw = asNumber(r["nValorMovimento"] ?? r["valor"] ?? 0);
  const tipo = String(r["cTipoOperacao"] ?? r["tipo_operacao"] ?? "").toUpperCase();
  const direction: "entrada" | "saida" = tipo === "D" ? "saida" : tipo === "C" ? "entrada" : (amountRaw >= 0 ? "entrada" : "saida");
  const amount = Math.abs(amountRaw);
  return {
    company_id: companyId,
    movement_date: brDateToISO(r["dDtMovimento"] ?? r["data"]) ?? new Date().toISOString().slice(0, 10),
    amount,
    direction,
    description: asString(r["cDescricao"] ?? r["descricao"] ?? r["cObservacao"]),
    document_number: asString(r["cNumDocumento"] ?? r["numero_documento"] ?? r["cNumeroDocumento"]),
    source_record_id: asString(r["nCodTitulo"] ?? r["nCodMovimento"] ?? r["nCodLanc"]),
    bank_account_id: null as string | null,
  };
}

// --- Commercial commitments (pedidos de venda / ordens de compra) ---

type CommitmentKind = "pedido_venda" | "ordem_compra";
type CommitmentStatus = "aberto" | "parcial" | "faturado" | "cancelado";

function mapEtapaToStatus(etapa: string | null): CommitmentStatus {
  const e = (etapa ?? "").trim();
  if (e === "80") return "faturado";
  if (e === "70") return "parcial";
  if (e === "90" || e === "99") return "cancelado";
  return "aberto";
}

interface CommitmentRecord {
  company_id: string;
  source_endpoint: string;
  source_record_id: string | null;
  imported_batch_id: string;
  kind: CommitmentKind;
  direction: "entrada" | "saida";
  status: CommitmentStatus;
  issue_date: string | null;
  expected_date: string | null;
  amount: number;
  amount_signed: number;
  party_name: string | null;
  document_number: string | null;
  description: string | null;
  confidence_pct: number;
  metadata: Record<string, unknown>;
  _party_src: string | null;
  _has_linked: boolean;
}

function mapPedidoVenda(r: AnyRec, companyId: string, batchId: string): CommitmentRecord {
  const cab = (r["cabecalho"] as AnyRec) ?? {};
  const total = (r["total_pedido"] as AnyRec) ?? {};
  const info = (r["informacoes_adicionais"] as AnyRec) ?? {};
  const codigoPedido = asString(cab["codigo_pedido"] ?? cab["codigo_pedido_integracao"]);
  const numeroPedido = asString(cab["numero_pedido"] ?? codigoPedido);
  const etapa = asString(cab["etapa"] ?? info["etapa"]);
  const status = mapEtapaToStatus(etapa);
  const dataPrev = brDateToISO(cab["data_previsao"] ?? info["data_previsao"]);
  const dataEmissao = brDateToISO(cab["data_previsao_entrega"] ?? info["data_inclusao"] ?? cab["data_inclusao"]);
  const valor = asNumber(total["valor_total_pedido"] ?? total["valor_mercadorias"] ?? 0);
  const partySrc = asString(cab["codigo_cliente"]);
  const codLanc = asString(cab["codigo_lancamento_omie"] ?? info["codigo_lancamento_omie"]);
  return {
    company_id: companyId,
    source_endpoint: "produtos/pedido",
    source_record_id: codigoPedido,
    imported_batch_id: batchId,
    kind: "pedido_venda",
    direction: "entrada",
    status,
    issue_date: dataEmissao,
    expected_date: dataPrev,
    amount: Math.abs(valor),
    amount_signed: Math.abs(valor),
    party_name: partySrc,
    document_number: numeroPedido,
    description: asString(info["observacoes"] ?? cab["observacoes"]) ?? `Pedido ${numeroPedido ?? ""}`.trim(),
    confidence_pct: 80,
    metadata: r as Record<string, unknown>,
    _party_src: partySrc,
    _has_linked: !!codLanc,
  };
}

function mapOrdemCompra(r: AnyRec, companyId: string, batchId: string): CommitmentRecord {
  const cab = (r["cabecalho"] as AnyRec) ?? (r["cabecalho_oc"] as AnyRec) ?? {};
  const total = (r["total_ordem_compra"] as AnyRec) ?? (r["total_oc"] as AnyRec) ?? {};
  const info = (r["informacoes_adicionais"] as AnyRec) ?? {};
  const codigo = asString(cab["codigo_ordem_compra"] ?? cab["codigo_ordemcompra"] ?? cab["codigo_oc_integracao"]);
  const numero = asString(cab["numero_ordem_compra"] ?? cab["numero_oc"] ?? codigo);
  const etapa = asString(cab["etapa"] ?? info["etapa"]);
  const status = mapEtapaToStatus(etapa);
  const dataPrev = brDateToISO(cab["data_previsao"] ?? cab["data_previsao_entrega"] ?? info["data_previsao"]);
  const dataEmissao = brDateToISO(cab["data_inclusao"] ?? info["data_inclusao"]);
  const valor = asNumber(total["valor_total_ordem_compra"] ?? total["valor_total_oc"] ?? total["valor_mercadorias"] ?? 0);
  const partySrc = asString(cab["codigo_fornecedor"] ?? cab["codigo_cliente"]);
  const codLanc = asString(cab["codigo_lancamento_omie"] ?? info["codigo_lancamento_omie"]);
  return {
    company_id: companyId,
    source_endpoint: "produtos/ordemcompra",
    source_record_id: codigo,
    imported_batch_id: batchId,
    kind: "ordem_compra",
    direction: "saida",
    status,
    issue_date: dataEmissao,
    expected_date: dataPrev,
    amount: Math.abs(valor),
    amount_signed: -Math.abs(valor),
    party_name: partySrc,
    document_number: numero,
    description: asString(info["observacoes"] ?? cab["observacoes"]) ?? `OC ${numero ?? ""}`.trim(),
    confidence_pct: 90,
    metadata: r as Record<string, unknown>,
    _party_src: partySrc,
    _has_linked: !!codLanc,
  };
}

async function upsertCommitment(record: CommitmentRecord) {
  if (!record.source_record_id) return { inserted: 0, updated: 0, errors: 0 };
  const { _party_src, _has_linked, metadata, ...base } = record;

  let customer_id: string | null = null;
  let supplier_id: string | null = null;
  let linked_financial_entry_id: string | null = null;

  if (_party_src) {
    if (record.kind === "pedido_venda") {
      const { data } = await supabaseAdmin
        .from("customers").select("id")
        .eq("company_id", record.company_id).eq("source_record_id", _party_src).maybeSingle();
      customer_id = data?.id ?? null;
    } else {
      const { data } = await supabaseAdmin
        .from("suppliers").select("id")
        .eq("company_id", record.company_id).eq("source_record_id", _party_src).maybeSingle();
      supplier_id = data?.id ?? null;
    }
  }

  // Tenta vincular ao lançamento financeiro se já existe
  if (_has_linked || record.status === "faturado") {
    const expectedEndpoint = record.kind === "pedido_venda" ? "financas/contareceber" : "financas/contapagar";
    const { data } = await supabaseAdmin
      .from("financial_entries").select("id")
      .eq("company_id", record.company_id)
      .eq("source_endpoint", expectedEndpoint)
      .eq("document_number", record.document_number ?? "")
      .maybeSingle();
    linked_financial_entry_id = data?.id ?? null;
  }

  const enriched = {
    ...base,
    source_record_id: base.source_record_id as string,
    customer_id,
    supplier_id,
    linked_financial_entry_id,
    metadata: metadata as never,
    source_system: "omie",
    synced_at: new Date().toISOString(),
  };

  const { data: existing } = await supabaseAdmin
    .from("commercial_commitments").select("id")
    .eq("company_id", enriched.company_id)
    .eq("source_endpoint", enriched.source_endpoint)
    .eq("source_record_id", enriched.source_record_id!)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("commercial_commitments").update(enriched).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("commercial_commitments").insert([enriched]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

// --- Fiscal documents (NF-e / NFS-e emitidas) ---

type FiscalDocType = "nfe_emitida" | "nfe_recebida" | "nfse_emitida" | "nfse_recebida";
type FiscalDocStatus = "autorizada" | "cancelada" | "denegada" | "inutilizada" | "rascunho";

interface FiscalDocRecord {
  company_id: string;
  source_endpoint: string;
  source_record_id: string | null;
  imported_batch_id: string;
  doc_type: FiscalDocType;
  status: FiscalDocStatus;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  cfop: string | null;
  issue_date: string;
  competence_date: string;
  party_name: string | null;
  party_document: string | null;
  amount_gross: number;
  amount_discount: number;
  amount_net: number;
  amount_taxes: number;
  amount_iss: number;
  amount_icms: number;
  amount_pis: number;
  amount_cofins: number;
  amount_irrf: number;
  amount_csll: number;
  amount_inss: number;
  description: string | null;
  metadata: Record<string, unknown>;
  _customer_src: string | null;
}

function mapNfeStatus(s: string | null): FiscalDocStatus {
  const v = (s ?? "").toUpperCase().trim();
  if (v.includes("CANC")) return "cancelada";
  if (v.includes("DENEG")) return "denegada";
  if (v.includes("INUTIL")) return "inutilizada";
  if (v.includes("RASC") || v.includes("DIGIT")) return "rascunho";
  return "autorizada";
}

function mapNFe(r: AnyRec, companyId: string, batchId: string): FiscalDocRecord {
  const ide = (r["compl"] as AnyRec) ?? (r["ide"] as AnyRec) ?? r;
  const totais = ((r["total"] as AnyRec)?.["ICMSTot"] as AnyRec) ?? (r["totalNFe"] as AnyRec) ?? (r["total_nfe"] as AnyRec) ?? {};
  const dest = (r["dest"] as AnyRec) ?? (r["destinatario"] as AnyRec) ?? {};
  const nIdNF = asString(r["nIdNF"] ?? r["cChaveNFe"] ?? ide["nIdNF"]);
  const numero = asString(ide["nNF"] ?? ide["numero_nf"] ?? r["nNF"]);
  const serie = asString(ide["serie"] ?? ide["nSerie"] ?? r["serie"]);
  const chave = asString(r["cChaveNFe"] ?? ide["cChaveNFe"] ?? r["chave_acesso"]);
  const cfop = asString(ide["CFOP"] ?? ide["cfop"]);
  const dtEmi = brDateToISO(ide["dEmi"] ?? ide["data_emissao"] ?? r["dEmi"] ?? r["data_emissao"]);
  const issue = dtEmi ?? new Date().toISOString().slice(0, 10);
  const valorBruto = asNumber(totais["vProd"] ?? totais["valor_produtos"] ?? r["vProd"]);
  const valorLiq = asNumber(totais["vNF"] ?? totais["valor_nota"] ?? r["vNF"]);
  const desconto = asNumber(totais["vDesc"] ?? totais["desconto"]);
  const vICMS = asNumber(totais["vICMS"]);
  const vPIS = asNumber(totais["vPIS"]);
  const vCOFINS = asNumber(totais["vCOFINS"]);
  const vIRRF = asNumber(totais["vIRRF"] ?? totais["vRetIRRF"]);
  const vCSLL = asNumber(totais["vCSLL"] ?? totais["vRetCSLL"]);
  const status = mapNfeStatus(asString(r["cStat"] ?? r["status"] ?? ide["cStat"]));
  const partyName = asString(dest["xNome"] ?? dest["razao_social"] ?? r["nome_destinatario"]);
  const partyDoc = asString(dest["CNPJ"] ?? dest["CPF"] ?? dest["cnpj_cpf"]);
  const customerSrc = asString(dest["nCodCli"] ?? dest["codigo_cliente"]);
  return {
    company_id: companyId,
    source_endpoint: "produtos/nfconsultar",
    source_record_id: nIdNF ?? chave ?? `${numero}-${serie}`,
    imported_batch_id: batchId,
    doc_type: "nfe_emitida",
    status,
    numero,
    serie,
    chave_acesso: chave,
    cfop,
    issue_date: issue,
    competence_date: issue,
    party_name: partyName,
    party_document: partyDoc,
    amount_gross: Math.abs(valorBruto || valorLiq),
    amount_discount: Math.abs(desconto),
    amount_net: Math.abs(valorLiq || valorBruto),
    amount_taxes: Math.abs(vICMS + vPIS + vCOFINS + vIRRF + vCSLL),
    amount_iss: 0,
    amount_icms: Math.abs(vICMS),
    amount_pis: Math.abs(vPIS),
    amount_cofins: Math.abs(vCOFINS),
    amount_irrf: Math.abs(vIRRF),
    amount_csll: Math.abs(vCSLL),
    amount_inss: 0,
    description: `NF-e ${numero ?? ""}/${serie ?? ""}`.trim(),
    metadata: r as Record<string, unknown>,
    _customer_src: customerSrc,
  };
}

function mapNFSe(r: AnyRec, companyId: string, batchId: string): FiscalDocRecord {
  const cab = (r["Cabecalho"] as AnyRec) ?? (r["cabecalho"] as AnyRec) ?? r;
  const valores = (r["Valores"] as AnyRec) ?? (r["valores"] as AnyRec) ?? {};
  const tomador = (r["Tomador"] as AnyRec) ?? (r["tomador"] as AnyRec) ?? {};
  const nCodNF = asString(cab["nCodNF"] ?? cab["nIdNFSe"] ?? r["nCodNF"]);
  const numero = asString(cab["cNumero"] ?? cab["numero_nfse"] ?? r["cNumero"]);
  const serie = asString(cab["cSerie"] ?? cab["serie_nfse"]);
  const dtEmi = brDateToISO(cab["dEmissao"] ?? cab["data_emissao"] ?? r["dEmissao"]);
  const issue = dtEmi ?? new Date().toISOString().slice(0, 10);
  const valorBruto = asNumber(valores["nValorServicos"] ?? valores["valor_servicos"]);
  const valorLiq = asNumber(valores["nValorLiquido"] ?? valores["valor_liquido"] ?? valorBruto);
  const desconto = asNumber(valores["nDescIncondicionado"] ?? valores["desconto"]);
  const vISS = asNumber(valores["nValorISS"] ?? valores["valor_iss"]);
  const vPIS = asNumber(valores["nValorPIS"] ?? valores["valor_pis"]);
  const vCOFINS = asNumber(valores["nValorCOFINS"] ?? valores["valor_cofins"]);
  const vIRRF = asNumber(valores["nValorIR"] ?? valores["valor_ir"]);
  const vCSLL = asNumber(valores["nValorCSLL"] ?? valores["valor_csll"]);
  const vINSS = asNumber(valores["nValorINSS"] ?? valores["valor_inss"]);
  const status = mapNfeStatus(asString(cab["cStatus"] ?? cab["status_nfse"]));
  const partyName = asString(tomador["cNome"] ?? tomador["razao_social"] ?? tomador["xNome"]);
  const partyDoc = asString(tomador["cCnpjCpf"] ?? tomador["CNPJ"] ?? tomador["cnpj_cpf"]);
  const customerSrc = asString(tomador["nCodCli"] ?? tomador["codigo_cliente"]);
  return {
    company_id: companyId,
    source_endpoint: "servicos/nfse",
    source_record_id: nCodNF ?? `${numero}-${serie}`,
    imported_batch_id: batchId,
    doc_type: "nfse_emitida",
    status,
    numero,
    serie,
    chave_acesso: null,
    cfop: null,
    issue_date: issue,
    competence_date: issue,
    party_name: partyName,
    party_document: partyDoc,
    amount_gross: Math.abs(valorBruto),
    amount_discount: Math.abs(desconto),
    amount_net: Math.abs(valorLiq),
    amount_taxes: Math.abs(vISS + vPIS + vCOFINS + vIRRF + vCSLL + vINSS),
    amount_iss: Math.abs(vISS),
    amount_icms: 0,
    amount_pis: Math.abs(vPIS),
    amount_cofins: Math.abs(vCOFINS),
    amount_irrf: Math.abs(vIRRF),
    amount_csll: Math.abs(vCSLL),
    amount_inss: Math.abs(vINSS),
    description: `NFS-e ${numero ?? ""}`.trim(),
    metadata: r as Record<string, unknown>,
    _customer_src: customerSrc,
  };
}

async function upsertFiscalDoc(record: FiscalDocRecord) {
  if (!record.source_record_id) return { inserted: 0, updated: 0, errors: 0 };
  const { _customer_src, metadata, ...base } = record;

  let customer_id: string | null = null;
  if (_customer_src) {
    const { data } = await supabaseAdmin
      .from("customers").select("id")
      .eq("company_id", record.company_id).eq("source_record_id", _customer_src).maybeSingle();
    customer_id = data?.id ?? null;
  }

  // Try to link to a financial entry (receivable) via document_number
  let linked_financial_entry_id: string | null = null;
  if (record.numero) {
    const { data } = await supabaseAdmin
      .from("financial_entries").select("id")
      .eq("company_id", record.company_id)
      .eq("source_endpoint", "financas/contareceber")
      .eq("document_number", record.numero)
      .maybeSingle();
    linked_financial_entry_id = data?.id ?? null;
  }

  const enriched = {
    ...base,
    source_record_id: base.source_record_id as string,
    customer_id,
    supplier_id: null as string | null,
    linked_financial_entry_id,
    metadata: metadata as never,
    source_system: "omie",
    synced_at: new Date().toISOString(),
  };

  const { data: existing } = await supabaseAdmin
    .from("fiscal_documents").select("id")
    .eq("company_id", enriched.company_id)
    .eq("source_endpoint", enriched.source_endpoint)
    .eq("source_record_id", enriched.source_record_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("fiscal_documents").update(enriched).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("fiscal_documents").insert([enriched]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

// --- Endpoint runners ---

async function runListEndpoint(opts: {
  key: OmieEndpointKey;
  companyId: string;
  triggeredBy: string | null;
  param: Record<string, unknown>;
  upsert: (record: AnyRec, batchId: string) => Promise<{ inserted: number; updated: number; errors: number }>;
}): Promise<SyncRunResult["endpoints"][number]> {
  const def = OMIE_ENDPOINTS[opts.key];
  const start = Date.now();
  const batchId = await startBatch(opts.companyId, def.endpoint, opts.triggeredBy, { call: def.call, param: opts.param });
  await logToDb(opts.companyId, batchId, "info", `Iniciando sync ${def.label}`, def.endpoint, { param: opts.param });

  let inserted = 0, updated = 0, errors = 0, total = 0;
  try {
    for await (const page of paginateOmie<AnyRec>({
      endpoint: def.endpoint,
      call: def.call,
      param: opts.param,
      pageSize: 200,
      maxPages: 50,
    })) {
      if (!page.ok) {
        errors += 1;
        await recordError(opts.companyId, batchId, def.endpoint, page.error, opts.param);
        break;
      }
      // Persist raw payload page
      await supabaseAdmin.from("omie_raw_payloads").insert({
        company_id: opts.companyId,
        batch_id: batchId,
        source_endpoint: def.endpoint,
        source_record_id: `page:${page.page}`,
        payload: page.raw as never,
      });
      for (const item of page.items) {
        total += 1;
        try {
          const r = await opts.upsert(item, batchId);
          inserted += r.inserted;
          updated += r.updated;
          errors += r.errors;
        } catch (e) {
          errors += 1;
          await recordError(opts.companyId, batchId, def.endpoint, e instanceof Error ? e.message : String(e), item);
        }
      }
    }
    const status = errors === 0 ? "success" : (inserted + updated > 0 ? "partial" : "error");
    await finishBatch(batchId, status, inserted + updated, errors, total);
    await logToDb(opts.companyId, batchId, "info", `Sync ${def.label} concluído`, def.endpoint, { inserted, updated, errors, total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordError(opts.companyId, batchId, def.endpoint, msg, null);
    await finishBatch(batchId, "error", inserted + updated, errors + 1, total);
    await logToDb(opts.companyId, batchId, "error", `Falha em ${def.label}: ${msg}`, def.endpoint, {});
  }
  return { key: opts.key, batchId, inserted, updated, errors, durationMs: Date.now() - start };
}

// --- Upserters ---

type FinancialEntryInsert = ReturnType<typeof mapContaPagar> | ReturnType<typeof mapContaReceber>;

async function upsertFinancialEntry(record: FinancialEntryInsert): Promise<{ inserted: number; updated: number; errors: number }> {
  if (!record.source_record_id) return { inserted: 0, updated: 0, errors: 0 };

  // Resolve foreign keys from raw OMIE codes
  const { _bank_src, _party_src, metadata, ...base } = record;
  let bank_account_id: string | null = null;
  let supplier_id: string | null = null;
  let customer_id: string | null = null;
  if (_bank_src) {
    const { data } = await supabaseAdmin
      .from("bank_accounts").select("id")
      .eq("company_id", base.company_id).eq("source_record_id", _bank_src).maybeSingle();
    bank_account_id = data?.id ?? null;
  }
  if (_party_src) {
    if (base.direction === "saida") {
      const { data } = await supabaseAdmin
        .from("suppliers").select("id")
        .eq("company_id", base.company_id).eq("source_record_id", _party_src).maybeSingle();
      supplier_id = data?.id ?? null;
    } else {
      const { data } = await supabaseAdmin
        .from("customers").select("id")
        .eq("company_id", base.company_id).eq("source_record_id", _party_src).maybeSingle();
      customer_id = data?.id ?? null;
    }
  }
  const enriched = {
    ...base,
    metadata: metadata as never,
    bank_account_id,
    supplier_id,
    customer_id,
  };

  const { data: existing } = await supabaseAdmin
    .from("financial_entries")
    .select("id")
    .eq("company_id", enriched.company_id)
    .eq("source_endpoint", enriched.source_endpoint)
    .eq("source_record_id", enriched.source_record_id!)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("financial_entries")
      .update({ ...enriched, synced_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin
    .from("financial_entries")
    .insert([{ ...enriched, synced_at: new Date().toISOString() }]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

async function upsertCategoria(item: AnyRec, companyId: string) {
  const code = asString(item["codigo"]);
  if (!code) return { inserted: 0, updated: 0, errors: 0 };
  const description = asString(item["descricao"]) ?? code;
  const { data: existing } = await supabaseAdmin
    .from("categories").select("id").eq("company_id", companyId).eq("code", code).maybeSingle();
  const payload = { company_id: companyId, code, description, source_record_id: code, synced_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from("categories").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("categories").insert(payload);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

async function upsertCostCenter(item: AnyRec, companyId: string) {
  const code = asString(item["codigo"] ?? item["codigo_departamento"]);
  if (!code) return { inserted: 0, updated: 0, errors: 0 };
  const description = asString(item["descricao"] ?? item["nome"]) ?? code;
  const { data: existing } = await supabaseAdmin
    .from("cost_centers").select("id").eq("company_id", companyId).eq("code", code).maybeSingle();
  const payload = { company_id: companyId, code, description, source_record_id: code, synced_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from("cost_centers").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("cost_centers").insert(payload);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

async function upsertCustomerOrSupplier(item: AnyRec, companyId: string, kind: "cliente" | "fornecedor" | "auto") {
  const id = asString(item["codigo_cliente_omie"]);
  const name = asString(item["razao_social"] ?? item["nome_fantasia"]) ?? "—";
  const doc = asString(item["cnpj_cpf"]);
  const email = asString(item["email"]);
  if (!id) return { inserted: 0, updated: 0, errors: 0 };
  const tags = (item["tags"] as AnyRec[] | undefined) ?? [];
  const isFornecedor =
    kind === "fornecedor" ||
    (kind === "auto" && tags.some((t) => /forn/i.test(String(t["tag"] ?? ""))));
  const table = isFornecedor ? "suppliers" : "customers";
  const { data: existing } = await supabaseAdmin
    .from(table).select("id").eq("company_id", companyId).eq("source_record_id", id).maybeSingle();
  const payload = { company_id: companyId, source_record_id: id, name, document: doc, email, synced_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from(table).update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from(table).insert(payload);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

async function upsertBankAccount(item: AnyRec, companyId: string) {
  const id = asString(item["nCodCC"] ?? item["codigo_conta"]);
  if (!id) return { inserted: 0, updated: 0, errors: 0 };
  const name = asString(item["descricao"] ?? item["cDesc"]) ?? id;
  const bank = asString(item["nome_banco"] ?? item["cBanco"]);
  const { data: existing } = await supabaseAdmin
    .from("bank_accounts").select("id").eq("company_id", companyId).eq("source_record_id", id).maybeSingle();
  const payload = { company_id: companyId, source_record_id: id, name, bank_name: bank, synced_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from("bank_accounts").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("bank_accounts").insert(payload);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

async function upsertBankMovement(item: AnyRec, companyId: string) {
  const rec = mapMovimento(item, companyId);
  if (!rec.source_record_id) return { inserted: 0, updated: 0, errors: 0 };
  const { data: existing } = await supabaseAdmin
    .from("bank_movements").select("id").eq("company_id", companyId).eq("source_record_id", rec.source_record_id).maybeSingle();
  // Try to associate with the first known bank account
  const { data: ba } = await supabaseAdmin
    .from("bank_accounts").select("id").eq("company_id", companyId).limit(1).maybeSingle();
  const bankId = ba?.id;
  if (!bankId) return { inserted: 0, updated: 0, errors: 0 };
  const { bank_account_id: _omit, ...rest } = rec;
  void _omit;
  const payload = { ...rest, bank_account_id: bankId, synced_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from("bank_movements").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("bank_movements").insert([payload]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

// --- Main entry point ---

export async function runOmieSync(opts: SyncRunOptions): Promise<SyncRunResult> {
  const list = (opts.endpoints && opts.endpoints.length > 0) ? opts.endpoints : OMIE_PRIORITY_ORDER;
  const triggeredBy = opts.triggeredBy ?? null;

  // Reap stuck batches: any batch left in `running` for >15 min is a casualty
  // of the Worker being killed mid-execution (CPU/wall-time limit). Mark them
  // as `error` so the UI stops showing them as "rodando" indefinidamente.
  try {
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    await supabaseAdmin
      .from("omie_raw_sync_batches")
      .update({ status: "error", finished_at: new Date().toISOString() })
      .eq("company_id", opts.companyId)
      .eq("status", "running")
      .lt("started_at", cutoff);
  } catch (e) {
    logCtx("warn", "reap stuck batches failed", { error: e instanceof Error ? e.message : String(e) });
  }

  // Build date filter for transactional endpoints
  const today = new Date();
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const start = opts.startDate ? new Date(opts.startDate) : new Date(today.getTime() - 7 * 86_400_000);
  const end = opts.endDate ? new Date(opts.endDate) : today;

  const periodFilter = {
    pagina: 1,
    registros_por_pagina: 200,
    filtrar_por_emissao_de: fmt(start),
    filtrar_por_emissao_ate: fmt(end),
  };

  // Slice the [start, end] range into yearly windows so each batch fits inside
  // the Worker time budget. For wide ranges (full sync = ~10 anos), a single
  // batch would call Omie hundreds of times and get killed mid-flight.
  const periodSlices: Array<{ from: Date; to: Date }> = [];
  {
    const spanMs = end.getTime() - start.getTime();
    const ONE_YEAR_MS = 366 * 86_400_000;
    if (spanMs <= ONE_YEAR_MS) {
      periodSlices.push({ from: start, to: end });
    } else {
      let cursor = new Date(start);
      while (cursor <= end) {
        const sliceEnd = new Date(cursor);
        sliceEnd.setFullYear(sliceEnd.getFullYear() + 1);
        sliceEnd.setDate(sliceEnd.getDate() - 1);
        const to = sliceEnd > end ? end : sliceEnd;
        periodSlices.push({ from: new Date(cursor), to });
        cursor = new Date(to);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }
  const buildPeriodFilter = (from: Date, to: Date) => ({
    pagina: 1,
    registros_por_pagina: 200,
    filtrar_por_emissao_de: fmt(from),
    filtrar_por_emissao_ate: fmt(to),
  });

  // Helper: aggregate multiple slice results into a single endpoint entry.
  const runSliced = async (
    key: OmieEndpointKey,
    upsert: (item: AnyRec, batchId: string) => Promise<{ inserted: number; updated: number; errors: number }>,
  ): Promise<SyncRunResult["endpoints"][number]> => {
    const sliceResults: SyncRunResult["endpoints"][number][] = [];
    for (const slice of periodSlices) {
      const r = await runListEndpoint({
        key,
        companyId: opts.companyId,
        triggeredBy,
        param: buildPeriodFilter(slice.from, slice.to),
        upsert,
      });
      sliceResults.push(r);
    }
    return sliceResults.reduce(
      (acc, r) => ({
        key,
        batchId: r.batchId, // last batch
        inserted: acc.inserted + r.inserted,
        updated: acc.updated + r.updated,
        errors: acc.errors + r.errors,
        durationMs: acc.durationMs + r.durationMs,
      }),
      { key, batchId: "", inserted: 0, updated: 0, errors: 0, durationMs: 0 },
    );
  };

  const results: SyncRunResult["endpoints"] = [];
  let totalInserted = 0, totalUpdated = 0, totalErrors = 0;

  for (const key of list) {
    let r: SyncRunResult["endpoints"][number];
    switch (key) {
      case "categorias":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: {}, upsert: (item) => upsertCategoria(item, opts.companyId) });
        break;
      case "centros_de_custo":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: {}, upsert: (item) => upsertCostCenter(item, opts.companyId) });
        break;
      case "contas_correntes":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: {}, upsert: (item) => upsertBankAccount(item, opts.companyId) });
        break;
      case "clientes":
        // OMIE geral/clientes não aceita filtro cliente_fornecedor — busca todos
        // e distingue cliente/fornecedor pelas tags no upsert.
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: { apenas_importado_api: "N" }, upsert: (item) => upsertCustomerOrSupplier(item, opts.companyId, "auto") });
        break;
      case "fornecedores":
        // Fornecedores são populados no mesmo passo de "clientes" via auto-detecção por tags.
        r = { key, batchId: "", inserted: 0, updated: 0, errors: 0, durationMs: 0 };
        break;
      case "contas_pagar":
        r = await runSliced(key, (item, batchId) => upsertFinancialEntry(mapContaPagar(item, opts.companyId, batchId)));
        break;
      case "contas_receber":
        r = await runSliced(key, (item, batchId) => upsertFinancialEntry(mapContaReceber(item, opts.companyId, batchId)));
        break;
      case "movimentacoes_bancarias":
        r = await runBankStatementsSync({
          companyId: opts.companyId,
          triggeredBy,
          startDate: opts.startDate,
          endDate: opts.endDate,
          bankAccountId: opts.bankAccountId ?? null,
        });
        break;
      case "saldos_bancarios":
        r = await runBankBalancesSync({
          companyId: opts.companyId,
          triggeredBy,
        });
        break;
      case "pedidos_venda":
        r = await runSliced(key, (item, batchId) => upsertCommitment(mapPedidoVenda(item, opts.companyId, batchId)));
        break;
      case "ordens_compra":
        r = await runSliced(key, (item, batchId) => upsertCommitment(mapOrdemCompra(item, opts.companyId, batchId)));
        break;
      case "notas_fiscais_emitidas":
        r = await runSliced(key, (item, batchId) => upsertFiscalDoc(mapNFe(item, opts.companyId, batchId)));
        break;
      case "notas_servico_emitidas":
        r = await runSliced(key, (item, batchId) => upsertFiscalDoc(mapNFSe(item, opts.companyId, batchId)));
        break;
      case "lancamentos_cc":
        r = await runLancamentosCCSync({
          companyId: opts.companyId,
          triggeredBy,
          startDate: opts.startDate,
          endDate: opts.endDate,
          bankAccountId: opts.bankAccountId ?? null,
        });
        break;
      case "projetos":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: {}, upsert: (item) => upsertProjeto(item, opts.companyId) });
        break;
      case "tags":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: {}, upsert: (item) => upsertTag(item, opts.companyId) });
        break;
      case "emprestimos_financiamentos":
        r = await runListEndpoint({
          key,
          companyId: opts.companyId,
          triggeredBy,
          param: { pagina: 1, registros_por_pagina: 100 },
          upsert: (item) => upsertLoan(item, opts.companyId),
        });
        break;
    }
    results.push(r);
    totalInserted += r.inserted;
    totalUpdated += r.updated;
    totalErrors += r.errors;
    logCtx("info", `Endpoint ${key} done`, r);
  }

  // Run pipeline: classify + snapshot
  let pipeline: SyncRunResult["pipeline"] = undefined;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin.rpc("run_full_pipeline", { _company: opts.companyId, _date: today });
    if (!error && data) {
      const d = data as { classified_entries?: number; kpi_snapshot_id?: string };
      pipeline = { classified: d.classified_entries ?? 0, snapshotId: d.kpi_snapshot_id ?? null };
    }
  } catch (e) {
    logCtx("warn", "pipeline failed", { error: e instanceof Error ? e.message : String(e) });
  }

  // Post-processing: identify transfers, reconcile, link projects, recompute balance.
  // These used to be manual buttons — now they always run after sync so the user
  // doesn't need to click anything.
  try {
    const today = new Date().toISOString().slice(0, 10);
    await Promise.allSettled([
      supabaseAdmin.rpc("pair_bank_transfers", { _company: opts.companyId }),
      supabaseAdmin.rpc("reconcile_bank_movements", { _company: opts.companyId }),
      supabaseAdmin.rpc("link_financial_entries_to_projects", { _company: opts.companyId }),
      supabaseAdmin.rpc("compute_balance_projection", { _company: opts.companyId, _date: today }),
    ]);
    logCtx("info", "post-sync processing done", {});
  } catch (e) {
    logCtx("warn", "post-sync processing failed", { error: e instanceof Error ? e.message : String(e) });
  }

  // Update sync_preferences last_*
  const stamp = new Date().toISOString();
  const patch = opts.mode === "full"
    ? { last_full_sync_at: stamp, last_incremental_sync_at: stamp }
    : { last_incremental_sync_at: stamp };
  await supabaseAdmin.from("sync_preferences").upsert(
    { company_id: opts.companyId, ...patch },
    { onConflict: "company_id" }
  );

  // Test OMIE credentials presence (single ping) — surfaces fast errors
  return { ok: totalErrors === 0, endpoints: results, totals: { inserted: totalInserted, updated: totalUpdated, errors: totalErrors }, pipeline };
}

export async function pingOmie(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await callOmie({
      endpoint: "geral/empresas",
      call: "ListarEmpresas",
      param: { pagina: 1, registros_por_pagina: 1 },
      timeoutMs: 15_000,
    });
    if (!res.ok) return { ok: false, message: res.faultstring ?? `HTTP ${res.status}` };
    return { ok: true, message: "Conexão OK" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// --- Bank statements sync (ListarExtrato per bank account) ---

async function runBankStatementsSync(opts: {
  companyId: string;
  triggeredBy: string | null;
  startDate?: string;
  endDate?: string;
  bankAccountId?: string | null;
}): Promise<SyncRunResult["endpoints"][number]> {
  const def = OMIE_ENDPOINTS.movimentacoes_bancarias;
  const start = Date.now();
  const today = new Date();
  const dStart = opts.startDate ? new Date(opts.startDate) : new Date(today.getTime() - 90 * 86_400_000);
  const dEnd = opts.endDate ? new Date(opts.endDate) : today;
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  const batchId = await startBatch(opts.companyId, def.endpoint, opts.triggeredBy, {
    call: def.call,
    range: { from: fmt(dStart), to: fmt(dEnd) },
  });
  await logToDb(opts.companyId, batchId, "info", `Iniciando extrato bancário`, def.endpoint, {});

  let inserted = 0, updated = 0, errors = 0, total = 0;
  try {
    let q = supabaseAdmin
      .from("bank_accounts")
      .select("id, source_record_id, name")
      .eq("company_id", opts.companyId)
      .eq("active", true);
    if (opts.bankAccountId) q = q.eq("id", opts.bankAccountId);
    const { data: accounts } = await q;
    const list = (accounts ?? []).filter((a) => a.source_record_id);
    if (list.length === 0) {
      await logToDb(opts.companyId, batchId, "warn", "Nenhuma conta bancária com nCodCC configurado", def.endpoint, {});
    }
    for (const acc of list) {
      const ncod = Number(acc.source_record_id);
      if (!Number.isFinite(ncod)) continue;
      try {
        for await (const page of paginateOmie<AnyRec>({
          endpoint: def.endpoint,
          call: def.call,
          param: {
            nCodCC: ncod,
            dDtInicial: fmt(dStart),
            dDtFinal: fmt(dEnd),
          },
          pageKey: "nPagina",
          pageSizeKey: "nRegPorPagina",
          totalPagesKey: "nTotPaginas",
          pageSize: 200,
          maxPages: 50,
        })) {
          if (!page.ok) {
            errors += 1;
            await recordError(opts.companyId, batchId, def.endpoint, page.error, { acc: acc.id });
            break;
          }
          await supabaseAdmin.from("omie_raw_payloads").insert({
            company_id: opts.companyId,
            batch_id: batchId,
            source_endpoint: def.endpoint,
            source_record_id: `acc:${acc.source_record_id}:page:${page.page}`,
            payload: page.raw as never,
          });
          for (const item of page.items) {
            total += 1;
            try {
              const r = await upsertBankMovementForAccount(item, opts.companyId, acc.id);
              inserted += r.inserted;
              updated += r.updated;
              errors += r.errors;
            } catch (e) {
              errors += 1;
              await recordError(opts.companyId, batchId, def.endpoint, e instanceof Error ? e.message : String(e), item);
            }
          }
        }
      } catch (e) {
        errors += 1;
        await recordError(opts.companyId, batchId, def.endpoint, e instanceof Error ? e.message : String(e), { acc: acc.id });
      }
    }
    const status = errors === 0 ? "success" : (inserted + updated > 0 ? "partial" : "error");
    await finishBatch(batchId, status, inserted + updated, errors, total);
    await logToDb(opts.companyId, batchId, "info", `Extrato concluído`, def.endpoint, { inserted, updated, errors, total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordError(opts.companyId, batchId, def.endpoint, msg, null);
    await finishBatch(batchId, "error", inserted + updated, errors + 1, total);
    await logToDb(opts.companyId, batchId, "error", `Falha extrato: ${msg}`, def.endpoint, {});
  }

  return { key: "movimentacoes_bancarias", batchId, inserted, updated, errors, durationMs: Date.now() - start };
}

async function upsertBankMovementForAccount(item: AnyRec, companyId: string, bankAccountId: string) {
  const rec = mapMovimento(item, companyId);
  if (!rec.source_record_id) return { inserted: 0, updated: 0, errors: 0 };
  const { data: existing } = await supabaseAdmin
    .from("bank_movements").select("id")
    .eq("company_id", companyId)
    .eq("source_record_id", rec.source_record_id)
    .maybeSingle();
  const { bank_account_id: _omit, ...rest } = rec;
  void _omit;
  const payload = { ...rest, bank_account_id: bankAccountId, synced_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from("bank_movements").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("bank_movements").insert([payload]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

// --- Bank balances sync (ListarPosicaoBancaria) ---

async function runBankBalancesSync(opts: {
  companyId: string;
  triggeredBy: string | null;
}): Promise<SyncRunResult["endpoints"][number]> {
  const def = OMIE_ENDPOINTS.saldos_bancarios;
  const start = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const batchId = await startBatch(opts.companyId, def.endpoint, opts.triggeredBy, { call: def.call });
  await logToDb(opts.companyId, batchId, "info", "Iniciando sync de saldos bancários", def.endpoint, {});

  let inserted = 0, updated = 0, errors = 0, total = 0;
  try {
    // ListarPosicaoBancaria não pagina (retorna posição atual de todas as contas)
    const res = await callOmie({
      endpoint: def.endpoint,
      call: def.call,
      param: { dDataPosicao: `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}` },
      timeoutMs: 30_000,
    });
    if (!res.ok) {
      errors += 1;
      await recordError(opts.companyId, batchId, def.endpoint, res.faultstring ?? `HTTP ${res.status}`, null);
      await finishBatch(batchId, "error", 0, 1, 0);
      return { key: "saldos_bancarios", batchId, inserted, updated, errors, durationMs: Date.now() - start };
    }

    await supabaseAdmin.from("omie_raw_payloads").insert({
      company_id: opts.companyId,
      batch_id: batchId,
      source_endpoint: def.endpoint,
      source_record_id: `posicao:${today}`,
      payload: res.data as never,
    });

    const data = (res.data ?? {}) as AnyRec;
    // Tenta múltiplos formatos de retorno conhecidos do Omie
    const items: AnyRec[] = (
      (data["ListaSaldo"] as AnyRec[] | undefined)
      ?? (data["lista_saldo"] as AnyRec[] | undefined)
      ?? (data["listaContas"] as AnyRec[] | undefined)
      ?? (data["saldos"] as AnyRec[] | undefined)
      ?? []
    );

    for (const item of items) {
      total += 1;
      try {
        const ncod = asString(item["nCodCC"] ?? item["codigo_conta"]);
        if (!ncod) continue;
        const balance = asNumber(item["nSaldoAtual"] ?? item["saldo_atual"] ?? item["nSaldo"] ?? 0);
        const blocked = asNumber(item["nSaldoBloqueado"] ?? item["saldo_bloqueado"] ?? 0);
        const dt = brDateToISO(item["dDtSaldo"] ?? item["data_saldo"]) ?? today;

        const { data: ba } = await supabaseAdmin
          .from("bank_accounts").select("id")
          .eq("company_id", opts.companyId)
          .eq("source_record_id", ncod)
          .maybeSingle();
        if (!ba) {
          await logToDb(opts.companyId, batchId, "warn", `Conta ${ncod} não cadastrada`, def.endpoint, { ncod });
          continue;
        }

        const { data: existing } = await supabaseAdmin
          .from("bank_balances_snapshots").select("id")
          .eq("company_id", opts.companyId)
          .eq("bank_account_id", ba.id)
          .eq("snapshot_date", dt)
          .maybeSingle();

        const payload = {
          company_id: opts.companyId,
          bank_account_id: ba.id,
          snapshot_date: dt,
          balance,
          blocked,
          source: "omie",
          synced_at: new Date().toISOString(),
        };

        if (existing) {
          const { error } = await supabaseAdmin.from("bank_balances_snapshots").update(payload).eq("id", existing.id);
          if (error) errors += 1; else updated += 1;
        } else {
          const { error } = await supabaseAdmin.from("bank_balances_snapshots").insert([payload]);
          if (error) errors += 1; else inserted += 1;
        }
      } catch (e) {
        errors += 1;
        await recordError(opts.companyId, batchId, def.endpoint, e instanceof Error ? e.message : String(e), item);
      }
    }

    const status = errors === 0 ? "success" : (inserted + updated > 0 ? "partial" : "error");
    await finishBatch(batchId, status, inserted + updated, errors, total);
    await logToDb(opts.companyId, batchId, "info", "Sync de saldos concluído", def.endpoint, { inserted, updated, errors, total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordError(opts.companyId, batchId, def.endpoint, msg, null);
    await finishBatch(batchId, "error", inserted + updated, errors + 1, total);
    await logToDb(opts.companyId, batchId, "error", `Falha em saldos: ${msg}`, def.endpoint, {});
  }

  return { key: "saldos_bancarios", batchId, inserted, updated, errors, durationMs: Date.now() - start };
}
// --- Lançamentos de Conta Corrente (financas/contacorrentelancamentos) ---

type BankMovementKind = "extrato" | "lancamento_cc" | "transferencia" | "tarifa" | "juros" | "rendimento" | "manual" | "outro";

function inferKindFromText(desc: string | null, codeOp: string | null): BankMovementKind {
  const s = `${desc ?? ""} ${codeOp ?? ""}`.toLowerCase();
  if (/transf/.test(s)) return "transferencia";
  if (/(tarifa|tar\.|cesta|pacote|manuten[cç][aã]o|iof)/.test(s)) return "tarifa";
  if (/(juro|multa|encargo)/.test(s)) return "juros";
  if (/(rendimento|cdb|aplica|resgate|poupan)/.test(s)) return "rendimento";
  return "lancamento_cc";
}

interface LancCCRecord {
  company_id: string;
  bank_account_id: string;
  source_endpoint: string;
  source_record_id: string;
  movement_date: string;
  amount: number;
  direction: "entrada" | "saida";
  description: string | null;
  document_number: string | null;
  category_raw: string | null;
  kind: BankMovementKind;
  metadata: Record<string, unknown>;
}

function mapLancCC(item: AnyRec, companyId: string, bankAccountId: string): LancCCRecord | null {
  const id = asString(item["nCodLanc"] ?? item["codigo_lancamento"] ?? item["nIdLancCC"]);
  if (!id) return null;
  const valor = asNumber(item["nValorLancto"] ?? item["valor_lancamento"] ?? item["nValor"] ?? 0);
  const tipo = String(item["cCodTipo"] ?? item["cTipoOperacao"] ?? item["tipo_operacao"] ?? "").toUpperCase();
  const direction: "entrada" | "saida" = tipo === "D" || tipo === "DEB"
    ? "saida"
    : tipo === "C" || tipo === "CRE"
      ? "entrada"
      : (valor >= 0 ? "entrada" : "saida");
  const desc = asString(item["cObservacao"] ?? item["cDescLancto"] ?? item["descricao"]);
  const codeOp = asString(item["cCodTipo"] ?? item["cCodCateg"]);
  const kind = inferKindFromText(desc, codeOp);
  return {
    company_id: companyId,
    bank_account_id: bankAccountId,
    source_endpoint: "financas/contacorrentelancamentos",
    source_record_id: id,
    movement_date: brDateToISO(item["dDtLancto"] ?? item["data_lancamento"]) ?? new Date().toISOString().slice(0, 10),
    amount: Math.abs(valor),
    direction,
    description: desc,
    document_number: asString(item["cNumDocumento"] ?? item["numero_documento"]),
    category_raw: asString(item["cCodCateg"] ?? item["codigo_categoria"]),
    kind,
    metadata: item,
  };
}

async function upsertLancCC(rec: LancCCRecord) {
  const { data: existing } = await supabaseAdmin
    .from("bank_movements").select("id")
    .eq("company_id", rec.company_id)
    .eq("source_endpoint", rec.source_endpoint)
    .eq("source_record_id", rec.source_record_id)
    .maybeSingle();
  const payload = { ...rec, metadata: rec.metadata as never, synced_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from("bank_movements").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("bank_movements").insert([payload]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

async function runLancamentosCCSync(opts: {
  companyId: string;
  triggeredBy: string | null;
  startDate?: string;
  endDate?: string;
  bankAccountId?: string | null;
}): Promise<SyncRunResult["endpoints"][number]> {
  const def = OMIE_ENDPOINTS.lancamentos_cc;
  const start = Date.now();
  const today = new Date();
  const dStart = opts.startDate ? new Date(opts.startDate) : new Date(today.getTime() - 90 * 86_400_000);
  const dEnd = opts.endDate ? new Date(opts.endDate) : today;
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  const batchId = await startBatch(opts.companyId, def.endpoint, opts.triggeredBy, {
    call: def.call,
    range: { from: fmt(dStart), to: fmt(dEnd) },
  });
  await logToDb(opts.companyId, batchId, "info", "Iniciando lançamentos CC", def.endpoint, {});

  let inserted = 0, updated = 0, errors = 0, total = 0;
  try {
    let q = supabaseAdmin
      .from("bank_accounts")
      .select("id, source_record_id")
      .eq("company_id", opts.companyId)
      .eq("active", true);
    if (opts.bankAccountId) q = q.eq("id", opts.bankAccountId);
    const { data: accounts } = await q;
    const list = (accounts ?? []).filter((a) => a.source_record_id);

    for (const acc of list) {
      const ncod = Number(acc.source_record_id);
      if (!Number.isFinite(ncod)) continue;
      try {
        for await (const page of paginateOmie<AnyRec>({
          endpoint: def.endpoint,
          call: def.call,
          param: {
            nCodCC: ncod,
            dDtInicial: fmt(dStart),
            dDtFinal: fmt(dEnd),
          },
          pageKey: "nPagina",
          pageSizeKey: "nRegPorPagina",
          totalPagesKey: "nTotPaginas",
          pageSize: 200,
          maxPages: 50,
        })) {
          if (!page.ok) {
            errors += 1;
            await recordError(opts.companyId, batchId, def.endpoint, page.error, { acc: acc.id });
            break;
          }
          await supabaseAdmin.from("omie_raw_payloads").insert({
            company_id: opts.companyId,
            batch_id: batchId,
            source_endpoint: def.endpoint,
            source_record_id: `acc:${acc.source_record_id}:page:${page.page}`,
            payload: page.raw as never,
          });
          for (const item of page.items) {
            total += 1;
            try {
              const rec = mapLancCC(item, opts.companyId, acc.id);
              if (!rec) continue;
              const r = await upsertLancCC(rec);
              inserted += r.inserted;
              updated += r.updated;
              errors += r.errors;
            } catch (e) {
              errors += 1;
              await recordError(opts.companyId, batchId, def.endpoint, e instanceof Error ? e.message : String(e), item);
            }
          }
        }
      } catch (e) {
        errors += 1;
        await recordError(opts.companyId, batchId, def.endpoint, e instanceof Error ? e.message : String(e), { acc: acc.id });
      }
    }

    // Pair internal transfers after ingest
    try {
      await supabaseAdmin.rpc("pair_bank_transfers", { _company: opts.companyId });
    } catch (e) {
      logCtx("warn", "pair_bank_transfers failed", { error: e instanceof Error ? e.message : String(e) });
    }

    const status = errors === 0 ? "success" : (inserted + updated > 0 ? "partial" : "error");
    await finishBatch(batchId, status, inserted + updated, errors, total);
    await logToDb(opts.companyId, batchId, "info", "Lançamentos CC concluído", def.endpoint, { inserted, updated, errors, total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordError(opts.companyId, batchId, def.endpoint, msg, null);
    await finishBatch(batchId, "error", inserted + updated, errors + 1, total);
    await logToDb(opts.companyId, batchId, "error", `Falha lançamentos CC: ${msg}`, def.endpoint, {});
  }
  return { key: "lancamentos_cc", batchId, inserted, updated, errors, durationMs: Date.now() - start };
}

// --- Projetos & Tags ---

async function upsertProjeto(item: AnyRec, companyId: string) {
  const code = asString(item["codigo"] ?? item["nCodProj"] ?? item["codint"]);
  if (!code) return { inserted: 0, updated: 0, errors: 0 };
  const name = asString(item["nome"] ?? item["cNome"] ?? item["descricao"]) ?? code;
  const status = asString(item["inativo"]) === "S" ? "inativo" : (asString(item["status"]) ?? "ativo");
  const startDate = brDateToISO(item["dInicio"] ?? item["data_inicio"]);
  const endDate = brDateToISO(item["dTermino"] ?? item["data_termino"]);
  const payload = {
    company_id: companyId,
    source_record_id: code,
    code,
    name,
    status,
    start_date: startDate,
    end_date: endDate,
    active: status !== "inativo",
    metadata: item as never,
    synced_at: new Date().toISOString(),
  };
  const { data: existing } = await supabaseAdmin
    .from("projects").select("id").eq("company_id", companyId).eq("code", code).maybeSingle();
  if (existing) {
    const { error } = await supabaseAdmin.from("projects").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("projects").insert([payload]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

async function upsertTag(item: AnyRec, companyId: string) {
  const code = asString(item["nCodCadTag"] ?? item["cCodIntTag"] ?? item["codigo"]);
  if (!code) return { inserted: 0, updated: 0, errors: 0 };
  const description = asString(item["cNomeTag"] ?? item["descricao"] ?? item["nome"]) ?? code;
  const color = asString(item["cCorTag"] ?? item["cor"]);
  const inactive = asString(item["cInativa"] ?? item["inativo"]) === "S";
  const payload = {
    company_id: companyId,
    source_record_id: code,
    code,
    description,
    color,
    active: !inactive,
    metadata: item as never,
    synced_at: new Date().toISOString(),
  };
  const { data: existing } = await supabaseAdmin
    .from("tags").select("id").eq("company_id", companyId).eq("code", code).maybeSingle();
  if (existing) {
    const { error } = await supabaseAdmin.from("tags").update(payload).eq("id", existing.id);
    return { inserted: 0, updated: error ? 0 : 1, errors: error ? 1 : 0 };
  }
  const { error } = await supabaseAdmin.from("tags").insert([payload]);
  return { inserted: error ? 0 : 1, updated: 0, errors: error ? 1 : 0 };
}

// --- Empréstimos & Financiamentos ---

function mapLoanStatus(s: unknown): "ativo" | "quitado" | "inadimplente" | "renegociado" | "cancelado" {
  const v = (asString(s) ?? "").toLowerCase();
  if (v.includes("quit")) return "quitado";
  if (v.includes("inad")) return "inadimplente";
  if (v.includes("renego")) return "renegociado";
  if (v.includes("cancel")) return "cancelado";
  return "ativo";
}

function mapLoanKind(s: unknown): "emprestimo" | "financiamento" | "leasing" | "antecipacao" | "capital_giro" | "outro" {
  const v = (asString(s) ?? "").toLowerCase();
  if (v.includes("financi")) return "financiamento";
  if (v.includes("leas")) return "leasing";
  if (v.includes("antec")) return "antecipacao";
  if (v.includes("giro")) return "capital_giro";
  if (v.includes("emprest")) return "emprestimo";
  return v ? "outro" : "emprestimo";
}

function mapInstallmentStatus(s: unknown, dueISO: string | null): "previsto" | "pago" | "parcial" | "vencido" | "cancelado" {
  const v = (asString(s) ?? "").toLowerCase();
  if (v.includes("pag") && !v.includes("não")) return "pago";
  if (v.includes("parcial")) return "parcial";
  if (v.includes("cancel")) return "cancelado";
  if (dueISO && new Date(dueISO) < new Date()) return "vencido";
  return "previsto";
}

async function upsertLoan(item: AnyRec, companyId: string) {
  const cab = (item["cabecalho"] as AnyRec) ?? item;
  const code = asString(cab["nCodCtrEmp"] ?? cab["codigo_contrato"] ?? cab["cCodIntCtrEmp"]);
  if (!code) return { inserted: 0, updated: 0, errors: 0 };

  const principal = asNumber(cab["nValorContrato"] ?? cab["valor_contrato"] ?? 0);
  const totalParcelas = Number(asString(cab["nTotalParcelas"] ?? cab["total_parcelas"]) ?? "0") || null;
  const taxa = asNumber(cab["nTaxaJurosMensal"] ?? cab["taxa_juros_mensal"] ?? 0) || null;
  const contractDate = brDateToISO(cab["dDtContrato"] ?? cab["data_contrato"]);
  const firstDue = brDateToISO(cab["dDtPrimeiraPrestacao"] ?? cab["data_primeira_prestacao"]);
  const lastDue = brDateToISO(cab["dDtUltimaPrestacao"] ?? cab["data_ultima_prestacao"]);

  const partySrc = asString(cab["nCodCli"] ?? cab["codigo_cliente_fornecedor"]);
  let supplier_id: string | null = null;
  if (partySrc) {
    const { data } = await supabaseAdmin
      .from("suppliers").select("id")
      .eq("company_id", companyId).eq("source_record_id", partySrc).maybeSingle();
    supplier_id = data?.id ?? null;
  }

  const bankSrc = asString(cab["nCodCC"] ?? cab["codigo_conta_corrente"]);
  let bank_account_id: string | null = null;
  if (bankSrc) {
    const { data } = await supabaseAdmin
      .from("bank_accounts").select("id")
      .eq("company_id", companyId).eq("source_record_id", bankSrc).maybeSingle();
    bank_account_id = data?.id ?? null;
  }

  const payload = {
    company_id: companyId,
    source_system: "omie",
    source_endpoint: "financas/contratoemprestimo",
    source_record_id: code,
    contract_number: asString(cab["cNumCtrEmp"] ?? cab["numero_contrato"]) ?? code,
    description: asString(cab["cObservacao"] ?? cab["observacao"] ?? cab["descricao"]),
    institution: asString(cab["cInstFinanceira"] ?? cab["instituicao_financeira"]),
    supplier_id,
    bank_account_id,
    kind: mapLoanKind(cab["cTipoCtrEmp"] ?? cab["tipo_contrato"]),
    status: mapLoanStatus(cab["cStatus"] ?? cab["status"]),
    contract_date: contractDate,
    first_due_date: firstDue,
    last_due_date: lastDue,
    principal_amount: principal,
    interest_rate_monthly: taxa,
    total_installments: totalParcelas,
    metadata: item as never,
    synced_at: new Date().toISOString(),
  };

  const { data: existing } = await supabaseAdmin
    .from("loans").select("id")
    .eq("company_id", companyId)
    .eq("source_endpoint", "financas/contratoemprestimo")
    .eq("source_record_id", code).maybeSingle();

  let loanId: string;
  let isInsert = false;
  if (existing) {
    const { error } = await supabaseAdmin.from("loans").update(payload).eq("id", existing.id);
    if (error) return { inserted: 0, updated: 0, errors: 1 };
    loanId = existing.id;
  } else {
    const { data, error } = await supabaseAdmin.from("loans").insert([payload]).select("id").single();
    if (error || !data) return { inserted: 0, updated: 0, errors: 1 };
    loanId = data.id;
    isInsert = true;
  }

  // Upsert installments (parcelas) if present
  const parcelas = (item["listaParcelas"] as AnyRec[] | undefined) ?? (cab["listaParcelas"] as AnyRec[] | undefined) ?? [];
  if (Array.isArray(parcelas) && parcelas.length > 0) {
    let paidCount = 0;
    let outstanding = 0;
    for (const p of parcelas) {
      const num = Number(asString(p["nNumParcela"] ?? p["numero_parcela"]) ?? "0") || 0;
      if (!num) continue;
      const due = brDateToISO(p["dDtVencto"] ?? p["data_vencimento"]);
      if (!due) continue;
      const amount = asNumber(p["nValorParcela"] ?? p["valor_parcela"] ?? 0);
      const principalP = asNumber(p["nValorPrincipal"] ?? p["valor_principal"] ?? 0);
      const interestP = asNumber(p["nValorJuros"] ?? p["valor_juros"] ?? 0);
      const paid = asNumber(p["nValorPago"] ?? p["valor_pago"] ?? 0);
      const status = mapInstallmentStatus(p["cStatus"] ?? p["status"], due);
      if (status === "pago") paidCount += 1;
      if (status !== "pago" && status !== "cancelado") outstanding += amount - paid;

      await supabaseAdmin.from("loan_installments").upsert({
        loan_id: loanId,
        company_id: companyId,
        installment_number: num,
        due_date: due,
        amount,
        principal_amount: principalP,
        interest_amount: interestP,
        paid_amount: paid,
        paid_at: brDateToISO(p["dDtPagto"] ?? p["data_pagamento"]),
        status,
        metadata: p as never,
      } as never, { onConflict: "loan_id,installment_number" });
    }
    await supabaseAdmin.from("loans")
      .update({ paid_installments: paidCount, outstanding_balance: outstanding })
      .eq("id", loanId);
  }

  return { inserted: isInsert ? 1 : 0, updated: isInsert ? 0 : 1, errors: 0 };
}

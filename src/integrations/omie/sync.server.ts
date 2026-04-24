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

async function upsertCustomerOrSupplier(item: AnyRec, companyId: string, kind: "cliente" | "fornecedor") {
  const id = asString(item["codigo_cliente_omie"]);
  const name = asString(item["razao_social"] ?? item["nome_fantasia"]) ?? "—";
  const doc = asString(item["cnpj_cpf"]);
  const email = asString(item["email"]);
  if (!id) return { inserted: 0, updated: 0, errors: 0 };
  const tags = (item["tags"] as AnyRec[] | undefined) ?? [];
  const isFornecedor = kind === "fornecedor" || tags.some((t) => /forn/i.test(String(t["tag"] ?? "")));
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
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: { apenas_importado_api: "N", clientesFiltro: { cliente_fornecedor: "C" } }, upsert: (item) => upsertCustomerOrSupplier(item, opts.companyId, "cliente") });
        break;
      case "fornecedores":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: { apenas_importado_api: "N", clientesFiltro: { cliente_fornecedor: "F" } }, upsert: (item) => upsertCustomerOrSupplier(item, opts.companyId, "fornecedor") });
        break;
      case "contas_pagar":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: periodFilter, upsert: (item, batchId) => upsertFinancialEntry(mapContaPagar(item, opts.companyId, batchId)) });
        break;
      case "contas_receber":
        r = await runListEndpoint({ key, companyId: opts.companyId, triggeredBy, param: periodFilter, upsert: (item, batchId) => upsertFinancialEntry(mapContaReceber(item, opts.companyId, batchId)) });
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
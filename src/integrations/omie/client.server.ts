// Server-only OMIE API client. Never import from client code.
// OMIE uses POST with { call, app_key, app_secret, param: [{...}] } payloads.

const DEFAULT_BASE = "https://app.omie.com.br/api/v1";

export interface OmieCallOptions {
  endpoint: string; // e.g. "financas/contapagar"
  call: string;     // e.g. "ListarContasPagar"
  param: Record<string, unknown>;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface OmieResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  faultcode?: string;
  faultstring?: string;
}

function getCredentials() {
  const app_key = process.env.OMIE_APP_KEY;
  const app_secret = process.env.OMIE_APP_SECRET;
  if (!app_key || !app_secret) {
    throw new Error("OMIE credentials missing (OMIE_APP_KEY / OMIE_APP_SECRET)");
  }
  return { app_key, app_secret };
}

export async function callOmie<T = unknown>(opts: OmieCallOptions): Promise<OmieResponse<T>> {
  // Gate POR MÉTODO (endpoint+call). OMIE rejeita apenas chamadas concorrentes
  // do MESMO método ("Já existe uma requisição desse método sendo executada"),
  // então não há motivo para serializar globalmente — isso só somava latência.
  return omieGate(`${opts.endpoint}::${opts.call}`, () => callOmieRaw<T>(opts));
}

// ---- Per-method throttle + retry ----
// OMIE rejeita chamadas concorrentes do MESMO método com:
//   "Já existe uma requisição desse método sendo executada..."
// Serializamos por método (não globalmente), com pequeno espaçamento entre
// páginas consecutivas do mesmo método, e fazemos retry com backoff.
const omieChains = new Map<string, Promise<unknown>>();
const omieLastAt = new Map<string, number>();
const OMIE_MIN_SPACING_MS = 120;

function omieGate<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = omieChains.get(key) ?? Promise.resolve();
  const run = prev.then(async () => {
    const last = omieLastAt.get(key) ?? 0;
    const wait = OMIE_MIN_SPACING_MS - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await task();
    } finally {
      omieLastAt.set(key, Date.now());
    }
  });
  omieChains.set(key, run.catch(() => undefined));
  return run as Promise<T>;
}

async function callOmieRaw<T = unknown>(opts: OmieCallOptions): Promise<OmieResponse<T>> {
  const maxAttempts = 4;
  let attempt = 0;
  let last: OmieResponse<T> | null = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    const res = await callOmieOnce<T>(opts);
    if (res.ok) return res;
    const msg = (res.faultstring ?? "").toLowerCase();
    // Retry on transient concurrency/lock errors only.
    if (msg.includes("já existe uma requisição") || msg.includes("api bloqueada")) {
      const backoff = msg.includes("api bloqueada") ? 5_000 : 1_200 * attempt;
      await new Promise((r) => setTimeout(r, backoff));
      last = res;
      continue;
    }
    return res;
  }
  return last ?? { ok: false, status: 0, faultstring: "OMIE retries exhausted" };
}

async function callOmieOnce<T = unknown>(opts: OmieCallOptions): Promise<OmieResponse<T>> {
  const { app_key, app_secret } = getCredentials();
  const base = opts.baseUrl ?? DEFAULT_BASE;
  const url = `${base.replace(/\/$/, "")}/${opts.endpoint.replace(/^\//, "")}/`;

  const body = {
    call: opts.call,
    app_key,
    app_secret,
    param: [opts.param],
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }

    if (!res.ok) {
      const j = json as { faultcode?: string; faultstring?: string } | null;
      return {
        ok: false,
        status: res.status,
        faultcode: j?.faultcode,
        faultstring: j?.faultstring ?? text.slice(0, 500),
      };
    }

    const j = json as { faultcode?: string; faultstring?: string } | null;
    if (j?.faultstring) {
      return { ok: false, status: res.status, faultcode: j.faultcode, faultstring: j.faultstring };
    }

    return { ok: true, status: res.status, data: json as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, faultstring: `Network error: ${msg}` };
  } finally {
    clearTimeout(t);
  }
}

// Generic paginated fetch — OMIE endpoints commonly accept `pagina` and return `total_de_paginas`.
export interface PaginatedOptions extends Omit<OmieCallOptions, "param"> {
  param: Record<string, unknown>;
  pageKey?: string;        // default "pagina"
  pageSizeKey?: string;    // default "registros_por_pagina"
  pageSize?: number;       // default 200
  totalPagesKey?: string;  // default "total_de_paginas"
  maxPages?: number;       // safety cap
}

export async function* paginateOmie<T = Record<string, unknown>>(opts: PaginatedOptions) {
  const pageKey = opts.pageKey ?? "pagina";
  const sizeKey = opts.pageSizeKey ?? "registros_por_pagina";
  const size = opts.pageSize ?? 200;
  const totalKey = opts.totalPagesKey ?? "total_de_paginas";
  const maxPages = opts.maxPages ?? 100;

  let page = 1;
  let totalPages = 1;
  do {
    const res = await callOmie<Record<string, unknown>>({
      endpoint: opts.endpoint,
      call: opts.call,
      baseUrl: opts.baseUrl,
      timeoutMs: opts.timeoutMs,
      param: { ...opts.param, [pageKey]: page, [sizeKey]: size },
    });
    if (!res.ok) {
      yield { page, ok: false as const, error: res.faultstring ?? `HTTP ${res.status}`, items: [] as T[] };
      return;
    }
    const data = res.data ?? {};
    const tp = Number(data[totalKey] ?? 1);
    totalPages = Number.isFinite(tp) ? tp : 1;

    // Try to find the records array — OMIE varies by endpoint.
    const items = extractRecords<T>(data);
    yield { page, ok: true as const, items, totalPages, raw: data };
    page += 1;
  } while (page <= totalPages && page <= maxPages);
}

function extractRecords<T>(payload: Record<string, unknown>): T[] {
  for (const key of Object.keys(payload)) {
    const v = payload[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

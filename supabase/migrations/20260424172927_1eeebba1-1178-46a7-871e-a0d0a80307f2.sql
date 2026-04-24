
-- ============================================================
-- A — Notas Fiscais (NF-e e NFS-e) — base de DRE por competência
-- ============================================================

-- Enum: tipo do documento fiscal
DO $$ BEGIN
  CREATE TYPE public.fiscal_doc_type AS ENUM (
    'nfe_emitida', 'nfe_recebida', 'nfse_emitida', 'nfse_recebida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum: status da nota
DO $$ BEGIN
  CREATE TYPE public.fiscal_doc_status AS ENUM (
    'autorizada', 'cancelada', 'denegada', 'inutilizada', 'rascunho'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal de documentos fiscais
CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  source_system text NOT NULL DEFAULT 'omie',
  source_endpoint text NOT NULL,
  source_record_id text,
  imported_batch_id uuid,

  doc_type public.fiscal_doc_type NOT NULL,
  status public.fiscal_doc_status NOT NULL DEFAULT 'autorizada',

  numero text,
  serie text,
  chave_acesso text,
  cfop text,

  issue_date date NOT NULL,
  competence_date date NOT NULL,

  customer_id uuid,
  supplier_id uuid,
  party_name text,
  party_document text,

  -- Valores consolidados
  amount_gross numeric NOT NULL DEFAULT 0,
  amount_discount numeric NOT NULL DEFAULT 0,
  amount_net numeric NOT NULL DEFAULT 0,
  amount_taxes numeric NOT NULL DEFAULT 0,
  amount_iss numeric NOT NULL DEFAULT 0,
  amount_icms numeric NOT NULL DEFAULT 0,
  amount_pis numeric NOT NULL DEFAULT 0,
  amount_cofins numeric NOT NULL DEFAULT 0,
  amount_irrf numeric NOT NULL DEFAULT 0,
  amount_csll numeric NOT NULL DEFAULT 0,
  amount_inss numeric NOT NULL DEFAULT 0,

  -- Vínculo com título financeiro (quando existir)
  linked_financial_entry_id uuid,

  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_documents_uniq
  ON public.fiscal_documents (company_id, source_endpoint, source_record_id)
  WHERE source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS fiscal_documents_company_competence
  ON public.fiscal_documents (company_id, competence_date);

CREATE INDEX IF NOT EXISTS fiscal_documents_company_doctype
  ON public.fiscal_documents (company_id, doc_type, competence_date);

CREATE INDEX IF NOT EXISTS fiscal_documents_chave
  ON public.fiscal_documents (company_id, chave_acesso) WHERE chave_acesso IS NOT NULL;

ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY fiscal_documents_select_member ON public.fiscal_documents
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));

CREATE POLICY fiscal_documents_modify_editor ON public.fiscal_documents
  FOR ALL TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

CREATE TRIGGER fiscal_documents_set_updated_at
  BEFORE UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- View: DRE por competência (baseada em notas fiscais)
-- ============================================================
-- Estrutura paralela a dre_base, mas usando a data de emissão fiscal
-- como critério de reconhecimento de receita (regime de competência).
-- Para despesas (custos / SG&A), continua usando dre_base, pois despesas
-- já são reconhecidas pela data de emissão do título no Omie.
CREATE OR REPLACE VIEW public.dre_competencia
WITH (security_invoker = true)
AS
-- 1) Receita reconhecida via NF emitida (substitui linhas de Receita Líquida)
SELECT
  fd.company_id,
  fd.competence_date,
  'Receita Líquida'::text AS dre_group,
  CASE WHEN fd.doc_type = 'nfse_emitida' THEN 'Receita de Serviços' ELSE 'Receita de Produtos' END AS dre_subgroup,
  CASE WHEN fd.doc_type = 'nfse_emitida' THEN 'Receita de Serviços' ELSE 'Receita de Produtos' END AS category_mapped,
  fd.customer_id,
  NULL::uuid AS supplier_id,
  NULL::uuid AS cost_center_id,
  fd.amount_net AS amount,
  fd.amount_net AS amount_signed,
  'fiscal'::text AS source_kind,
  fd.id AS source_id
FROM public.fiscal_documents fd
WHERE fd.status = 'autorizada'
  AND fd.doc_type IN ('nfe_emitida', 'nfse_emitida')

UNION ALL

-- 2) Deduções de Receita (impostos sobre vendas)
SELECT
  fd.company_id,
  fd.competence_date,
  'Deduções de Receita'::text AS dre_group,
  'Impostos sobre Vendas'::text AS dre_subgroup,
  'Impostos sobre Vendas'::text AS category_mapped,
  fd.customer_id,
  NULL::uuid,
  NULL::uuid,
  (fd.amount_iss + fd.amount_pis + fd.amount_cofins + fd.amount_icms),
  -1 * (fd.amount_iss + fd.amount_pis + fd.amount_cofins + fd.amount_icms),
  'fiscal'::text,
  fd.id
FROM public.fiscal_documents fd
WHERE fd.status = 'autorizada'
  AND fd.doc_type IN ('nfe_emitida', 'nfse_emitida')
  AND (fd.amount_iss + fd.amount_pis + fd.amount_cofins + fd.amount_icms) > 0

UNION ALL

-- 3) Custos / despesas (continua vindo de dre_base, mas excluindo as linhas de receita líquida
--    para não duplicar com a fonte fiscal acima)
SELECT
  d.company_id,
  d.competence_date,
  d.dre_group,
  d.dre_subgroup,
  d.category_mapped,
  d.customer_id,
  d.supplier_id,
  d.cost_center_id,
  d.amount,
  d.amount_signed,
  'managerial'::text,
  d.id
FROM public.dre_base d
WHERE d.dre_group <> 'Receita Líquida';

-- ============================================================
-- Função: snapshot de DRE por competência (resumo agregado)
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_dre_competencia(
  _company uuid,
  _from date,
  _to date
)
RETURNS TABLE (
  dre_group text,
  dre_subgroup text,
  amount_signed numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dre_group,
    COALESCE(dre_subgroup, '—') AS dre_subgroup,
    SUM(amount_signed)::numeric AS amount_signed
  FROM public.dre_competencia
  WHERE company_id = _company
    AND competence_date BETWEEN _from AND _to
    AND _company IN (SELECT public.current_user_companies())
  GROUP BY dre_group, COALESCE(dre_subgroup, '—')
  ORDER BY dre_group, dre_subgroup;
$$;

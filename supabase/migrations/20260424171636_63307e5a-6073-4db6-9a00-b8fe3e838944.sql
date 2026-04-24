-- Enums for commercial commitments
DO $$ BEGIN
  CREATE TYPE public.commitment_kind AS ENUM ('pedido_venda', 'ordem_compra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commitment_status AS ENUM ('aberto', 'parcial', 'faturado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.commercial_commitments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'omie',
  source_endpoint TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  imported_batch_id UUID,
  kind public.commitment_kind NOT NULL,
  direction public.entry_direction NOT NULL,
  status public.commitment_status NOT NULL DEFAULT 'aberto',
  issue_date DATE,
  expected_date DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_signed NUMERIC NOT NULL DEFAULT 0,
  customer_id UUID,
  supplier_id UUID,
  party_name TEXT,
  document_number TEXT,
  description TEXT,
  linked_financial_entry_id UUID,
  confidence_pct NUMERIC NOT NULL DEFAULT 80,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_commitments_unique_source
  ON public.commercial_commitments (company_id, source_endpoint, source_record_id);

CREATE INDEX IF NOT EXISTS commercial_commitments_company_expected
  ON public.commercial_commitments (company_id, expected_date);

CREATE INDEX IF NOT EXISTS commercial_commitments_company_kind_status
  ON public.commercial_commitments (company_id, kind, status);

CREATE INDEX IF NOT EXISTS commercial_commitments_linked_fe
  ON public.commercial_commitments (linked_financial_entry_id)
  WHERE linked_financial_entry_id IS NOT NULL;

ALTER TABLE public.commercial_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_commitments_select_member ON public.commercial_commitments;
CREATE POLICY commercial_commitments_select_member
  ON public.commercial_commitments FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));

DROP POLICY IF EXISTS commercial_commitments_modify_editor ON public.commercial_commitments;
CREATE POLICY commercial_commitments_modify_editor
  ON public.commercial_commitments FOR ALL TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

DROP TRIGGER IF EXISTS tg_commercial_commitments_updated_at ON public.commercial_commitments;
CREATE TRIGGER tg_commercial_commitments_updated_at
  BEFORE UPDATE ON public.commercial_commitments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Cash forecast extended view (financial_entries previstos + commitments abertos não vinculados)
CREATE OR REPLACE VIEW public.cash_forecast_extended AS
SELECT
  fe.company_id,
  COALESCE(fe.due_date, fe.competence_date) AS forecast_date,
  fe.amount,
  fe.amount_signed,
  fe.direction,
  100::NUMERIC AS confidence_pct,
  (fe.amount_signed * 1.0)::NUMERIC AS weighted_amount_signed,
  'financial_entry'::TEXT AS source_kind,
  fe.id AS source_id,
  fe.bank_account_id,
  fe.dfc_group,
  fe.dfc_subgroup,
  fe.category_mapped,
  fe.description,
  fe.document_number
FROM public.financial_entries fe
WHERE fe.status = 'previsto'
  AND COALESCE(fe.due_date, fe.competence_date) IS NOT NULL

UNION ALL

SELECT
  cc.company_id,
  cc.expected_date AS forecast_date,
  cc.amount,
  cc.amount_signed,
  cc.direction,
  cc.confidence_pct,
  (cc.amount_signed * cc.confidence_pct / 100.0)::NUMERIC AS weighted_amount_signed,
  cc.kind::TEXT AS source_kind,
  cc.id AS source_id,
  NULL::UUID AS bank_account_id,
  NULL::TEXT AS dfc_group,
  NULL::TEXT AS dfc_subgroup,
  NULL::TEXT AS category_mapped,
  cc.description,
  cc.document_number
FROM public.commercial_commitments cc
WHERE cc.status IN ('aberto', 'parcial')
  AND cc.linked_financial_entry_id IS NULL
  AND cc.expected_date IS NOT NULL;

-- Update compute_balance_projection to include open commitments in AR
CREATE OR REPLACE FUNCTION public.compute_balance_projection(_company uuid, _date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_caixa NUMERIC := 0;
  v_ar NUMERIC := 0;
  v_ar_commit NUMERIC := 0;
  v_ap NUMERIC := 0;
  v_ap_commit NUMERIC := 0;
  v_estoque NUMERIC := 0;
  v_imob NUMERIC := 0;
  v_emprestimos NUMERIC := 0;
  v_capital NUMERIC := 0;
  v_resultado NUMERIC := 0;
  v_outros_ativos NUMERIC := 0;
  v_outros_passivos NUMERIC := 0;
  v_snapshot_date DATE;
  v_snapshot_total NUMERIC;
BEGIN
  SELECT MAX(snapshot_date) INTO v_snapshot_date
    FROM public.bank_balances_snapshots
   WHERE company_id = _company AND snapshot_date <= _date;

  IF v_snapshot_date IS NOT NULL THEN
    SELECT COALESCE(SUM(s.balance), 0) INTO v_snapshot_total
      FROM (
        SELECT DISTINCT ON (bank_account_id) bank_account_id, balance, snapshot_date
        FROM public.bank_balances_snapshots
        WHERE company_id = _company AND snapshot_date <= _date
        ORDER BY bank_account_id, snapshot_date DESC
      ) s;
    v_caixa := v_snapshot_total;
    SELECT v_caixa + COALESCE(SUM(amount_signed),0) INTO v_caixa
      FROM public.dfc_realized_base
     WHERE company_id = _company AND cash_date > v_snapshot_date AND cash_date <= _date;
  ELSE
    SELECT COALESCE(SUM(amount),0) INTO v_caixa
      FROM public.initial_balances
     WHERE company_id = _company
       AND (LOWER(balance_type) LIKE '%caixa%' OR LOWER(balance_type) LIKE '%banco%')
       AND reference_date <= _date;
    SELECT v_caixa + COALESCE(SUM(amount_signed),0) INTO v_caixa
      FROM public.dfc_realized_base
     WHERE company_id = _company AND cash_date <= _date;
  END IF;

  -- AR/AP from financial titles
  SELECT COALESCE(SUM(amount - COALESCE(received_amount,0)),0) INTO v_ar
    FROM public.receivable_entries
   WHERE company_id = _company AND status <> 'realizado';

  SELECT COALESCE(SUM(amount - COALESCE(paid_amount,0)),0) INTO v_ap
    FROM public.payable_entries
   WHERE company_id = _company AND status <> 'realizado';

  -- AR/AP from open commercial commitments (weighted by confidence)
  SELECT COALESCE(SUM(amount * confidence_pct / 100.0), 0) INTO v_ar_commit
    FROM public.commercial_commitments
   WHERE company_id = _company
     AND kind = 'pedido_venda'
     AND status IN ('aberto','parcial')
     AND linked_financial_entry_id IS NULL;

  SELECT COALESCE(SUM(amount * confidence_pct / 100.0), 0) INTO v_ap_commit
    FROM public.commercial_commitments
   WHERE company_id = _company
     AND kind = 'ordem_compra'
     AND status IN ('aberto','parcial')
     AND linked_financial_entry_id IS NULL;

  v_ar := v_ar + v_ar_commit;
  v_ap := v_ap + v_ap_commit;

  SELECT COALESCE(SUM(amount),0) INTO v_estoque FROM public.initial_balances
   WHERE company_id = _company AND LOWER(balance_type) LIKE '%estoq%' AND reference_date <= _date;
  SELECT COALESCE(SUM(amount),0) INTO v_imob FROM public.initial_balances
   WHERE company_id = _company AND LOWER(balance_type) LIKE '%imob%' AND reference_date <= _date;
  SELECT COALESCE(SUM(amount),0) INTO v_emprestimos FROM public.initial_balances
   WHERE company_id = _company AND LOWER(balance_type) LIKE '%emprest%' AND reference_date <= _date;
  SELECT COALESCE(SUM(amount),0) INTO v_capital FROM public.initial_balances
   WHERE company_id = _company AND LOWER(balance_type) LIKE '%capital%' AND reference_date <= _date;
  SELECT COALESCE(SUM(amount),0) INTO v_outros_ativos FROM public.initial_balances
   WHERE company_id = _company AND LOWER(balance_type) LIKE '%outros_ativo%' AND reference_date <= _date;
  SELECT COALESCE(SUM(amount),0) INTO v_outros_passivos FROM public.initial_balances
   WHERE company_id = _company AND LOWER(balance_type) LIKE '%outros_passiv%' AND reference_date <= _date;

  SELECT COALESCE(SUM(
    CASE WHEN dre_group IN ('Receita Líquida','Outras Receitas') THEN amount_signed
         WHEN dre_group = 'Deduções de Receita' THEN -ABS(amount_signed)
         ELSE amount_signed END
  ),0) INTO v_resultado
    FROM public.dre_base
   WHERE company_id = _company AND competence_date <= _date;

  INSERT INTO public.balance_projection_daily (
    company_id, projection_date, snapshot_date,
    caixa, contas_receber, estoques, outros_ativos, imobilizado,
    fornecedores, obrigacoes_tributarias, obrigacoes_trabalhistas, emprestimos, outros_passivos,
    patrimonio_liquido, resultado_acumulado,
    capital_de_giro, divida_liquida, caixa_liquido
  ) VALUES (
    _company, _date, CURRENT_DATE,
    v_caixa, v_ar, v_estoque, v_outros_ativos, v_imob,
    v_ap, 0, 0, v_emprestimos, v_outros_passivos,
    v_capital + v_resultado, v_resultado,
    (v_caixa + v_ar + v_estoque) - (v_ap + v_emprestimos),
    v_emprestimos - v_caixa,
    v_caixa - v_emprestimos
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $function$;
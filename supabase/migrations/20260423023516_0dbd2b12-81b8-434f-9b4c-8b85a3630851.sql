
-- =============== sync_preferences ===============
CREATE TABLE IF NOT EXISTS public.sync_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  daily_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_sync_hour SMALLINT NOT NULL DEFAULT 6 CHECK (daily_sync_hour BETWEEN 0 AND 23),
  incremental_mode BOOLEAN NOT NULL DEFAULT true,
  lookback_days SMALLINT NOT NULL DEFAULT 7,
  log_retention_days SMALLINT NOT NULL DEFAULT 30,
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_preferences_select_member ON public.sync_preferences
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));

CREATE POLICY sync_preferences_modify_editor ON public.sync_preferences
  FOR ALL TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

CREATE TRIGGER sync_preferences_updated_at
  BEFORE UPDATE ON public.sync_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============== Indexes ===============
CREATE INDEX IF NOT EXISTS idx_fin_entries_company_classified
  ON public.financial_entries (company_id, is_classified, competence_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_entries_source
  ON public.financial_entries (company_id, source_endpoint, source_record_id);
CREATE INDEX IF NOT EXISTS idx_fin_entries_cash_date
  ON public.financial_entries (company_id, cash_date) WHERE cash_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_entries_due_date
  ON public.financial_entries (company_id, due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_payloads_batch
  ON public.omie_raw_payloads (batch_id, processed);
CREATE INDEX IF NOT EXISTS idx_raw_payloads_company_endpoint
  ON public.omie_raw_payloads (company_id, source_endpoint, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_payloads_dedup
  ON public.omie_raw_payloads (company_id, source_endpoint, source_record_id)
  WHERE source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sync_batches_company
  ON public.omie_raw_sync_batches (company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_company
  ON public.omie_sync_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_errors_company_open
  ON public.omie_sync_errors (company_id, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dre_base_company_period
  ON public.dre_base (company_id, competence_date, dre_group);
CREATE INDEX IF NOT EXISTS idx_dfc_realized_company_date
  ON public.dfc_realized_base (company_id, cash_date);
CREATE INDEX IF NOT EXISTS idx_dfc_forecast_company_date
  ON public.dfc_forecast_base (company_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_payable_company_due
  ON public.payable_entries (company_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_receivable_company_due
  ON public.receivable_entries (company_id, due_date, status);

-- =============== View: unclassified queue ===============
CREATE OR REPLACE VIEW public.v_unclassified_queue
WITH (security_invoker = true)
AS
  SELECT
    fe.id,
    fe.company_id,
    fe.competence_date,
    fe.due_date,
    fe.cash_date,
    fe.amount_signed,
    fe.direction,
    fe.description,
    fe.category_raw,
    fe.customer_name,
    fe.supplier_name,
    fe.source_endpoint,
    fe.source_record_id,
    fe.created_at
  FROM public.financial_entries fe
  WHERE fe.is_classified = false;

-- =============== classify_financial_entry ===============
CREATE OR REPLACE FUNCTION public.classify_financial_entry(_entry_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_map RECORD;
BEGIN
  SELECT * INTO v_entry FROM public.financial_entries WHERE id = _entry_id;
  IF NOT FOUND OR v_entry.category_raw IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
    INTO v_map
    FROM public.category_mapping
   WHERE company_id = v_entry.company_id
     AND active = true
     AND (
       omie_category_code = v_entry.category_raw
       OR LOWER(COALESCE(omie_category_description,'')) = LOWER(COALESCE(v_entry.category_raw,''))
     )
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.financial_entries SET
    category_mapped = COALESCE(v_map.dre_category, v_map.dfc_category, v_map.managerial_group_1),
    dre_group = v_map.dre_category,
    dre_subgroup = v_map.dre_subcategory,
    dfc_group = v_map.dfc_category,
    dfc_subgroup = v_map.dfc_subcategory,
    flow_type = v_map.flow_type,
    affects_dre = v_map.affects_dre,
    affects_cash = v_map.affects_cash,
    affects_balance = v_map.affects_balance,
    is_classified = true,
    updated_at = now()
  WHERE id = _entry_id;

  -- Push to dre_base
  IF v_map.affects_dre AND v_map.dre_category IS NOT NULL THEN
    INSERT INTO public.dre_base (
      company_id, source_entry_id, reference_date, competence_date,
      dre_group, dre_subgroup, category_mapped,
      cost_center_id, customer_id, supplier_id,
      amount, amount_signed
    ) VALUES (
      v_entry.company_id, v_entry.id, COALESCE(v_entry.reference_date, v_entry.competence_date), v_entry.competence_date,
      v_map.dre_category, v_map.dre_subcategory, v_map.dre_category,
      v_entry.cost_center_id, v_entry.customer_id, v_entry.supplier_id,
      v_entry.amount, v_entry.amount_signed
    );
  END IF;

  -- Push to dfc_realized_base if cash_date present
  IF v_map.affects_cash AND v_entry.cash_date IS NOT NULL AND v_map.dfc_category IS NOT NULL THEN
    INSERT INTO public.dfc_realized_base (
      company_id, source_entry_id, cash_date, bank_account_id,
      dfc_group, dfc_subgroup, flow_type, category_mapped,
      amount, amount_signed
    ) VALUES (
      v_entry.company_id, v_entry.id, v_entry.cash_date, v_entry.bank_account_id,
      v_map.dfc_category, v_map.dfc_subcategory, COALESCE(v_map.flow_type,'operacional'::flow_type), v_map.dfc_category,
      v_entry.amount, v_entry.amount_signed
    );
  END IF;

  -- Push to dfc_forecast_base if no cash_date but due_date present
  IF v_map.affects_cash AND v_entry.cash_date IS NULL AND v_entry.due_date IS NOT NULL AND v_map.dfc_category IS NOT NULL THEN
    INSERT INTO public.dfc_forecast_base (
      company_id, source_entry_id, forecast_date, bank_account_id,
      dfc_group, dfc_subgroup, flow_type, category_mapped,
      amount, amount_signed, confidence_pct
    ) VALUES (
      v_entry.company_id, v_entry.id, v_entry.due_date, v_entry.bank_account_id,
      v_map.dfc_category, v_map.dfc_subcategory, COALESCE(v_map.flow_type,'operacional'::flow_type), v_map.dfc_category,
      v_entry.amount, v_entry.amount_signed, 90
    );
  END IF;

  RETURN true;
END $$;

-- =============== reclassify_company ===============
CREATE OR REPLACE FUNCTION public.reclassify_company(_company UUID, _only_unclassified BOOLEAN DEFAULT true)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.financial_entries
     WHERE company_id = _company
       AND (NOT _only_unclassified OR is_classified = false)
  LOOP
    IF public.classify_financial_entry(v_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

-- =============== run_full_pipeline ===============
CREATE OR REPLACE FUNCTION public.run_full_pipeline(_company UUID, _date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_classified INTEGER;
  v_snapshot UUID;
BEGIN
  v_classified := public.reclassify_company(_company, true);
  v_snapshot := public.snapshot_kpis(_company, _date);
  RETURN jsonb_build_object(
    'classified_entries', v_classified,
    'kpi_snapshot_id', v_snapshot,
    'date', _date
  );
END $$;

-- Unique constraint on dashboard_kpi_snapshots (required by snapshot_kpis ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dashboard_kpi_snapshot
  ON public.dashboard_kpi_snapshots (company_id, snapshot_date);

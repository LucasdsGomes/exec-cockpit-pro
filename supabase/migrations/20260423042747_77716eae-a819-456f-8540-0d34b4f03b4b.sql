-- ============ ETAPA A: Mirror payables/receivables ============
CREATE OR REPLACE FUNCTION public.mirror_payables_receivables(_company uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Receivables (entrada)
  INSERT INTO public.receivable_entries (
    company_id, financial_entry_id, source_record_id, customer_id, customer_name,
    document_number, due_date, cash_date, amount, received_amount,
    status, category_mapped, cost_center_id, synced_at
  )
  SELECT
    fe.company_id, fe.id, fe.source_record_id, fe.customer_id, fe.customer_name,
    fe.document_number, COALESCE(fe.due_date, fe.competence_date), fe.cash_date,
    fe.amount,
    CASE WHEN fe.cash_date IS NOT NULL THEN fe.amount ELSE 0 END,
    CASE WHEN fe.cash_date IS NOT NULL THEN 'realizado'::entry_status ELSE 'previsto'::entry_status END,
    fe.category_mapped, fe.cost_center_id, now()
  FROM public.financial_entries fe
  WHERE fe.company_id = _company
    AND fe.direction = 'entrada'
    AND COALESCE(fe.due_date, fe.competence_date) IS NOT NULL
    AND fe.source_record_id IS NOT NULL
  ON CONFLICT (company_id, source_record_id) WHERE source_record_id IS NOT NULL
  DO UPDATE SET
    due_date = EXCLUDED.due_date,
    cash_date = EXCLUDED.cash_date,
    amount = EXCLUDED.amount,
    received_amount = EXCLUDED.received_amount,
    status = EXCLUDED.status,
    category_mapped = EXCLUDED.category_mapped,
    customer_name = EXCLUDED.customer_name,
    synced_at = now(),
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Payables (saida)
  INSERT INTO public.payable_entries (
    company_id, financial_entry_id, source_record_id, supplier_id, supplier_name,
    document_number, due_date, cash_date, amount, paid_amount,
    status, category_mapped, cost_center_id, synced_at
  )
  SELECT
    fe.company_id, fe.id, fe.source_record_id, fe.supplier_id, fe.supplier_name,
    fe.document_number, COALESCE(fe.due_date, fe.competence_date), fe.cash_date,
    fe.amount,
    CASE WHEN fe.cash_date IS NOT NULL THEN fe.amount ELSE 0 END,
    CASE WHEN fe.cash_date IS NOT NULL THEN 'realizado'::entry_status ELSE 'previsto'::entry_status END,
    fe.category_mapped, fe.cost_center_id, now()
  FROM public.financial_entries fe
  WHERE fe.company_id = _company
    AND fe.direction = 'saida'
    AND COALESCE(fe.due_date, fe.competence_date) IS NOT NULL
    AND fe.source_record_id IS NOT NULL
  ON CONFLICT (company_id, source_record_id) WHERE source_record_id IS NOT NULL
  DO UPDATE SET
    due_date = EXCLUDED.due_date,
    cash_date = EXCLUDED.cash_date,
    amount = EXCLUDED.amount,
    paid_amount = EXCLUDED.paid_amount,
    status = EXCLUDED.status,
    category_mapped = EXCLUDED.category_mapped,
    supplier_name = EXCLUDED.supplier_name,
    synced_at = now(),
    updated_at = now();

  RETURN v_count;
END $$;

-- Unique indexes for upsert
CREATE UNIQUE INDEX IF NOT EXISTS receivable_entries_company_source_uq
  ON public.receivable_entries (company_id, source_record_id)
  WHERE source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payable_entries_company_source_uq
  ON public.payable_entries (company_id, source_record_id)
  WHERE source_record_id IS NOT NULL;

-- Trigger function for single-entry mirror
CREATE OR REPLACE FUNCTION public.tg_mirror_ap_ar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_record_id IS NULL OR COALESCE(NEW.due_date, NEW.competence_date) IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.direction = 'entrada' THEN
    INSERT INTO public.receivable_entries (
      company_id, financial_entry_id, source_record_id, customer_id, customer_name,
      document_number, due_date, cash_date, amount, received_amount,
      status, category_mapped, cost_center_id, synced_at
    ) VALUES (
      NEW.company_id, NEW.id, NEW.source_record_id, NEW.customer_id, NEW.customer_name,
      NEW.document_number, COALESCE(NEW.due_date, NEW.competence_date), NEW.cash_date,
      NEW.amount,
      CASE WHEN NEW.cash_date IS NOT NULL THEN NEW.amount ELSE 0 END,
      CASE WHEN NEW.cash_date IS NOT NULL THEN 'realizado'::entry_status ELSE 'previsto'::entry_status END,
      NEW.category_mapped, NEW.cost_center_id, now()
    )
    ON CONFLICT (company_id, source_record_id) WHERE source_record_id IS NOT NULL
    DO UPDATE SET
      due_date = EXCLUDED.due_date, cash_date = EXCLUDED.cash_date,
      amount = EXCLUDED.amount, received_amount = EXCLUDED.received_amount,
      status = EXCLUDED.status, category_mapped = EXCLUDED.category_mapped,
      customer_name = EXCLUDED.customer_name, synced_at = now(), updated_at = now();
  ELSIF NEW.direction = 'saida' THEN
    INSERT INTO public.payable_entries (
      company_id, financial_entry_id, source_record_id, supplier_id, supplier_name,
      document_number, due_date, cash_date, amount, paid_amount,
      status, category_mapped, cost_center_id, synced_at
    ) VALUES (
      NEW.company_id, NEW.id, NEW.source_record_id, NEW.supplier_id, NEW.supplier_name,
      NEW.document_number, COALESCE(NEW.due_date, NEW.competence_date), NEW.cash_date,
      NEW.amount,
      CASE WHEN NEW.cash_date IS NOT NULL THEN NEW.amount ELSE 0 END,
      CASE WHEN NEW.cash_date IS NOT NULL THEN 'realizado'::entry_status ELSE 'previsto'::entry_status END,
      NEW.category_mapped, NEW.cost_center_id, now()
    )
    ON CONFLICT (company_id, source_record_id) WHERE source_record_id IS NOT NULL
    DO UPDATE SET
      due_date = EXCLUDED.due_date, cash_date = EXCLUDED.cash_date,
      amount = EXCLUDED.amount, paid_amount = EXCLUDED.paid_amount,
      status = EXCLUDED.status, category_mapped = EXCLUDED.category_mapped,
      supplier_name = EXCLUDED.supplier_name, synced_at = now(), updated_at = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_mirror_ap_ar ON public.financial_entries;
CREATE TRIGGER tg_mirror_ap_ar
  AFTER INSERT OR UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_mirror_ap_ar();

-- Backfill all active companies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies WHERE active = true LOOP
    PERFORM public.mirror_payables_receivables(r.id);
  END LOOP;
END $$;

-- Update daily pipeline to include mirror
CREATE OR REPLACE FUNCTION public.run_daily_pipeline_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company RECORD;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
BEGIN
  FOR v_company IN SELECT id, name FROM public.companies WHERE active = true LOOP
    BEGIN
      PERFORM public.mirror_payables_receivables(v_company.id);
      v_one := public.run_full_pipeline(v_company.id, CURRENT_DATE);
      PERFORM public.compute_balance_projection(v_company.id, CURRENT_DATE);
      v_results := v_results || jsonb_build_object('company', v_company.name, 'ok', true, 'detail', v_one);
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('company', v_company.name, 'ok', false, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN v_results;
END $$;

-- ============ ETAPA B: Default alert rules ============
CREATE UNIQUE INDEX IF NOT EXISTS alert_rules_company_metric_uq
  ON public.alert_rules (company_id, metric);

INSERT INTO public.alert_rules (company_id, rule_name, metric, comparator, threshold, severity, active)
SELECT c.id, 'Caixa mínimo', 'caixa_minimo', '<', 50000, 'warning', true FROM public.companies c WHERE c.active = true
ON CONFLICT (company_id, metric) DO NOTHING;

INSERT INTO public.alert_rules (company_id, rule_name, metric, comparator, threshold, severity, active)
SELECT c.id, 'Entradas não classificadas', 'entradas_nao_classificadas', '>', 0, 'info', true FROM public.companies c WHERE c.active = true
ON CONFLICT (company_id, metric) DO NOTHING;

INSERT INTO public.alert_rules (company_id, rule_name, metric, comparator, threshold, severity, active)
SELECT c.id, 'Contas vencendo em 7 dias', 'contas_vencendo_7d', '>', 0, 'warning', true FROM public.companies c WHERE c.active = true
ON CONFLICT (company_id, metric) DO NOTHING;

INSERT INTO public.alert_rules (company_id, rule_name, metric, comparator, threshold, severity, active)
SELECT c.id, 'Ciclo financeiro elevado', 'ciclo_financeiro', '>', 60, 'info', true FROM public.companies c WHERE c.active = true
ON CONFLICT (company_id, metric) DO NOTHING;

-- ============ ETAPA C: System health RPC ============
CREATE OR REPLACE FUNCTION public.system_health(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (_company IN (SELECT public.current_user_companies())) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'counts', jsonb_build_object(
      'financial_entries', (SELECT COUNT(*) FROM public.financial_entries WHERE company_id = _company),
      'unclassified', (SELECT COUNT(*) FROM public.financial_entries WHERE company_id = _company AND is_classified = false),
      'payable_entries', (SELECT COUNT(*) FROM public.payable_entries WHERE company_id = _company),
      'receivable_entries', (SELECT COUNT(*) FROM public.receivable_entries WHERE company_id = _company),
      'dre_base', (SELECT COUNT(*) FROM public.dre_base WHERE company_id = _company),
      'dfc_realized_base', (SELECT COUNT(*) FROM public.dfc_realized_base WHERE company_id = _company),
      'dfc_forecast_base', (SELECT COUNT(*) FROM public.dfc_forecast_base WHERE company_id = _company),
      'balance_projection_daily', (SELECT COUNT(*) FROM public.balance_projection_daily WHERE company_id = _company),
      'initial_balances', (SELECT COUNT(*) FROM public.initial_balances WHERE company_id = _company),
      'category_mapping', (SELECT COUNT(*) FROM public.category_mapping WHERE company_id = _company AND active = true),
      'alert_rules_active', (SELECT COUNT(*) FROM public.alert_rules WHERE company_id = _company AND active = true)
    ),
    'last_sync_at', (SELECT MAX(synced_at) FROM public.financial_entries WHERE company_id = _company),
    'last_sync_batch', (SELECT row_to_json(b) FROM (
      SELECT source_endpoint, status, started_at, finished_at, processed_records, total_records
      FROM public.omie_raw_sync_batches WHERE company_id = _company
      ORDER BY started_at DESC LIMIT 1
    ) b),
    'last_kpi_snapshot', (SELECT MAX(snapshot_date) FROM public.dashboard_kpi_snapshots WHERE company_id = _company),
    'last_balance_projection', (SELECT MAX(projection_date) FROM public.balance_projection_daily WHERE company_id = _company),
    'unmapped_categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('category_raw', cr, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT category_raw AS cr, COUNT(*) AS cnt
        FROM public.financial_entries
        WHERE company_id = _company AND is_classified = false AND category_raw IS NOT NULL
        GROUP BY category_raw
        LIMIT 50
      ) sub
    )
  ) INTO v_result;
  RETURN v_result;
END $$;

-- ============ ETAPA D: List cron jobs RPC ============
CREATE OR REPLACE FUNCTION public.list_cron_jobs()
RETURNS TABLE(jobname text, schedule text, command text, active boolean, last_status text, last_run timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  RETURN QUERY
  SELECT j.jobname::text, j.schedule::text, j.command::text, j.active,
    (SELECT r.status::text FROM cron.job_run_details r WHERE r.jobid = j.jobid ORDER BY r.start_time DESC LIMIT 1),
    (SELECT r.start_time FROM cron.job_run_details r WHERE r.jobid = j.jobid ORDER BY r.start_time DESC LIMIT 1)
  FROM cron.job j
  ORDER BY j.jobname;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END $$;
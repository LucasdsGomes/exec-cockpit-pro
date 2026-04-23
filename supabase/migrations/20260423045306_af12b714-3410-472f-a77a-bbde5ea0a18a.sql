-- Cost center assignment rules
CREATE TABLE IF NOT EXISTS public.cost_center_assign_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  match_type text NOT NULL CHECK (match_type IN ('category', 'supplier', 'customer', 'description')),
  match_pattern text NOT NULL,
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccar_company_active ON public.cost_center_assign_rules(company_id, active, priority);

ALTER TABLE public.cost_center_assign_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccar_select_member ON public.cost_center_assign_rules
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));

CREATE POLICY ccar_modify_editor ON public.cost_center_assign_rules
  FOR ALL TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

-- Apply rules: fill cost_center_id where NULL, in priority order
CREATE OR REPLACE FUNCTION public.apply_cost_center_rules(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_entries integer := 0;
  v_dre integer := 0;
  v_total_entries integer := 0;
  v_total_dre integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.cost_center_assign_rules
    WHERE company_id = _company AND active = true
    ORDER BY priority ASC, created_at ASC
  LOOP
    -- Update financial_entries where cost_center_id IS NULL and matches
    IF r.match_type = 'category' THEN
      UPDATE public.financial_entries
      SET cost_center_id = r.cost_center_id, updated_at = now()
      WHERE company_id = _company
        AND cost_center_id IS NULL
        AND (category_raw ILIKE r.match_pattern OR category_mapped ILIKE r.match_pattern);
      GET DIAGNOSTICS v_entries = ROW_COUNT;

      UPDATE public.dre_base
      SET cost_center_id = r.cost_center_id
      WHERE company_id = _company
        AND cost_center_id IS NULL
        AND category_mapped ILIKE r.match_pattern;
      GET DIAGNOSTICS v_dre = ROW_COUNT;

    ELSIF r.match_type = 'supplier' THEN
      UPDATE public.financial_entries fe
      SET cost_center_id = r.cost_center_id, updated_at = now()
      WHERE fe.company_id = _company
        AND fe.cost_center_id IS NULL
        AND (
          fe.supplier_name ILIKE r.match_pattern
          OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = fe.supplier_id AND s.name ILIKE r.match_pattern)
        );
      GET DIAGNOSTICS v_entries = ROW_COUNT;

      UPDATE public.dre_base d
      SET cost_center_id = r.cost_center_id
      WHERE d.company_id = _company
        AND d.cost_center_id IS NULL
        AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = d.supplier_id AND s.name ILIKE r.match_pattern);
      GET DIAGNOSTICS v_dre = ROW_COUNT;

    ELSIF r.match_type = 'customer' THEN
      UPDATE public.financial_entries fe
      SET cost_center_id = r.cost_center_id, updated_at = now()
      WHERE fe.company_id = _company
        AND fe.cost_center_id IS NULL
        AND (
          fe.customer_name ILIKE r.match_pattern
          OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = fe.customer_id AND c.name ILIKE r.match_pattern)
        );
      GET DIAGNOSTICS v_entries = ROW_COUNT;

      UPDATE public.dre_base d
      SET cost_center_id = r.cost_center_id
      WHERE d.company_id = _company
        AND d.cost_center_id IS NULL
        AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = d.customer_id AND c.name ILIKE r.match_pattern);
      GET DIAGNOSTICS v_dre = ROW_COUNT;

    ELSIF r.match_type = 'description' THEN
      UPDATE public.financial_entries
      SET cost_center_id = r.cost_center_id, updated_at = now()
      WHERE company_id = _company
        AND cost_center_id IS NULL
        AND description ILIKE r.match_pattern;
      GET DIAGNOSTICS v_entries = ROW_COUNT;
    ELSE
      v_entries := 0;
      v_dre := 0;
    END IF;

    v_total_entries := v_total_entries + COALESCE(v_entries, 0);
    v_total_dre := v_total_dre + COALESCE(v_dre, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'entries_updated', v_total_entries,
    'dre_updated', v_total_dre
  );
END;
$$;

-- Reconcile bank_movements with financial_entries by amount/date/account
CREATE OR REPLACE FUNCTION public.reconcile_bank_movements(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      bm.id AS bm_id,
      fe.id AS fe_id,
      ROW_NUMBER() OVER (
        PARTITION BY bm.id
        ORDER BY ABS(EXTRACT(EPOCH FROM (bm.movement_date::timestamp - COALESCE(fe.cash_date, fe.due_date)::timestamp)))
      ) AS rn
    FROM public.bank_movements bm
    JOIN public.financial_entries fe
      ON fe.company_id = bm.company_id
     AND fe.bank_account_id = bm.bank_account_id
     AND fe.direction = bm.direction
     AND fe.amount = bm.amount
     AND COALESCE(fe.cash_date, fe.due_date) BETWEEN bm.movement_date - INTERVAL '2 days'
                                                 AND bm.movement_date + INTERVAL '2 days'
    WHERE bm.company_id = _company
      AND bm.financial_entry_id IS NULL
  )
  UPDATE public.bank_movements bm
  SET financial_entry_id = c.fe_id,
      reconciled = true,
      updated_at = now()
  FROM candidates c
  WHERE c.rn = 1 AND bm.id = c.bm_id;
  GET DIAGNOSTICS v_matched = ROW_COUNT;

  RETURN jsonb_build_object('matched', v_matched);
END;
$$;

-- Update run_daily_pipeline_all to also apply CC rules
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
  v_cc jsonb;
  v_rec jsonb;
BEGIN
  FOR v_company IN SELECT id, name FROM public.companies WHERE active = true LOOP
    BEGIN
      PERFORM public.mirror_payables_receivables(v_company.id);
      v_cc := public.apply_cost_center_rules(v_company.id);
      v_rec := public.reconcile_bank_movements(v_company.id);
      v_one := public.run_full_pipeline(v_company.id, CURRENT_DATE);
      PERFORM public.compute_balance_projection(v_company.id, CURRENT_DATE);
      v_results := v_results || jsonb_build_object(
        'company', v_company.name,
        'ok', true,
        'detail', v_one,
        'cost_center', v_cc,
        'reconcile', v_rec
      );
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('company', v_company.name, 'ok', false, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN v_results;
END;
$$;
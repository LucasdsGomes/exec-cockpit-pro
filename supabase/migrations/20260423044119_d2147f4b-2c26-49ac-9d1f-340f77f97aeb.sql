
-- =========================================================================
-- Backfill: enrich financial_entries + downstream tables with FK references
-- (bank_account_id, supplier_id/customer_id) extracted from omie_raw_payloads.
-- Also add a bank_movement → dfc_realized mirror trigger for the Realized view.
-- =========================================================================

-- 1. Reprocess raw OMIE payloads → fill financial_entries.metadata with the
--    individual record JSON, plus resolve bank_account_id / supplier / customer.
CREATE OR REPLACE FUNCTION public.reprocess_raw_payloads(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated INTEGER := 0;
  v_iter INTEGER := 0;
  rec RECORD;
  item JSONB;
  v_src TEXT;
  v_bank_src TEXT;
  v_party_src TEXT;
  v_bank_id UUID;
  v_party_id UUID;
  v_endpoint TEXT;
  v_array_key TEXT;
BEGIN
  IF NOT (_company IN (SELECT public.current_user_companies())) AND NOT public.is_company_admin(_company) THEN
    -- allow service role (auth.uid() is null) to run
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  FOR rec IN
    SELECT id, source_endpoint, payload
    FROM public.omie_raw_payloads
    WHERE company_id = _company
      AND source_endpoint IN ('financas/contapagar','financas/contareceber')
  LOOP
    v_endpoint := rec.source_endpoint;
    v_array_key := CASE v_endpoint
      WHEN 'financas/contapagar' THEN 'conta_pagar_cadastro'
      WHEN 'financas/contareceber' THEN 'conta_receber_cadastro'
      ELSE NULL END;
    IF v_array_key IS NULL THEN CONTINUE; END IF;

    FOR item IN SELECT jsonb_array_elements(COALESCE(rec.payload->v_array_key,'[]'::jsonb))
    LOOP
      v_src := COALESCE(item->>'codigo_lancamento_omie', item->>'codigo_lancamento_integracao');
      IF v_src IS NULL OR v_src = '' THEN CONTINUE; END IF;

      v_bank_src := NULLIF(item->>'id_conta_corrente','');
      v_party_src := NULLIF(item->>'codigo_cliente_fornecedor','');

      v_bank_id := NULL;
      v_party_id := NULL;

      IF v_bank_src IS NOT NULL THEN
        SELECT id INTO v_bank_id FROM public.bank_accounts
         WHERE company_id = _company AND source_record_id = v_bank_src LIMIT 1;
      END IF;

      IF v_party_src IS NOT NULL THEN
        IF v_endpoint = 'financas/contapagar' THEN
          SELECT id INTO v_party_id FROM public.suppliers
           WHERE company_id = _company AND source_record_id = v_party_src LIMIT 1;
        ELSE
          SELECT id INTO v_party_id FROM public.customers
           WHERE company_id = _company AND source_record_id = v_party_src LIMIT 1;
        END IF;
      END IF;

      UPDATE public.financial_entries fe SET
        metadata = item,
        bank_account_id = COALESCE(v_bank_id, fe.bank_account_id),
        supplier_id = CASE WHEN v_endpoint = 'financas/contapagar'
                           THEN COALESCE(v_party_id, fe.supplier_id)
                           ELSE fe.supplier_id END,
        customer_id = CASE WHEN v_endpoint = 'financas/contareceber'
                           THEN COALESCE(v_party_id, fe.customer_id)
                           ELSE fe.customer_id END,
        updated_at = now()
      WHERE fe.company_id = _company
        AND fe.source_endpoint = v_endpoint
        AND fe.source_record_id = v_src;

      IF FOUND THEN v_updated := v_updated + 1; END IF;
    END LOOP;
    v_iter := v_iter + 1;
  END LOOP;

  RETURN jsonb_build_object('payloads_processed', v_iter, 'entries_updated', v_updated);
END $function$;

-- 2. Propagate FKs from financial_entries → all downstream tables
CREATE OR REPLACE FUNCTION public.propagate_entry_refs(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dre INT := 0;
  v_real INT := 0;
  v_fcst INT := 0;
  v_pay INT := 0;
  v_rec INT := 0;
BEGIN
  -- dre_base
  UPDATE public.dre_base d SET
    cost_center_id = COALESCE(d.cost_center_id, fe.cost_center_id),
    customer_id    = COALESCE(d.customer_id, fe.customer_id),
    supplier_id    = COALESCE(d.supplier_id, fe.supplier_id),
    business_unit  = COALESCE(d.business_unit, cc.business_unit),
    department     = COALESCE(d.department, cc.department)
  FROM public.financial_entries fe
  LEFT JOIN public.cost_centers cc ON cc.id = fe.cost_center_id
  WHERE d.source_entry_id = fe.id AND d.company_id = _company;
  GET DIAGNOSTICS v_dre = ROW_COUNT;

  -- dfc_realized_base
  UPDATE public.dfc_realized_base r SET
    bank_account_id = COALESCE(r.bank_account_id, fe.bank_account_id)
  FROM public.financial_entries fe
  WHERE r.source_entry_id = fe.id AND r.company_id = _company;
  GET DIAGNOSTICS v_real = ROW_COUNT;

  -- dfc_forecast_base
  UPDATE public.dfc_forecast_base f SET
    bank_account_id = COALESCE(f.bank_account_id, fe.bank_account_id)
  FROM public.financial_entries fe
  WHERE f.source_entry_id = fe.id AND f.company_id = _company;
  GET DIAGNOSTICS v_fcst = ROW_COUNT;

  -- payable_entries
  UPDATE public.payable_entries p SET
    supplier_id = COALESCE(p.supplier_id, fe.supplier_id),
    cost_center_id = COALESCE(p.cost_center_id, fe.cost_center_id)
  FROM public.financial_entries fe
  WHERE p.financial_entry_id = fe.id AND p.company_id = _company;
  GET DIAGNOSTICS v_pay = ROW_COUNT;

  -- receivable_entries
  UPDATE public.receivable_entries q SET
    customer_id = COALESCE(q.customer_id, fe.customer_id),
    cost_center_id = COALESCE(q.cost_center_id, fe.cost_center_id)
  FROM public.financial_entries fe
  WHERE q.financial_entry_id = fe.id AND q.company_id = _company;
  GET DIAGNOSTICS v_rec = ROW_COUNT;

  RETURN jsonb_build_object(
    'dre_base', v_dre,
    'dfc_realized_base', v_real,
    'dfc_forecast_base', v_fcst,
    'payable_entries', v_pay,
    'receivable_entries', v_rec
  );
END $function$;

-- 3. Combined backfill helper to expose as a single Admin button
CREATE OR REPLACE FUNCTION public.backfill_company_refs(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_a JSONB;
  v_b JSONB;
BEGIN
  v_a := public.reprocess_raw_payloads(_company);
  v_b := public.propagate_entry_refs(_company);
  RETURN jsonb_build_object('reprocess', v_a, 'propagate', v_b);
END $function$;

-- 4. Update classify_financial_entry to also push bank_account_id & business_unit
CREATE OR REPLACE FUNCTION public.classify_financial_entry(_entry_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry RECORD;
  v_map RECORD;
  v_cc RECORD;
BEGIN
  SELECT * INTO v_entry FROM public.financial_entries WHERE id = _entry_id;
  IF NOT FOUND OR v_entry.category_raw IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_map
    FROM public.category_mapping
   WHERE company_id = v_entry.company_id AND active = true
     AND (omie_category_code = v_entry.category_raw
          OR LOWER(COALESCE(omie_category_description,'')) = LOWER(COALESCE(v_entry.category_raw,'')))
   LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT business_unit, department INTO v_cc
    FROM public.cost_centers WHERE id = v_entry.cost_center_id;

  UPDATE public.financial_entries SET
    category_mapped = COALESCE(v_map.dre_category, v_map.dfc_category, v_map.managerial_group_1),
    dre_group = v_map.dre_category, dre_subgroup = v_map.dre_subcategory,
    dfc_group = v_map.dfc_category, dfc_subgroup = v_map.dfc_subcategory,
    flow_type = v_map.flow_type,
    affects_dre = v_map.affects_dre, affects_cash = v_map.affects_cash, affects_balance = v_map.affects_balance,
    is_classified = true, updated_at = now()
  WHERE id = _entry_id;

  IF v_map.affects_dre AND v_map.dre_category IS NOT NULL THEN
    INSERT INTO public.dre_base (
      company_id, source_entry_id, reference_date, competence_date,
      dre_group, dre_subgroup, category_mapped,
      cost_center_id, customer_id, supplier_id, business_unit, department,
      amount, amount_signed
    ) VALUES (
      v_entry.company_id, v_entry.id, COALESCE(v_entry.reference_date, v_entry.competence_date), v_entry.competence_date,
      v_map.dre_category, v_map.dre_subcategory, v_map.dre_category,
      v_entry.cost_center_id, v_entry.customer_id, v_entry.supplier_id,
      v_cc.business_unit, v_cc.department,
      v_entry.amount, v_entry.amount_signed
    );
  END IF;

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
END $function$;

-- 5. Trigger: bank_movements → dfc_realized_base mirror (enables Realizado view)
CREATE OR REPLACE FUNCTION public.tg_mirror_bank_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_signed NUMERIC;
BEGIN
  v_signed := CASE WHEN NEW.direction = 'entrada' THEN ABS(NEW.amount) ELSE -ABS(NEW.amount) END;
  INSERT INTO public.dfc_realized_base (
    company_id, source_entry_id, cash_date, bank_account_id,
    dfc_group, dfc_subgroup, flow_type, category_mapped, amount, amount_signed
  ) VALUES (
    NEW.company_id, NEW.financial_entry_id, NEW.movement_date, NEW.bank_account_id,
    'Movimentação Bancária', NULL, 'operacional'::flow_type, COALESCE(NEW.description,'Movimentação'),
    ABS(NEW.amount), v_signed
  );
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS bank_movements_mirror ON public.bank_movements;
CREATE TRIGGER bank_movements_mirror
AFTER INSERT ON public.bank_movements
FOR EACH ROW EXECUTE FUNCTION public.tg_mirror_bank_movement();

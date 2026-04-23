-- 1. Seed initial_balances rows from active bank accounts (zeroed, ready to fill)
CREATE OR REPLACE FUNCTION public.seed_initial_balances_from_bank_accounts(_company uuid, _reference_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INT := 0;
  rec RECORD;
BEGIN
  IF NOT (_company IN (SELECT public.current_user_companies())) AND NOT public.is_company_admin(_company) THEN
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  FOR rec IN
    SELECT ba.id, ba.name, ba.bank_name
    FROM public.bank_accounts ba
    WHERE ba.company_id = _company AND ba.active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.initial_balances ib
        WHERE ib.company_id = _company
          AND ib.bank_account_id = ba.id
      )
  LOOP
    INSERT INTO public.initial_balances (
      company_id, bank_account_id, account_label, balance_type, amount, reference_date
    ) VALUES (
      _company, rec.id, COALESCE(rec.bank_name || ' · ', '') || rec.name, 'caixa_banco', 0, _reference_date
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'reference_date', _reference_date);
END $$;

-- 2. Extend reprocess_raw_payloads to also set cash_date when payload carries data_pagamento
CREATE OR REPLACE FUNCTION public.reprocess_raw_payloads(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_iter INTEGER := 0;
  v_with_cash INTEGER := 0;
  rec RECORD;
  item JSONB;
  v_src TEXT;
  v_bank_src TEXT;
  v_party_src TEXT;
  v_bank_id UUID;
  v_party_id UUID;
  v_cash_str TEXT;
  v_cash DATE;
  v_endpoint TEXT;
  v_array_key TEXT;
BEGIN
  IF NOT (_company IN (SELECT public.current_user_companies())) AND NOT public.is_company_admin(_company) THEN
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
      v_src := COALESCE(item->'cabecTitulo'->>'codigo_lancamento_omie', item->>'codigo_lancamento_omie', item->'cabecTitulo'->>'codigo_lancamento_integracao');
      IF v_src IS NULL OR v_src = '' THEN CONTINUE; END IF;

      v_bank_src := NULLIF(COALESCE(item->'cabecTitulo'->>'id_conta_corrente', item->'detalhesTitulo'->>'id_conta_corrente'),'');
      v_party_src := NULLIF(item->'cabecTitulo'->>'codigo_cliente_fornecedor','');
      v_cash_str := NULLIF(COALESCE(item->'detalhesTitulo'->>'data_pagamento', item->'cabecTitulo'->>'data_pagamento'),'');

      v_cash := NULL;
      IF v_cash_str IS NOT NULL THEN
        BEGIN
          IF v_cash_str ~ '^\d{4}-\d{2}-\d{2}$' THEN v_cash := v_cash_str::date;
          ELSIF v_cash_str ~ '^\d{2}/\d{2}/\d{4}$' THEN
            v_cash := to_date(v_cash_str,'DD/MM/YYYY');
          END IF;
        EXCEPTION WHEN OTHERS THEN v_cash := NULL;
        END;
      END IF;

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
        cash_date = COALESCE(v_cash, fe.cash_date),
        status = CASE WHEN COALESCE(v_cash, fe.cash_date) IS NOT NULL THEN 'realizado'::entry_status ELSE fe.status END,
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

      IF FOUND THEN
        v_updated := v_updated + 1;
        IF v_cash IS NOT NULL THEN v_with_cash := v_with_cash + 1; END IF;
      END IF;
    END LOOP;
    v_iter := v_iter + 1;
  END LOOP;

  RETURN jsonb_build_object('payloads_processed', v_iter, 'entries_updated', v_updated, 'cash_dates_set', v_with_cash);
END $$;

-- 3. Helper to upsert a bank movement from OMIE extrato (used by sync route)
CREATE OR REPLACE FUNCTION public.upsert_bank_movement(
  _company uuid, _bank_account uuid, _source_record_id text,
  _movement_date date, _amount numeric, _direction text,
  _description text, _document text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.bank_movements (
    company_id, bank_account_id, source_record_id, movement_date,
    amount, direction, description, document_number, synced_at
  ) VALUES (
    _company, _bank_account, _source_record_id, _movement_date,
    ABS(_amount), _direction::entry_direction, _description, _document, now()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
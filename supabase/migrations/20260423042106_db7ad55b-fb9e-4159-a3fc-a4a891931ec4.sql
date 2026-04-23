-- ============================================================================
-- A. Auto-classification trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_classify_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only classify when not already classified or category_raw changed
  IF NEW.category_raw IS NOT NULL
     AND (NEW.is_classified = false
          OR (TG_OP = 'UPDATE' AND OLD.category_raw IS DISTINCT FROM NEW.category_raw)) THEN
    PERFORM public.classify_financial_entry(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_classify_financial_entry ON public.financial_entries;
CREATE TRIGGER trg_classify_financial_entry
AFTER INSERT OR UPDATE OF category_raw, is_classified
ON public.financial_entries
FOR EACH ROW
EXECUTE FUNCTION public.tg_classify_entry();

-- ============================================================================
-- B. Balance projection function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_balance_projection(_company uuid, _date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
  v_caixa NUMERIC := 0;
  v_ar NUMERIC := 0;
  v_ap NUMERIC := 0;
  v_estoque NUMERIC := 0;
  v_imob NUMERIC := 0;
  v_emprestimos NUMERIC := 0;
  v_capital NUMERIC := 0;
  v_resultado NUMERIC := 0;
  v_outros_ativos NUMERIC := 0;
  v_outros_passivos NUMERIC := 0;
BEGIN
  -- Caixa: soma dos saldos iniciais "caixa/banco" + variação líquida do DFC realizado
  SELECT COALESCE(SUM(amount),0) INTO v_caixa
    FROM public.initial_balances
   WHERE company_id = _company
     AND (LOWER(balance_type) LIKE '%caixa%' OR LOWER(balance_type) LIKE '%banco%')
     AND reference_date <= _date;

  SELECT v_caixa + COALESCE(SUM(amount_signed),0) INTO v_caixa
    FROM public.dfc_realized_base
   WHERE company_id = _company AND cash_date <= _date;

  -- AR e AP em aberto
  SELECT COALESCE(SUM(amount - COALESCE(received_amount,0)),0) INTO v_ar
    FROM public.receivable_entries
   WHERE company_id = _company AND status <> 'realizado';

  SELECT COALESCE(SUM(amount - COALESCE(paid_amount,0)),0) INTO v_ap
    FROM public.payable_entries
   WHERE company_id = _company AND status <> 'realizado';

  -- Saldos iniciais por tipo
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

  -- Resultado acumulado: Lucro Líquido até o período
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
END $$;

-- ============================================================================
-- C. Daily cron job: recompute pipeline + balance for all active companies
-- ============================================================================
CREATE OR REPLACE FUNCTION public.run_daily_pipeline_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company RECORD;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
BEGIN
  FOR v_company IN SELECT id, name FROM public.companies WHERE active = true LOOP
    BEGIN
      v_one := public.run_full_pipeline(v_company.id, CURRENT_DATE);
      PERFORM public.compute_balance_projection(v_company.id, CURRENT_DATE);
      v_results := v_results || jsonb_build_object('company', v_company.name, 'ok', true, 'detail', v_one);
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('company', v_company.name, 'ok', false, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN v_results;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule previous version if any
DO $$
BEGIN
  PERFORM cron.unschedule('daily-financial-pipeline');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-financial-pipeline',
  '10 6 * * *',
  $cron$ SELECT public.run_daily_pipeline_all(); $cron$
);
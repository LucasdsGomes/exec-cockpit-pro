-- Fix snapshot_kpis to compute EBITDA and Lucro Líquido from analytical groups
-- (dre_base only stores analytical categories; subtotals must be derived).
CREATE OR REPLACE FUNCTION public.snapshot_kpis(_company uuid, _date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_receita_liq NUMERIC := 0;
  v_outras_rec NUMERIC := 0;
  v_deducoes NUMERIC := 0;
  v_custos NUMERIC := 0;
  v_desp_adm NUMERIC := 0;
  v_desp_pessoal NUMERIC := 0;
  v_desp_op NUMERIC := 0;
  v_desp_trib NUMERIC := 0;
  v_outras_saidas NUMERIC := 0;
  v_desp_fin NUMERIC := 0;
  v_receita NUMERIC := 0;
  v_margem_bruta NUMERIC := 0;
  v_ebitda NUMERIC := 0;
  v_resultado NUMERIC := 0;
  v_caixa NUMERIC := 0;
  v_pay NUMERIC := 0;
  v_rec NUMERIC := 0;
  v_cycle RECORD;
BEGIN
  -- Aggregate analytical groups for the month
  SELECT
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Receita Líquida'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Outras Receitas'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Deduções de Receita'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group IN ('Custos Diretos','CMV')), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Despesas Administrativas'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Despesas com Pessoal'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Despesas Operacionais'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Despesas Tributárias'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Outras Saídas'), 0),
    COALESCE(SUM(amount_signed) FILTER (WHERE dre_group = 'Despesas Financeiras'), 0)
  INTO v_receita_liq, v_outras_rec, v_deducoes, v_custos,
       v_desp_adm, v_desp_pessoal, v_desp_op, v_desp_trib, v_outras_saidas, v_desp_fin
  FROM public.dre_base
  WHERE company_id = _company
    AND date_trunc('month', competence_date) = date_trunc('month', _date);

  v_receita := v_receita_liq + v_outras_rec;
  v_margem_bruta := v_receita + v_custos; -- custos already negative
  v_ebitda := v_margem_bruta + v_desp_adm + v_desp_pessoal + v_desp_op + v_desp_trib + v_outras_saidas;
  v_resultado := v_ebitda + v_desp_fin;

  SELECT COALESCE(caixa,0) INTO v_caixa
    FROM public.balance_projection_daily
   WHERE company_id = _company AND projection_date = _date
   ORDER BY snapshot_date DESC LIMIT 1;

  SELECT COALESCE(SUM(amount - COALESCE(paid_amount,0)),0) INTO v_pay
    FROM public.payable_entries
   WHERE company_id = _company AND due_date BETWEEN _date AND _date + INTERVAL '30 days';

  SELECT COALESCE(SUM(amount - COALESCE(received_amount,0)),0) INTO v_rec
    FROM public.receivable_entries
   WHERE company_id = _company AND due_date BETWEEN _date AND _date + INTERVAL '30 days';

  SELECT * INTO v_cycle FROM public.compute_financial_cycle(_company, _date);

  INSERT INTO public.dashboard_kpi_snapshots (
    company_id, snapshot_date, receita_liquida, margem_bruta, ebitda, resultado_liquido,
    caixa_final, contas_pagar_proximas, contas_receber_proximas,
    pmr, pmp, ciclo_financeiro, projecao_caixa_30d
  ) VALUES (
    _company, _date, v_receita, v_margem_bruta, v_ebitda, v_resultado,
    v_caixa, v_pay, v_rec,
    v_cycle.pmr, v_cycle.pmp, v_cycle.ciclo_financeiro, v_caixa + v_rec - v_pay
  )
  ON CONFLICT (company_id, snapshot_date) DO UPDATE SET
    receita_liquida = EXCLUDED.receita_liquida,
    margem_bruta = EXCLUDED.margem_bruta,
    ebitda = EXCLUDED.ebitda,
    resultado_liquido = EXCLUDED.resultado_liquido,
    caixa_final = EXCLUDED.caixa_final,
    contas_pagar_proximas = EXCLUDED.contas_pagar_proximas,
    contas_receber_proximas = EXCLUDED.contas_receber_proximas,
    pmr = EXCLUDED.pmr, pmp = EXCLUDED.pmp,
    ciclo_financeiro = EXCLUDED.ciclo_financeiro,
    projecao_caixa_30d = EXCLUDED.projecao_caixa_30d
  RETURNING id INTO v_id;

  RETURN v_id;
END $function$;
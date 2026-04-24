
-- 1. Tabela de snapshots de saldo bancário
CREATE TABLE public.bank_balances_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  blocked NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'omie',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, bank_account_id, snapshot_date)
);

CREATE INDEX idx_bank_balances_snapshots_company_date
  ON public.bank_balances_snapshots (company_id, snapshot_date DESC);

ALTER TABLE public.bank_balances_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view bank balance snapshots"
ON public.bank_balances_snapshots FOR SELECT
USING (company_id IN (SELECT public.current_user_companies()));

CREATE TRIGGER tg_bank_balances_snapshots_updated_at
BEFORE UPDATE ON public.bank_balances_snapshots
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Atualiza compute_balance_projection para usar o snapshot Omie quando disponível
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
  v_ap NUMERIC := 0;
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
  -- Caixa: tenta usar o snapshot Omie mais recente por conta como base
  SELECT MAX(snapshot_date) INTO v_snapshot_date
    FROM public.bank_balances_snapshots
   WHERE company_id = _company
     AND snapshot_date <= _date;

  IF v_snapshot_date IS NOT NULL THEN
    -- Soma o último saldo conhecido (≤ _date) de cada conta
    SELECT COALESCE(SUM(s.balance), 0) INTO v_snapshot_total
      FROM (
        SELECT DISTINCT ON (bank_account_id) bank_account_id, balance, snapshot_date
        FROM public.bank_balances_snapshots
        WHERE company_id = _company
          AND snapshot_date <= _date
        ORDER BY bank_account_id, snapshot_date DESC
      ) s;

    v_caixa := v_snapshot_total;

    -- Soma variação do DFC realizado APÓS o snapshot até _date
    SELECT v_caixa + COALESCE(SUM(amount_signed),0) INTO v_caixa
      FROM public.dfc_realized_base
     WHERE company_id = _company
       AND cash_date > v_snapshot_date
       AND cash_date <= _date;
  ELSE
    -- Fallback: lógica original com saldos iniciais manuais
    SELECT COALESCE(SUM(amount),0) INTO v_caixa
      FROM public.initial_balances
     WHERE company_id = _company
       AND (LOWER(balance_type) LIKE '%caixa%' OR LOWER(balance_type) LIKE '%banco%')
       AND reference_date <= _date;

    SELECT v_caixa + COALESCE(SUM(amount_signed),0) INTO v_caixa
      FROM public.dfc_realized_base
     WHERE company_id = _company AND cash_date <= _date;
  END IF;

  -- AR e AP em aberto
  SELECT COALESCE(SUM(amount - COALESCE(received_amount,0)),0) INTO v_ar
    FROM public.receivable_entries
   WHERE company_id = _company AND status <> 'realizado';

  SELECT COALESCE(SUM(amount - COALESCE(paid_amount,0)),0) INTO v_ap
    FROM public.payable_entries
   WHERE company_id = _company AND status <> 'realizado';

  -- Saldos iniciais por tipo (não-caixa)
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
END $function$;

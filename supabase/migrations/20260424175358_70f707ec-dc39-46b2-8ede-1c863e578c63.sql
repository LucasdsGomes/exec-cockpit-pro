
-- Loans / financings module
CREATE TYPE public.loan_kind AS ENUM ('emprestimo', 'financiamento', 'leasing', 'antecipacao', 'capital_giro', 'outro');
CREATE TYPE public.loan_status AS ENUM ('ativo', 'quitado', 'inadimplente', 'renegociado', 'cancelado');
CREATE TYPE public.loan_installment_status AS ENUM ('previsto', 'pago', 'parcial', 'vencido', 'cancelado');

CREATE TABLE public.loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_system TEXT DEFAULT 'omie',
  source_endpoint TEXT,
  source_record_id TEXT,
  contract_number TEXT,
  description TEXT,
  institution TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  kind loan_kind NOT NULL DEFAULT 'emprestimo',
  status loan_status NOT NULL DEFAULT 'ativo',
  contract_date DATE,
  first_due_date DATE,
  last_due_date DATE,
  principal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate_monthly NUMERIC(8,4),
  total_installments INTEGER,
  paid_installments INTEGER DEFAULT 0,
  outstanding_balance NUMERIC(14,2) DEFAULT 0,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_endpoint, source_record_id)
);

CREATE INDEX idx_loans_company_status ON public.loans(company_id, status);
CREATE INDEX idx_loans_company_due ON public.loans(company_id, last_due_date);

CREATE TABLE public.loan_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  principal_amount NUMERIC(14,2) DEFAULT 0,
  interest_amount NUMERIC(14,2) DEFAULT 0,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  paid_at DATE,
  status loan_installment_status NOT NULL DEFAULT 'previsto',
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_number)
);

CREATE INDEX idx_loan_installments_company_due ON public.loan_installments(company_id, due_date);
CREATE INDEX idx_loan_installments_status ON public.loan_installments(company_id, status);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans_select_member" ON public.loans
  FOR SELECT USING (company_id IN (SELECT public.current_user_companies()));
CREATE POLICY "loans_modify_editor" ON public.loans
  FOR ALL USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

CREATE POLICY "loan_installments_select_member" ON public.loan_installments
  FOR SELECT USING (company_id IN (SELECT public.current_user_companies()));
CREATE POLICY "loan_installments_modify_editor" ON public.loan_installments
  FOR ALL USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

CREATE TRIGGER tg_loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_loan_installments_updated_at BEFORE UPDATE ON public.loan_installments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Outstanding balance view
CREATE OR REPLACE VIEW public.loans_outstanding_balance AS
SELECT
  l.company_id,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ativo') AS active_loans,
  COALESCE(SUM(l.principal_amount) FILTER (WHERE l.status = 'ativo'), 0) AS total_principal,
  COALESCE(SUM(li.paid_amount), 0) AS total_paid,
  COALESCE(SUM(li.amount) FILTER (WHERE li.status IN ('previsto','parcial','vencido')), 0) AS total_outstanding,
  COALESCE(SUM(li.interest_amount), 0) AS total_interest,
  COALESCE(SUM(li.amount) FILTER (
    WHERE li.status IN ('previsto','parcial','vencido')
      AND li.due_date <= CURRENT_DATE + INTERVAL '30 days'
  ), 0) AS due_next_30d,
  COALESCE(SUM(li.amount) FILTER (
    WHERE li.status = 'vencido'
  ), 0) AS overdue_amount
FROM public.loans l
LEFT JOIN public.loan_installments li ON li.loan_id = l.id
GROUP BY l.company_id;

-- Update compute_balance_projection to use loan outstanding balance when present
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
  v_emprestimos_loans NUMERIC := 0;
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

  SELECT COALESCE(SUM(amount - COALESCE(received_amount,0)),0) INTO v_ar
    FROM public.receivable_entries
   WHERE company_id = _company AND status <> 'realizado';

  SELECT COALESCE(SUM(amount - COALESCE(paid_amount,0)),0) INTO v_ap
    FROM public.payable_entries
   WHERE company_id = _company AND status <> 'realizado';

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

  -- Prefer loans table if any active loan exists
  SELECT COALESCE(total_outstanding, 0) INTO v_emprestimos_loans
    FROM public.loans_outstanding_balance WHERE company_id = _company;
  IF v_emprestimos_loans > 0 THEN
    v_emprestimos := v_emprestimos_loans;
  END IF;

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

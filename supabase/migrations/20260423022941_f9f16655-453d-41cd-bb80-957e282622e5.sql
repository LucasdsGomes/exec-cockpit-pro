
-- Fix search_path warning
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================================================
-- MANAGERIAL TABLES
-- =========================================================
CREATE TABLE public.dre_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_date DATE NOT NULL,
  competence_date DATE NOT NULL,
  dre_group TEXT NOT NULL,
  dre_subgroup TEXT,
  category_mapped TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  business_unit TEXT,
  department TEXT,
  amount NUMERIC(18,2) NOT NULL,
  amount_signed NUMERIC(18,2) NOT NULL,
  source_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dre_base_company_competence ON public.dre_base(company_id, competence_date);
CREATE INDEX idx_dre_base_group ON public.dre_base(company_id, dre_group, competence_date);

CREATE TABLE public.dfc_realized_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_date DATE NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  dfc_group TEXT NOT NULL,
  dfc_subgroup TEXT,
  flow_type flow_type NOT NULL,
  category_mapped TEXT,
  amount NUMERIC(18,2) NOT NULL,
  amount_signed NUMERIC(18,2) NOT NULL,
  source_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dfc_real_company_date ON public.dfc_realized_base(company_id, cash_date);

CREATE TABLE public.dfc_forecast_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  dfc_group TEXT NOT NULL,
  dfc_subgroup TEXT,
  flow_type flow_type NOT NULL,
  category_mapped TEXT,
  amount NUMERIC(18,2) NOT NULL,
  amount_signed NUMERIC(18,2) NOT NULL,
  confidence_pct NUMERIC(5,2) DEFAULT 100,
  source_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dfc_fore_company_date ON public.dfc_forecast_base(company_id, forecast_date);

CREATE TABLE public.initial_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_date DATE NOT NULL,
  balance_type TEXT NOT NULL,    -- 'bank' | 'receivable' | 'payable' | 'patrimonial' | 'other'
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  account_label TEXT,
  amount NUMERIC(18,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_ib_updated BEFORE UPDATE ON public.initial_balances FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_ib_company_date ON public.initial_balances(company_id, reference_date);

CREATE TABLE public.manual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_kind TEXT NOT NULL,        -- 'dre' | 'dfc' | 'balance' | 'parameter'
  reference_date DATE NOT NULL,
  competence_date DATE,
  cash_date DATE,
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  amount_signed NUMERIC(18,2) NOT NULL,
  dre_group TEXT,
  dfc_group TEXT,
  flow_type flow_type,
  category_mapped TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_me_updated BEFORE UPDATE ON public.manual_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_me_company_date ON public.manual_entries(company_id, reference_date);

CREATE TABLE public.budget_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_period DATE NOT NULL,
  managerial_account TEXT NOT NULL,
  category_mapped TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  business_unit TEXT,
  scenario budget_scenario NOT NULL DEFAULT 'orcado',
  amount NUMERIC(18,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_be_updated BEFORE UPDATE ON public.budget_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_be_company_period ON public.budget_entries(company_id, reference_period);

CREATE TABLE public.actual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_period DATE NOT NULL,
  managerial_account TEXT NOT NULL,
  category_mapped TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  business_unit TEXT,
  amount NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ae_company_period ON public.actual_entries(company_id, reference_period);

CREATE TABLE public.budget_vs_actual_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_period DATE NOT NULL,
  managerial_account TEXT NOT NULL,
  category_mapped TEXT,
  budget_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  variance_abs NUMERIC(18,2) NOT NULL DEFAULT 0,
  variance_pct NUMERIC(8,2),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bvas_company ON public.budget_vs_actual_snapshots(company_id, reference_period);

CREATE TABLE public.working_capital_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_period DATE NOT NULL,
  current_assets NUMERIC(18,2),
  current_liabilities NUMERIC(18,2),
  working_capital NUMERIC(18,2),
  net_debt NUMERIC(18,2),
  net_cash NUMERIC(18,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, reference_period)
);

CREATE TABLE public.financial_cycle_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_period DATE NOT NULL,
  pmr NUMERIC(8,2),
  pmp NUMERIC(8,2),
  pme NUMERIC(8,2),
  ciclo_operacional NUMERIC(8,2),
  ciclo_financeiro NUMERIC(8,2),
  necessidade_capital_giro NUMERIC(18,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, reference_period)
);

CREATE TABLE public.balance_projection_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  projection_date DATE NOT NULL,
  caixa NUMERIC(18,2) DEFAULT 0,
  contas_receber NUMERIC(18,2) DEFAULT 0,
  estoques NUMERIC(18,2) DEFAULT 0,
  outros_ativos NUMERIC(18,2) DEFAULT 0,
  imobilizado NUMERIC(18,2) DEFAULT 0,
  fornecedores NUMERIC(18,2) DEFAULT 0,
  obrigacoes_tributarias NUMERIC(18,2) DEFAULT 0,
  obrigacoes_trabalhistas NUMERIC(18,2) DEFAULT 0,
  emprestimos NUMERIC(18,2) DEFAULT 0,
  outros_passivos NUMERIC(18,2) DEFAULT 0,
  patrimonio_liquido NUMERIC(18,2) DEFAULT 0,
  resultado_acumulado NUMERIC(18,2) DEFAULT 0,
  capital_de_giro NUMERIC(18,2) DEFAULT 0,
  divida_liquida NUMERIC(18,2) DEFAULT 0,
  caixa_liquido NUMERIC(18,2) DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, projection_date, snapshot_date)
);
CREATE INDEX idx_bpd_company_date ON public.balance_projection_daily(company_id, projection_date);

CREATE TABLE public.dashboard_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  receita_liquida NUMERIC(18,2),
  margem_bruta NUMERIC(18,2),
  ebitda NUMERIC(18,2),
  resultado_liquido NUMERIC(18,2),
  caixa_final NUMERIC(18,2),
  geracao_caixa NUMERIC(18,2),
  contas_pagar_proximas NUMERIC(18,2),
  contas_receber_proximas NUMERIC(18,2),
  pmr NUMERIC(8,2),
  pmp NUMERIC(8,2),
  ciclo_financeiro NUMERIC(8,2),
  projecao_caixa_30d NUMERIC(18,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, snapshot_date)
);

-- =========================================================
-- RLS for managerial layer
-- =========================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dre_base','dfc_realized_base','dfc_forecast_base',
    'initial_balances','manual_entries','budget_entries','actual_entries',
    'budget_vs_actual_snapshots','working_capital_metrics','financial_cycle_metrics',
    'balance_projection_daily','dashboard_kpi_snapshots'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "%1$s_select_member" ON public.%1$I FOR SELECT TO authenticated USING (company_id IN (SELECT public.current_user_companies()))$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_modify_editor" ON public.%1$I FOR ALL TO authenticated USING (public.can_edit_company(company_id)) WITH CHECK (public.can_edit_company(company_id))$p$, t);
  END LOOP;
END $$;

-- =========================================================
-- VIEWS
-- =========================================================
CREATE OR REPLACE VIEW public.v_dre_monthly AS
SELECT
  company_id,
  date_trunc('month', competence_date)::date AS reference_month,
  dre_group,
  dre_subgroup,
  category_mapped,
  SUM(amount_signed) AS amount_total,
  COUNT(*) AS entry_count
FROM public.dre_base
GROUP BY 1,2,3,4,5;

CREATE OR REPLACE VIEW public.v_dfc_realized_daily AS
SELECT
  company_id, cash_date, flow_type, dfc_group, dfc_subgroup,
  SUM(amount_signed) AS amount_total
FROM public.dfc_realized_base
GROUP BY 1,2,3,4,5;

CREATE OR REPLACE VIEW public.v_dfc_forecast_daily AS
SELECT
  company_id, forecast_date, flow_type, dfc_group, dfc_subgroup,
  SUM(amount_signed) AS amount_total
FROM public.dfc_forecast_base
GROUP BY 1,2,3,4,5;

CREATE OR REPLACE VIEW public.v_budget_vs_actual AS
SELECT
  COALESCE(b.company_id, a.company_id)               AS company_id,
  COALESCE(b.reference_period, a.reference_period)   AS reference_period,
  COALESCE(b.managerial_account, a.managerial_account) AS managerial_account,
  COALESCE(b.category_mapped, a.category_mapped)     AS category_mapped,
  COALESCE(SUM(b.amount), 0) AS budget_amount,
  COALESCE(SUM(a.amount), 0) AS actual_amount,
  COALESCE(SUM(a.amount), 0) - COALESCE(SUM(b.amount), 0) AS variance_abs,
  CASE WHEN COALESCE(SUM(b.amount), 0) = 0 THEN NULL
       ELSE ROUND(((COALESCE(SUM(a.amount), 0) - COALESCE(SUM(b.amount), 0)) / NULLIF(SUM(b.amount), 0)) * 100, 2)
  END AS variance_pct
FROM public.budget_entries b
FULL OUTER JOIN public.actual_entries a
  ON a.company_id = b.company_id
 AND a.reference_period = b.reference_period
 AND a.managerial_account = b.managerial_account
 AND COALESCE(a.category_mapped,'') = COALESCE(b.category_mapped,'')
GROUP BY 1,2,3,4;

CREATE OR REPLACE VIEW public.v_unclassified_entries AS
SELECT id, company_id, competence_date, amount_signed, description, category_raw, supplier_name, customer_name, created_at
FROM public.financial_entries
WHERE is_classified = false;

-- =========================================================
-- FUNCTIONS: financial cycle + KPI snapshot
-- =========================================================
CREATE OR REPLACE FUNCTION public.compute_financial_cycle(_company UUID, _period DATE)
RETURNS TABLE (pmr NUMERIC, pmp NUMERIC, pme NUMERIC, ciclo_operacional NUMERIC, ciclo_financeiro NUMERIC, ncg NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_revenue NUMERIC := 0;
  v_purchases NUMERIC := 0;
  v_ar NUMERIC := 0;
  v_ap NUMERIC := 0;
  v_inv NUMERIC := 0;
  v_pme NUMERIC := 0;
  v_pmr NUMERIC := 0;
  v_pmp NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(amount_signed),0) INTO v_revenue
    FROM public.dre_base
   WHERE company_id = _company
     AND date_trunc('month', competence_date) = date_trunc('month', _period)
     AND dre_group = 'Receita Líquida';

  SELECT COALESCE(SUM(ABS(amount_signed)),0) INTO v_purchases
    FROM public.dre_base
   WHERE company_id = _company
     AND date_trunc('month', competence_date) = date_trunc('month', _period)
     AND dre_group IN ('Custos Diretos','CMV');

  SELECT COALESCE(SUM(amount - COALESCE(received_amount,0)),0) INTO v_ar
    FROM public.receivable_entries
   WHERE company_id = _company AND status <> 'realizado';

  SELECT COALESCE(SUM(amount - COALESCE(paid_amount,0)),0) INTO v_ap
    FROM public.payable_entries
   WHERE company_id = _company AND status <> 'realizado';

  SELECT COALESCE(param_value,0) INTO v_inv
    FROM public.manual_parameters
   WHERE company_id = _company AND param_key = 'inventory_value'
   ORDER BY reference_period DESC NULLS LAST LIMIT 1;

  v_pmr := CASE WHEN v_revenue > 0 THEN (v_ar / v_revenue) * 30 ELSE 0 END;
  v_pmp := CASE WHEN v_purchases > 0 THEN (v_ap / v_purchases) * 30 ELSE 0 END;
  v_pme := CASE WHEN v_purchases > 0 THEN (v_inv / v_purchases) * 30 ELSE 0 END;

  RETURN QUERY SELECT
    ROUND(v_pmr,2),
    ROUND(v_pmp,2),
    ROUND(v_pme,2),
    ROUND(v_pmr + v_pme,2),
    ROUND(v_pmr + v_pme - v_pmp,2),
    ROUND(((v_pmr + v_pme - v_pmp) / 30.0) * v_revenue, 2);
END $$;

CREATE OR REPLACE FUNCTION public.snapshot_kpis(_company UUID, _date DATE)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_receita NUMERIC := 0;
  v_ebitda NUMERIC := 0;
  v_resultado NUMERIC := 0;
  v_caixa NUMERIC := 0;
  v_pay NUMERIC := 0;
  v_rec NUMERIC := 0;
  v_cycle RECORD;
BEGIN
  SELECT COALESCE(SUM(amount_signed),0) INTO v_receita
    FROM public.dre_base
   WHERE company_id = _company
     AND date_trunc('month', competence_date) = date_trunc('month', _date)
     AND dre_group = 'Receita Líquida';

  SELECT COALESCE(SUM(amount_signed),0) INTO v_ebitda
    FROM public.dre_base
   WHERE company_id = _company
     AND date_trunc('month', competence_date) = date_trunc('month', _date)
     AND dre_group = 'EBITDA';

  SELECT COALESCE(SUM(amount_signed),0) INTO v_resultado
    FROM public.dre_base
   WHERE company_id = _company
     AND date_trunc('month', competence_date) = date_trunc('month', _date)
     AND dre_group IN ('Lucro Líquido','Prejuízo Líquido','Resultado Líquido');

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
    company_id, snapshot_date, receita_liquida, ebitda, resultado_liquido,
    caixa_final, contas_pagar_proximas, contas_receber_proximas,
    pmr, pmp, ciclo_financeiro, projecao_caixa_30d
  ) VALUES (
    _company, _date, v_receita, v_ebitda, v_resultado,
    v_caixa, v_pay, v_rec,
    v_cycle.pmr, v_cycle.pmp, v_cycle.ciclo_financeiro, v_caixa + v_rec - v_pay
  )
  ON CONFLICT (company_id, snapshot_date) DO UPDATE SET
    receita_liquida = EXCLUDED.receita_liquida,
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
END $$;

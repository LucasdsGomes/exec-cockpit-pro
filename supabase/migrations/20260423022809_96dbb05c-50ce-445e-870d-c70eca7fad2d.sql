
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'finance', 'controller', 'viewer');
CREATE TYPE public.flow_type AS ENUM ('operacional', 'investimento', 'financiamento');
CREATE TYPE public.entry_direction AS ENUM ('entrada', 'saida');
CREATE TYPE public.entry_status AS ENUM ('previsto', 'realizado', 'cancelado', 'parcial');
CREATE TYPE public.sync_status AS ENUM ('pending', 'running', 'success', 'error', 'partial');
CREATE TYPE public.budget_scenario AS ENUM ('orcado', 'realizado', 'reprojetado');

-- =========================================================
-- COMPANIES
-- =========================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  cnpj TEXT UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  default_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company ON public.user_roles(company_id);

-- =========================================================
-- SECURITY DEFINER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _company_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_companies()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), _company_id, 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.can_edit_company(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), _company_id, 'admin'::app_role)
      OR public.has_role(auth.uid(), _company_id, 'finance'::app_role)
      OR public.has_role(auth.uid(), _company_id, 'controller'::app_role)
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- profile auto-create trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER tg_companies_updated BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- RLS: companies, profiles, user_roles
-- =========================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_member" ON public.companies FOR SELECT TO authenticated
USING (id IN (SELECT public.current_user_companies()));
CREATE POLICY "companies_admin_all" ON public.companies FOR ALL TO authenticated
USING (public.is_company_admin(id)) WITH CHECK (public.is_company_admin(id));

CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_company_admin(company_id));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));

-- =========================================================
-- CONFIG TABLES
-- =========================================================
CREATE TABLE public.omie_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'production',
  app_key_ref TEXT NOT NULL,            -- nome do secret no Lovable Cloud
  app_secret_ref TEXT NOT NULL,         -- nome do secret
  base_url TEXT NOT NULL DEFAULT 'https://app.omie.com.br/api/v1',
  active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_status sync_status,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, environment)
);
CREATE TRIGGER tg_omie_creds_updated BEFORE UPDATE ON public.omie_credentials FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.chart_of_accounts_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  omie_account_code TEXT NOT NULL,
  omie_account_description TEXT,
  managerial_account TEXT NOT NULL,
  managerial_group_1 TEXT,
  managerial_group_2 TEXT,
  managerial_group_3 TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, omie_account_code)
);
CREATE TRIGGER tg_coa_updated BEFORE UPDATE ON public.chart_of_accounts_mapping FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.category_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  omie_category_code TEXT NOT NULL,
  omie_category_description TEXT,
  dre_category TEXT,
  dre_subcategory TEXT,
  dfc_category TEXT,
  dfc_subcategory TEXT,
  managerial_group_1 TEXT,
  managerial_group_2 TEXT,
  managerial_group_3 TEXT,
  flow_type flow_type,
  affects_dre BOOLEAN NOT NULL DEFAULT true,
  affects_cash BOOLEAN NOT NULL DEFAULT true,
  affects_balance BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, omie_category_code)
);
CREATE TRIGGER tg_catmap_updated BEFORE UPDATE ON public.category_mapping FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.cost_center_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  omie_cost_center_code TEXT NOT NULL,
  omie_cost_center_description TEXT,
  managerial_cost_center TEXT NOT NULL,
  department TEXT,
  business_unit TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, omie_cost_center_code)
);
CREATE TRIGGER tg_ccmap_updated BEFORE UPDATE ON public.cost_center_mapping FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.dre_mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  match_type TEXT NOT NULL,             -- 'category' | 'account' | 'description'
  match_pattern TEXT NOT NULL,
  dre_group TEXT NOT NULL,
  dre_subgroup TEXT,
  display_order INT NOT NULL DEFAULT 0,
  sign_multiplier INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_dremap_updated BEFORE UPDATE ON public.dre_mapping_rules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.cash_flow_mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  match_type TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  dfc_group TEXT NOT NULL,
  dfc_subgroup TEXT,
  flow_type flow_type NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  sign_multiplier INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_dfcmap_updated BEFORE UPDATE ON public.cash_flow_mapping_rules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.balance_projection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  balance_group TEXT NOT NULL,           -- ativo/passivo/pl
  balance_subgroup TEXT,
  match_type TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_balrules_updated BEFORE UPDATE ON public.balance_projection_rules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.manual_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  param_key TEXT NOT NULL,
  param_value NUMERIC,
  param_text TEXT,
  reference_period DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, param_key, reference_period)
);
CREATE TRIGGER tg_manparam_updated BEFORE UPDATE ON public.manual_parameters FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  metric TEXT NOT NULL,
  comparator TEXT NOT NULL,              -- '>', '<', '>=', '<=', '='
  threshold NUMERIC NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER tg_alert_updated BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- RAW INGESTION
-- =========================================================
CREATE TABLE public.omie_raw_sync_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_endpoint TEXT NOT NULL,
  status sync_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  total_records INT DEFAULT 0,
  processed_records INT DEFAULT 0,
  error_records INT DEFAULT 0,
  triggered_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_batches_company_endpoint ON public.omie_raw_sync_batches(company_id, source_endpoint, started_at DESC);

CREATE TABLE public.omie_raw_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.omie_raw_sync_batches(id) ON DELETE CASCADE,
  source_endpoint TEXT NOT NULL,
  source_record_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_raw_payloads_company ON public.omie_raw_payloads(company_id, source_endpoint, received_at DESC);
CREATE INDEX idx_raw_payloads_batch ON public.omie_raw_payloads(batch_id);

CREATE TABLE public.omie_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.omie_raw_sync_batches(id) ON DELETE CASCADE,
  source_endpoint TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_logs_company ON public.omie_sync_logs(company_id, created_at DESC);

CREATE TABLE public.omie_sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.omie_raw_sync_batches(id) ON DELETE CASCADE,
  source_endpoint TEXT NOT NULL,
  source_record_id TEXT,
  error_code TEXT,
  error_message TEXT NOT NULL,
  payload JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_errors_company ON public.omie_sync_errors(company_id, created_at DESC);

-- =========================================================
-- NORMALIZED
-- =========================================================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_record_id TEXT,
  name TEXT NOT NULL,
  bank_name TEXT,
  agency TEXT,
  account_number TEXT,
  account_type TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);
CREATE TRIGGER tg_bank_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_bank_accounts_company ON public.bank_accounts(company_id);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_record_id TEXT,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(company_id, source_record_id)
);
CREATE TRIGGER tg_cust_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_customers_company ON public.customers(company_id);

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_record_id TEXT,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(company_id, source_record_id)
);
CREATE TRIGGER tg_supp_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_suppliers_company ON public.suppliers(company_id);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_record_id TEXT,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  parent_code TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(company_id, code)
);
CREATE TRIGGER tg_cat_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_record_id TEXT,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  department TEXT,
  business_unit TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(company_id, code)
);
CREATE TRIGGER tg_cc_updated BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL DEFAULT 'omie',
  source_record_id TEXT,
  source_endpoint TEXT,
  imported_batch_id UUID REFERENCES public.omie_raw_sync_batches(id) ON DELETE SET NULL,
  reference_date DATE,
  competence_date DATE NOT NULL,
  cash_date DATE,
  due_date DATE,
  amount NUMERIC(18,2) NOT NULL,
  amount_signed NUMERIC(18,2) NOT NULL,
  direction entry_direction NOT NULL,
  status entry_status NOT NULL DEFAULT 'previsto',
  description TEXT,
  document_number TEXT,
  category_raw TEXT,
  category_mapped TEXT,
  dre_group TEXT,
  dre_subgroup TEXT,
  dfc_group TEXT,
  dfc_subgroup TEXT,
  flow_type flow_type,
  affects_dre BOOLEAN NOT NULL DEFAULT true,
  affects_cash BOOLEAN NOT NULL DEFAULT true,
  affects_balance BOOLEAN NOT NULL DEFAULT true,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  is_classified BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);
CREATE TRIGGER tg_fe_updated BEFORE UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_fe_company_competence ON public.financial_entries(company_id, competence_date);
CREATE INDEX idx_fe_company_cash ON public.financial_entries(company_id, cash_date);
CREATE INDEX idx_fe_company_due ON public.financial_entries(company_id, due_date);
CREATE INDEX idx_fe_classified ON public.financial_entries(company_id, is_classified);
CREATE INDEX idx_fe_status ON public.financial_entries(company_id, status);

CREATE TABLE public.payable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  source_record_id TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  document_number TEXT,
  due_date DATE NOT NULL,
  cash_date DATE,
  amount NUMERIC(18,2) NOT NULL,
  paid_amount NUMERIC(18,2) DEFAULT 0,
  status entry_status NOT NULL DEFAULT 'previsto',
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  category_mapped TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);
CREATE TRIGGER tg_pay_updated BEFORE UPDATE ON public.payable_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_pay_company_due ON public.payable_entries(company_id, due_date);

CREATE TABLE public.receivable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  source_record_id TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  document_number TEXT,
  due_date DATE NOT NULL,
  cash_date DATE,
  amount NUMERIC(18,2) NOT NULL,
  received_amount NUMERIC(18,2) DEFAULT 0,
  status entry_status NOT NULL DEFAULT 'previsto',
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  category_mapped TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);
CREATE TRIGGER tg_rec_updated BEFORE UPDATE ON public.receivable_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_rec_company_due ON public.receivable_entries(company_id, due_date);

CREATE TABLE public.bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  source_record_id TEXT,
  movement_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  direction entry_direction NOT NULL,
  description TEXT,
  document_number TEXT,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);
CREATE TRIGGER tg_bm_updated BEFORE UPDATE ON public.bank_movements FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_bm_company_date ON public.bank_movements(company_id, movement_date);

-- =========================================================
-- RLS for all config/raw/normalized
-- =========================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'omie_credentials','chart_of_accounts_mapping','category_mapping','cost_center_mapping',
    'dre_mapping_rules','cash_flow_mapping_rules','balance_projection_rules',
    'manual_parameters','alert_rules',
    'omie_raw_sync_batches','omie_raw_payloads','omie_sync_logs','omie_sync_errors',
    'bank_accounts','customers','suppliers','categories','cost_centers',
    'financial_entries','payable_entries','receivable_entries','bank_movements'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "%1$s_select_member" ON public.%1$I FOR SELECT TO authenticated USING (company_id IN (SELECT public.current_user_companies()))$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_modify_editor" ON public.%1$I FOR ALL TO authenticated USING (public.can_edit_company(company_id)) WITH CHECK (public.can_edit_company(company_id))$p$, t);
  END LOOP;
END $$;

-- omie_credentials: only admin
DROP POLICY "omie_credentials_modify_editor" ON public.omie_credentials;
CREATE POLICY "omie_credentials_admin_only" ON public.omie_credentials FOR ALL TO authenticated
USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));


-- 1) omie_credentials: restrict SELECT to admins only
DROP POLICY IF EXISTS "omie_credentials_select_member" ON public.omie_credentials;
CREATE POLICY "omie_credentials_select_admin"
  ON public.omie_credentials
  FOR SELECT
  TO authenticated
  USING (public.is_company_admin(company_id));

-- 2) bank_balances_snapshots: scope to authenticated
DROP POLICY IF EXISTS "Members can view bank balance snapshots" ON public.bank_balances_snapshots;
CREATE POLICY "bank_balances_snapshots_select_member"
  ON public.bank_balances_snapshots
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));

-- 3) loans & loan_installments: scope to authenticated
DROP POLICY IF EXISTS "loans_select_member" ON public.loans;
DROP POLICY IF EXISTS "loans_modify_editor" ON public.loans;
CREATE POLICY "loans_select_member"
  ON public.loans
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));
CREATE POLICY "loans_modify_editor"
  ON public.loans
  FOR ALL
  TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

DROP POLICY IF EXISTS "loan_installments_select_member" ON public.loan_installments;
DROP POLICY IF EXISTS "loan_installments_modify_editor" ON public.loan_installments;
CREATE POLICY "loan_installments_select_member"
  ON public.loan_installments
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));
CREATE POLICY "loan_installments_modify_editor"
  ON public.loan_installments
  FOR ALL
  TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

-- 4) Tighten EXECUTE on SECURITY DEFINER functions
-- 4a) Revoke from anon (PUBLIC) on operational/internal functions
DO $$
DECLARE
  fn text;
  ops text[] := ARRAY[
    'run_full_pipeline(uuid, date)',
    'run_daily_pipeline_all()',
    'snapshot_kpis(uuid, date)',
    'compute_balance_projection(uuid, date)',
    'reprocess_raw_payloads(uuid)',
    'backfill_company_refs(uuid)',
    'propagate_entry_refs(uuid)',
    'reconcile_bank_movements(uuid)',
    'pair_bank_transfers(uuid)',
    'link_financial_entries_to_projects(uuid)',
    'apply_cost_center_rules(uuid)',
    'mirror_payables_receivables(uuid)',
    'seed_initial_balances_from_bank_accounts(uuid, date)',
    'reclassify_company(uuid, boolean)',
    'classify_financial_entry(uuid)',
    'upsert_bank_movement(uuid, uuid, text, date, numeric, text, text, text)',
    'list_cron_jobs()'
  ];
BEGIN
  FOREACH fn IN ARRAY ops LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- 4b) Keep helper/access functions usable: revoke PUBLIC/anon, keep authenticated
DO $$
DECLARE
  fn text;
  helpers text[] := ARRAY[
    'current_user_companies()',
    'can_edit_company(uuid)',
    'is_company_admin(uuid)',
    'has_role(uuid, uuid, app_role)',
    'has_any_role(uuid, uuid)',
    'compute_dre_competencia(uuid, date, date)',
    'compute_financial_cycle(uuid, date)',
    'system_health(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY helpers LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;


DROP VIEW IF EXISTS public.v_dre_monthly;
DROP VIEW IF EXISTS public.v_dfc_realized_daily;
DROP VIEW IF EXISTS public.v_dfc_forecast_daily;
DROP VIEW IF EXISTS public.v_budget_vs_actual;
DROP VIEW IF EXISTS public.v_unclassified_entries;

CREATE VIEW public.v_dre_monthly WITH (security_invoker = true) AS
SELECT
  company_id,
  date_trunc('month', competence_date)::date AS reference_month,
  dre_group, dre_subgroup, category_mapped,
  SUM(amount_signed) AS amount_total,
  COUNT(*) AS entry_count
FROM public.dre_base
GROUP BY 1,2,3,4,5;

CREATE VIEW public.v_dfc_realized_daily WITH (security_invoker = true) AS
SELECT company_id, cash_date, flow_type, dfc_group, dfc_subgroup,
       SUM(amount_signed) AS amount_total
FROM public.dfc_realized_base
GROUP BY 1,2,3,4,5;

CREATE VIEW public.v_dfc_forecast_daily WITH (security_invoker = true) AS
SELECT company_id, forecast_date, flow_type, dfc_group, dfc_subgroup,
       SUM(amount_signed) AS amount_total
FROM public.dfc_forecast_base
GROUP BY 1,2,3,4,5;

CREATE VIEW public.v_budget_vs_actual WITH (security_invoker = true) AS
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

CREATE VIEW public.v_unclassified_entries WITH (security_invoker = true) AS
SELECT id, company_id, competence_date, amount_signed, description, category_raw, supplier_name, customer_name, created_at
FROM public.financial_entries
WHERE is_classified = false;

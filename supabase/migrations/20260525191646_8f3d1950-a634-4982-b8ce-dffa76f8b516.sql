-- Add permission guard inside run_full_pipeline and re-grant EXECUTE to authenticated
CREATE OR REPLACE FUNCTION public.run_full_pipeline(_company uuid, _date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_classified INTEGER;
  v_snapshot UUID;
BEGIN
  IF NOT public.can_edit_company(_company) THEN
    RAISE EXCEPTION 'Permissão negada para a empresa %', _company USING ERRCODE = '42501';
  END IF;
  v_classified := public.reclassify_company(_company, true);
  v_snapshot := public.snapshot_kpis(_company, _date);
  RETURN jsonb_build_object(
    'classified_entries', v_classified,
    'kpi_snapshot_id', v_snapshot,
    'date', _date
  );
END $function$;

REVOKE ALL ON FUNCTION public.run_full_pipeline(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_full_pipeline(uuid, date) TO authenticated;

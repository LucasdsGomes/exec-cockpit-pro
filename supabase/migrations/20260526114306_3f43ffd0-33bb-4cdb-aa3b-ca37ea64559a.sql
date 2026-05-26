
CREATE OR REPLACE FUNCTION public.close_zombie_sync_batches(_max_age_minutes int DEFAULT 30)
RETURNS TABLE(closed_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  WITH upd AS (
    UPDATE public.omie_raw_sync_batches
       SET status = 'error',
           finished_at = now(),
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'auto_closed', 'zombie_batch',
                           'closed_at', now(),
                           'reason', format('running > %s minutes', _max_age_minutes)
                         )
     WHERE status IN ('running','pending')
       AND started_at < now() - make_interval(mins => _max_age_minutes)
     RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;

  -- Log each closed batch
  INSERT INTO public.omie_sync_logs (company_id, batch_id, source_endpoint, level, message, context)
  SELECT company_id, id, source_endpoint, 'warn',
         format('Batch zumbi fechado automaticamente (rodando há > %s min)', _max_age_minutes),
         jsonb_build_object('auto_closed', true)
    FROM public.omie_raw_sync_batches
   WHERE (metadata->>'auto_closed') = 'zombie_batch'
     AND finished_at > now() - interval '1 minute';

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_zombie_sync_batches(int) TO authenticated, service_role;

-- Aggregation function used by the admin errors panel.
CREATE OR REPLACE FUNCTION public.sync_errors_summary(_company uuid)
RETURNS TABLE(
  source_endpoint text,
  total_errors bigint,
  open_errors bigint,
  last_error_at timestamptz,
  last_error_message text,
  last_batch_status text,
  severity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      e.source_endpoint,
      COUNT(*) AS total_errors,
      COUNT(*) FILTER (WHERE NOT e.resolved) AS open_errors,
      MAX(e.created_at) AS last_error_at
    FROM public.omie_sync_errors e
    WHERE e.company_id = _company
    GROUP BY e.source_endpoint
  ),
  last_msg AS (
    SELECT DISTINCT ON (source_endpoint)
      source_endpoint, error_message, created_at
    FROM public.omie_sync_errors
    WHERE company_id = _company
    ORDER BY source_endpoint, created_at DESC
  ),
  last_batch AS (
    SELECT DISTINCT ON (source_endpoint)
      source_endpoint, status::text AS status
    FROM public.omie_raw_sync_batches
    WHERE company_id = _company
    ORDER BY source_endpoint, started_at DESC
  )
  SELECT
    a.source_endpoint,
    a.total_errors,
    a.open_errors,
    a.last_error_at,
    lm.error_message AS last_error_message,
    lb.status AS last_batch_status,
    CASE
      WHEN a.open_errors >= 10 OR lb.status IN ('error','failed') THEN 'critical'
      WHEN a.open_errors > 0 THEN 'warning'
      ELSE 'ok'
    END AS severity
  FROM agg a
  LEFT JOIN last_msg lm ON lm.source_endpoint = a.source_endpoint
  LEFT JOIN last_batch lb ON lb.source_endpoint = a.source_endpoint
  ORDER BY
    CASE
      WHEN a.open_errors >= 10 OR lb.status IN ('error','failed') THEN 0
      WHEN a.open_errors > 0 THEN 1
      ELSE 2
    END,
    a.last_error_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.sync_errors_summary(uuid) TO authenticated, service_role;

-- Module B: Bank Movements enhancement (Lançamentos de Conta Corrente)

-- 1. Enum for movement kind
DO $$ BEGIN
  CREATE TYPE public.bank_movement_kind AS ENUM (
    'extrato', 'lancamento_cc', 'transferencia', 'tarifa', 'juros', 'rendimento', 'manual', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend bank_movements
ALTER TABLE public.bank_movements
  ADD COLUMN IF NOT EXISTS source_endpoint text,
  ADD COLUMN IF NOT EXISTS kind public.bank_movement_kind NOT NULL DEFAULT 'extrato',
  ADD COLUMN IF NOT EXISTS category_raw text,
  ADD COLUMN IF NOT EXISTS category_mapped text,
  ADD COLUMN IF NOT EXISTS transfer_pair_id uuid REFERENCES public.bank_movements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Unique constraint: same source can be ingested only once
CREATE UNIQUE INDEX IF NOT EXISTS uq_bm_company_endpoint_source
  ON public.bank_movements (company_id, source_endpoint, source_record_id)
  WHERE source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bm_kind ON public.bank_movements (company_id, kind);

-- 3. Update mirror trigger to skip non-cash kinds (transferencia is internal)
CREATE OR REPLACE FUNCTION public.tg_mirror_bank_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_signed NUMERIC;
  v_group TEXT;
BEGIN
  -- Skip transfers between own accounts (net zero)
  IF NEW.kind = 'transferencia' THEN
    RETURN NEW;
  END IF;

  v_signed := CASE WHEN NEW.direction = 'entrada' THEN ABS(NEW.amount) ELSE -ABS(NEW.amount) END;
  v_group := CASE NEW.kind
    WHEN 'tarifa' THEN 'Despesas Financeiras'
    WHEN 'juros' THEN 'Despesas Financeiras'
    WHEN 'rendimento' THEN 'Receitas Financeiras'
    ELSE 'Movimentação Bancária'
  END;

  INSERT INTO public.dfc_realized_base (
    company_id, source_entry_id, cash_date, bank_account_id,
    dfc_group, dfc_subgroup, flow_type, category_mapped, amount, amount_signed
  ) VALUES (
    NEW.company_id, NEW.financial_entry_id, NEW.movement_date, NEW.bank_account_id,
    v_group, NEW.category_mapped, 'operacional'::flow_type,
    COALESCE(NEW.category_mapped, NEW.description, 'Movimentação'),
    ABS(NEW.amount), v_signed
  );
  RETURN NEW;
END $function$;

-- 4. Enhanced reconciliation: skip non-AP/AR kinds and avoid duplicating already-linked
CREATE OR REPLACE FUNCTION public.reconcile_bank_movements(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_matched integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      bm.id AS bm_id,
      fe.id AS fe_id,
      ROW_NUMBER() OVER (
        PARTITION BY bm.id
        ORDER BY ABS(EXTRACT(EPOCH FROM (bm.movement_date::timestamp - COALESCE(fe.cash_date, fe.due_date)::timestamp)))
      ) AS rn
    FROM public.bank_movements bm
    JOIN public.financial_entries fe
      ON fe.company_id = bm.company_id
     AND fe.bank_account_id = bm.bank_account_id
     AND fe.direction = bm.direction
     AND fe.amount = bm.amount
     AND COALESCE(fe.cash_date, fe.due_date) BETWEEN bm.movement_date - INTERVAL '2 days'
                                                 AND bm.movement_date + INTERVAL '2 days'
    WHERE bm.company_id = _company
      AND bm.financial_entry_id IS NULL
      AND bm.kind IN ('extrato','lancamento_cc')
  )
  UPDATE public.bank_movements bm
  SET financial_entry_id = c.fe_id,
      reconciled = true,
      updated_at = now()
  FROM candidates c
  WHERE c.rn = 1 AND bm.id = c.bm_id;
  GET DIAGNOSTICS v_matched = ROW_COUNT;

  RETURN jsonb_build_object('matched', v_matched);
END;
$function$;

-- 5. Pair internal transfers (entrada + saida em contas diferentes mesmo dia, mesmo valor)
CREATE OR REPLACE FUNCTION public.pair_bank_transfers(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_paired integer := 0;
BEGIN
  WITH pairs AS (
    SELECT DISTINCT ON (a.id) a.id AS a_id, b.id AS b_id
    FROM public.bank_movements a
    JOIN public.bank_movements b
      ON a.company_id = b.company_id
     AND a.amount = b.amount
     AND a.bank_account_id <> b.bank_account_id
     AND a.direction = 'saida' AND b.direction = 'entrada'
     AND b.movement_date BETWEEN a.movement_date - INTERVAL '1 day' AND a.movement_date + INTERVAL '1 day'
    WHERE a.company_id = _company
      AND a.transfer_pair_id IS NULL
      AND b.transfer_pair_id IS NULL
      AND (a.description ILIKE '%transf%' OR b.description ILIKE '%transf%'
           OR a.kind = 'transferencia' OR b.kind = 'transferencia')
    ORDER BY a.id, ABS(EXTRACT(EPOCH FROM (a.movement_date::timestamp - b.movement_date::timestamp)))
  )
  UPDATE public.bank_movements bm
  SET transfer_pair_id = CASE WHEN bm.id = p.a_id THEN p.b_id ELSE p.a_id END,
      kind = 'transferencia',
      updated_at = now()
  FROM pairs p
  WHERE bm.id IN (p.a_id, p.b_id);
  GET DIAGNOSTICS v_paired = ROW_COUNT;
  RETURN jsonb_build_object('paired', v_paired);
END;
$function$;
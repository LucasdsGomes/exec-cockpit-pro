-- Module C: Projects & Tags

-- 1. projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_system text NOT NULL DEFAULT 'omie',
  source_record_id text,
  code text NOT NULL,
  name text NOT NULL,
  status text,
  start_date date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company_id, active);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_member" ON public.projects FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));
CREATE POLICY "projects_modify_editor" ON public.projects FOR ALL TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

CREATE TRIGGER tg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_system text NOT NULL DEFAULT 'omie',
  source_record_id text,
  code text NOT NULL,
  description text NOT NULL,
  color text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_tags_company ON public.tags(company_id, active);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_member" ON public.tags FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));
CREATE POLICY "tags_modify_editor" ON public.tags FOR ALL TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

CREATE TRIGGER tg_tags_updated BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. entry_tags (many-to-many)
CREATE TABLE IF NOT EXISTS public.entry_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financial_entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_tags_company ON public.entry_tags(company_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON public.entry_tags(financial_entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON public.entry_tags(tag_id);

ALTER TABLE public.entry_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entry_tags_select_member" ON public.entry_tags FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.current_user_companies()));
CREATE POLICY "entry_tags_modify_editor" ON public.entry_tags FOR ALL TO authenticated
  USING (public.can_edit_company(company_id))
  WITH CHECK (public.can_edit_company(company_id));

-- 4. Add project_id to financial_entries
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_fe_project ON public.financial_entries(company_id, project_id) WHERE project_id IS NOT NULL;

-- 5. Linker: scan metadata to attach project_id
CREATE OR REPLACE FUNCTION public.link_financial_entries_to_projects(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_linked integer := 0;
BEGIN
  WITH candidates AS (
    SELECT fe.id AS fe_id, p.id AS p_id
    FROM public.financial_entries fe
    JOIN public.projects p ON p.company_id = fe.company_id
    WHERE fe.company_id = _company
      AND fe.project_id IS NULL
      AND (
        fe.metadata->'cabecTitulo'->>'codigo_projeto' = p.source_record_id
        OR fe.metadata->>'codigo_projeto' = p.source_record_id
        OR fe.metadata->'cabecTitulo'->>'cCodProj' = p.source_record_id
      )
  )
  UPDATE public.financial_entries fe
  SET project_id = c.p_id, updated_at = now()
  FROM candidates c
  WHERE fe.id = c.fe_id;
  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RETURN jsonb_build_object('linked', v_linked);
END;
$function$;
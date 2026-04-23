-- Function to validate email domain
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  v_domain := lower(split_part(NEW.email, '@', 2));

  IF v_domain NOT IN ('hitech-e.com.br', 'milen-ia.com') THEN
    RAISE EXCEPTION 'Email domain not allowed. Only @hitech-e.com.br and @milen-ia.com are permitted.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS validate_email_domain_trigger ON auth.users;

CREATE TRIGGER validate_email_domain_trigger
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_email_domain();
CREATE OR REPLACE FUNCTION public._achat_set_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(NEW.reference, '') IS NULL THEN
    NEW.reference := public._next_ref('APP', 'public.achats'::regclass, 'reference');
  END IF;
  RETURN NEW;
END;
$$;
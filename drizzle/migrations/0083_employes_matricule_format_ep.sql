-- Nouveau format de matricule employé : EP-01, EP-02 … EP-99, EP-100… (sans plafond)

-- 1. Génération automatique à la création
CREATE OR REPLACE FUNCTION public._employe_set_matricule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NULLIF(NEW.matricule, '') IS NULL THEN
    NEW.matricule := 'EP-' || lpad(nextval('public.employe_ref_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. RPC de renumérotation : ordre d'ancienneté (date_embauche, puis created_at),
--    passage par des valeurs temporaires pour éviter toute collision, séquence recalée.
CREATE OR REPLACE FUNCTION public.renumber_employes_matricules(_prefix text DEFAULT 'EP')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; v_n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='42501';
  END IF;
  UPDATE public.employes SET matricule = 'TMP-' || employe_id::text;
  FOR r IN SELECT employe_id FROM public.employes ORDER BY date_embauche ASC NULLS LAST, created_at ASC LOOP
    v_n := v_n + 1;
    UPDATE public.employes SET matricule = _prefix || '-' || lpad(v_n::text, 2, '0')
     WHERE employe_id = r.employe_id;
  END LOOP;
  PERFORM setval('public.employe_ref_seq', GREATEST(v_n, 1));
  RETURN v_n;
END;
$function$;

-- 3. Conversion unique des employés existants (backfill lié au changement de format)
UPDATE public.employes SET matricule = 'TMP-' || employe_id::text;
WITH ordered AS (
  SELECT employe_id,
         row_number() OVER (ORDER BY date_embauche ASC NULLS LAST, created_at ASC) AS n
  FROM public.employes
)
UPDATE public.employes e
   SET matricule = 'EP-' || lpad(o.n::text, 2, '0')
  FROM ordered o
 WHERE o.employe_id = e.employe_id;
SELECT setval('public.employe_ref_seq', GREATEST((SELECT count(*) FROM public.employes), 1));

-- 4. Unicité et contrôle de format
ALTER TABLE public.employes ADD CONSTRAINT employes_matricule_unique UNIQUE (matricule);
ALTER TABLE public.employes ADD CONSTRAINT employes_matricule_format_chk CHECK (matricule ~ '^EP-[0-9]{2,}$');
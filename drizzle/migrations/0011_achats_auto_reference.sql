-- Génération automatique de la référence des approvisionnements (APP-YYYY-00001)
CREATE OR REPLACE FUNCTION public._achat_set_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(NEW.reference, '') IS NULL THEN
    NEW.reference := public._next_ref('achats', 'reference', 'APP');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achats_set_reference ON public.achats;
CREATE TRIGGER trg_achats_set_reference
BEFORE INSERT ON public.achats
FOR EACH ROW EXECUTE FUNCTION public._achat_set_reference();

-- Backfill des approvisionnements existants sans référence
WITH num AS (
  SELECT achat_id,
         to_char(date_achat, 'YYYY') AS y,
         row_number() OVER (PARTITION BY to_char(date_achat, 'YYYY') ORDER BY date_achat, created_at) AS rn
  FROM public.achats
  WHERE NULLIF(reference, '') IS NULL
)
UPDATE public.achats a
SET reference = 'APP-' || num.y || '-' || lpad(num.rn::text, 5, '0')
FROM num
WHERE a.achat_id = num.achat_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_achats_reference ON public.achats(reference) WHERE reference <> '';
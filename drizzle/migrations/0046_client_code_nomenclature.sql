CREATE TABLE IF NOT EXISTS public.client_code_counters (
  prefix text PRIMARY KEY,
  last_num integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.client_code_counters TO authenticated;
GRANT ALL ON public.client_code_counters TO service_role;
ALTER TABLE public.client_code_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture compteurs codes clients" ON public.client_code_counters FOR SELECT TO authenticated USING (true);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ancien_code text;
COMMENT ON COLUMN public.clients.ancien_code IS 'Ancien code client avant la nomenclature CL-[TYPE]-[N]';

CREATE OR REPLACE FUNCTION public.client_type_prefix(_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE regexp_replace(lower(coalesce(btrim(_type),'')), 's$', '')
    WHEN 'librairie' THEN 'LIB' WHEN 'lycee' THEN 'LYC' WHEN 'college' THEN 'COL'
    WHEN 'groupe_scolaire' THEN 'GSC' WHEN 'epp' THEN 'EPP' WHEN 'ecole' THEN 'ECO'
    WHEN 'institut' THEN 'INS' WHEN 'catholique' THEN 'CAT' WHEN 'methodiste' THEN 'MET'
    WHEN 'iep' THEN 'IEP' WHEN 'dren' THEN 'DRN' WHEN 'inspecteur' THEN 'ISP'
    WHEN 'up' THEN 'UPE' WHEN 'memo' THEN 'MEM' WHEN 'particulier' THEN 'PAR'
    WHEN 'distributeur' THEN 'DIS' WHEN 'representant' THEN 'REP'
    ELSE 'AUT' END
$$;

CREATE OR REPLACE FUNCTION public.next_client_code(_type text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text := public.client_type_prefix(_type); n integer;
BEGIN
  INSERT INTO public.client_code_counters(prefix, last_num) VALUES (p, 1)
  ON CONFLICT (prefix) DO UPDATE SET last_num = client_code_counters.last_num + 1
  RETURNING last_num INTO n;
  RETURN 'CL-' || p || '-' || n;
END $$;
REVOKE EXECUTE ON FUNCTION public.next_client_code(text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.set_client_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reference IS NULL OR btrim(NEW.reference) = '' OR NEW.reference !~ '^CL-[A-Z]{3}-[1-9][0-9]*$' THEN
    IF NEW.reference IS NOT NULL AND btrim(NEW.reference) <> '' THEN NEW.ancien_code := coalesce(NEW.ancien_code, NEW.reference); END IF;
    NEW.reference := public.next_client_code(NEW.type_client);
  END IF;
  RETURN NEW;
END $$;

-- Backfill: renumérotation par type, ordre de création
UPDATE public.clients c SET ancien_code = c.reference,
  reference = 'CL-' || s.p || '-' || s.rn
FROM (SELECT client_id, public.client_type_prefix(type_client) p,
        row_number() OVER (PARTITION BY public.client_type_prefix(type_client) ORDER BY created_at, client_id) rn
      FROM public.clients) s
WHERE s.client_id = c.client_id AND c.reference !~ '^CL-[A-Z]{3}-[1-9][0-9]*$';

INSERT INTO public.client_code_counters(prefix, last_num)
SELECT split_part(reference,'-',2), max(split_part(reference,'-',3)::int)
FROM public.clients GROUP BY 1
ON CONFLICT (prefix) DO UPDATE SET last_num = GREATEST(client_code_counters.last_num, EXCLUDED.last_num);

CREATE UNIQUE INDEX IF NOT EXISTS clients_reference_uk ON public.clients(reference);
ALTER TABLE public.clients ADD CONSTRAINT clients_reference_format_chk CHECK (reference ~ '^CL-[A-Z]{3}-[1-9][0-9]*$');
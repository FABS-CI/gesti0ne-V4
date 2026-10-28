REVOKE ALL ON public.signature_keys FROM anon, authenticated;
GRANT SELECT (key_id, algorithm, public_key, is_active, created_at, retired_at) ON public.signature_keys TO anon, authenticated;
GRANT ALL ON public.signature_keys TO service_role;
COMMENT ON COLUMN public.signature_keys.secret_name IS 'Nom du secret de signature : jamais lisible par anon/authenticated (droits par colonne).';
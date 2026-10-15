DO $$ DECLARE c text; BEGIN
FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.document_theme_settings'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%theme_global%' LOOP
EXECUTE format('ALTER TABLE public.document_theme_settings DROP CONSTRAINT %I', c); END LOOP; END $$;
ALTER TABLE public.document_theme_settings ADD CONSTRAINT document_theme_settings_theme_global_check CHECK (theme_global IN ('bleu','ardoise','vert','indigo','bordeaux','cuivre'));
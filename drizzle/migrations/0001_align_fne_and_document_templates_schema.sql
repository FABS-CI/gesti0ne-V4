-- Align stub tables with the application contract (all tables are empty; additive only)

-- 1) document_templates
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS template_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.document_templates ALTER COLUMN code SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.document_templates ALTER COLUMN libelle SET DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS document_templates_template_id_key ON public.document_templates (template_id);

-- 2) document_template_prefs
ALTER TABLE public.document_template_prefs
  ADD COLUMN IF NOT EXISTS active_template_id TEXT;

-- 3) fne_settings (key/value store used by the app)
ALTER TABLE public.fne_settings
  ADD COLUMN IF NOT EXISTS setting_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cle TEXT,
  ADD COLUMN IF NOT EXISTS valeur TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS fne_settings_setting_id_key ON public.fne_settings (setting_id);
CREATE UNIQUE INDEX IF NOT EXISTS fne_settings_cle_key ON public.fne_settings (cle) WHERE cle IS NOT NULL;

-- 4) fne_factures
ALTER TABLE public.fne_factures
  ADD COLUMN IF NOT EXISTS fne_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS code_dgi TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_nom TEXT,
  ADD COLUMN IF NOT EXISTS client_ncc TEXT,
  ADD COLUMN IF NOT EXISTS client_telephone TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS client_seller_name TEXT,
  ADD COLUMN IF NOT EXISTS template TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS invoice_type TEXT,
  ADD COLUMN IF NOT EXISTS commercial_message TEXT,
  ADD COLUMN IF NOT EXISTS footer TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS montant NUMERIC,
  ADD COLUMN IF NOT EXISTS date_emission DATE,
  ADD COLUMN IF NOT EXISTS point_of_sale TEXT,
  ADD COLUMN IF NOT EXISTS establishment TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS token TEXT,
  ADD COLUMN IF NOT EXISTS verification_url TEXT,
  ADD COLUMN IF NOT EXISTS response_payload JSONB,
  ADD COLUMN IF NOT EXISTS balance_sticker NUMERIC,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS parent_fne_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS fne_factures_fne_id_key ON public.fne_factures (fne_id);
CREATE INDEX IF NOT EXISTS fne_factures_facture_id_idx ON public.fne_factures (facture_id);

-- 5) fne_logs
ALTER TABLE public.fne_logs
  ADD COLUMN IF NOT EXISTS fne_facture_id UUID,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS statut TEXT,
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS response JSONB;
CREATE INDEX IF NOT EXISTS fne_logs_fne_facture_id_idx ON public.fne_logs (fne_facture_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_template_prefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fne_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fne_factures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fne_logs TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
GRANT ALL ON public.document_template_prefs TO service_role;
GRANT ALL ON public.fne_settings TO service_role;
GRANT ALL ON public.fne_factures TO service_role;
GRANT ALL ON public.fne_logs TO service_role;
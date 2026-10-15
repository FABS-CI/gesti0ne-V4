CREATE OR REPLACE FUNCTION public.is_rbac3_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rbac3_user_roles WHERE user_id = _uid AND role_code = 'super_admin');
$$;

CREATE TABLE public.document_theme_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  theme_global text NOT NULL DEFAULT 'bleu' CHECK (theme_global IN ('bleu','ardoise','vert','indigo')),
  theme_par_type jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.document_theme_settings TO authenticated;
GRANT ALL ON public.document_theme_settings TO service_role;
ALTER TABLE public.document_theme_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture authentifiée" ON public.document_theme_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertion super admin" ON public.document_theme_settings FOR INSERT TO authenticated WITH CHECK (public.is_rbac3_super_admin(auth.uid()));
CREATE POLICY "Mise à jour super admin" ON public.document_theme_settings FOR UPDATE TO authenticated USING (public.is_rbac3_super_admin(auth.uid())) WITH CHECK (public.is_rbac3_super_admin(auth.uid()));
INSERT INTO public.document_theme_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
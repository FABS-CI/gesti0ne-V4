DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.report_reconciliation_finance()'::regprocedure) INTO d;
  d := replace(d, 'public.is_staff(auth.uid())',
    'public.has_role(auth.uid(),''directeur_general'') OR public.has_role(auth.uid(),''comptable'') OR public.has_role(auth.uid(),''assistante_comptable'')');
  EXECUTE d;
END $$;
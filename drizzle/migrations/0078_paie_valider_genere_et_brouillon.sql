CREATE OR REPLACE FUNCTION public.paie_valider_bulletin(p_bulletin_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (rbac3_can('rh.modifier', auth.uid()) OR is_hr(auth.uid())) THEN
    RAISE EXCEPTION 'Droit insuffisant pour valider un bulletin';
  END IF;
  UPDATE bulletins_paie SET statut = 'valide', updated_at = now()
   WHERE bulletin_id = p_bulletin_id AND statut IN ('brouillon','genere');
  IF NOT FOUND THEN RAISE EXCEPTION 'Bulletin introuvable ou déjà validé'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.paie_valider_bulletin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paie_valider_bulletin(uuid) TO authenticated;
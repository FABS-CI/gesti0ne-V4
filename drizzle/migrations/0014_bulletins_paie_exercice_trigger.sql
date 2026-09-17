DROP TRIGGER IF EXISTS trg_bulletins_paie_set_exercice ON public.bulletins_paie;
CREATE TRIGGER trg_bulletins_paie_set_exercice
  BEFORE INSERT ON public.bulletins_paie
  FOR EACH ROW EXECUTE FUNCTION public._set_exercice_id_before_insert();
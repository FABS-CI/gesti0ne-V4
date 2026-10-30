-- États financiers annuels, phase 1 : fiabilité des données.
--   1. Balances importées : pour un exercice sans écritures dans l'ERP (historique
--      antérieur à l'ERP, colonne N-1, soldes d'ouverture). Les écritures de l'ERP
--      restent prioritaires ; le choix de la source est fait par l'application.
--      Chaque import crée un lot ; un nouvel import remplace le lot actif sans
--      effacer l'ancien (remplace_le), pour garder la trace de ce qui a servi.
--   2. etats_financiers_completude : contrôles serveur des données d'un exercice
--      (écritures déséquilibrées, factures non comptabilisées, paie validée).
-- Numéro 0103 : 0101 et 0102 sont pris par la branche fix/rh-paie-integrite.

CREATE TABLE IF NOT EXISTS public.balances_importees_lots (
  lot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id uuid NOT NULL REFERENCES public.exercices_comptables(exercice_id) ON DELETE RESTRICT,
  fichier text,
  nb_comptes integer NOT NULL,
  total_debit numeric NOT NULL,
  total_credit numeric NOT NULL,
  -- Mouvements de l'exercice fournis (balance à 6 colonnes) : nécessaires au TFT.
  avec_mouvements boolean NOT NULL DEFAULT false,
  importe_par uuid DEFAULT auth.uid(),
  importe_le timestamptz NOT NULL DEFAULT now(),
  remplace_le timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS balances_importees_lots_actif
  ON public.balances_importees_lots (exercice_id) WHERE remplace_le IS NULL;

CREATE TABLE IF NOT EXISTS public.balances_importees (
  lot_id uuid NOT NULL REFERENCES public.balances_importees_lots(lot_id) ON DELETE RESTRICT,
  numero_compte text NOT NULL,
  libelle text,
  -- Solde de clôture : positif débiteur, négatif créditeur.
  solde numeric NOT NULL,
  mvt_debit numeric,
  mvt_credit numeric,
  PRIMARY KEY (lot_id, numero_compte)
);

ALTER TABLE public.balances_importees_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances_importees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.balances_importees_lots, public.balances_importees FROM anon;
-- Lecture : droit comptable ; écriture uniquement par etats_financiers_importer_balance.
DROP POLICY IF EXISTS balances_importees_lots_read ON public.balances_importees_lots;
CREATE POLICY balances_importees_lots_read ON public.balances_importees_lots FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'comptabilite.voir'));
DROP POLICY IF EXISTS balances_importees_read ON public.balances_importees;
CREATE POLICY balances_importees_read ON public.balances_importees FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'comptabilite.voir'));

-- p_lignes : [{ "compte": "4111", "libelle": "Clients", "solde": 53781256,
--               "mvt_debit": 0, "mvt_credit": 0 }]  (mouvements facultatifs)
CREATE OR REPLACE FUNCTION public.etats_financiers_importer_balance(
  p_exercice_id uuid, p_fichier text, p_lignes jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lot uuid; v_n integer; v_d numeric; v_c numeric; v_mvt boolean; v_doublon text; v_invalide text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.modifier' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exercices_comptables WHERE exercice_id = p_exercice_id) THEN
    RAISE EXCEPTION 'Exercice inconnu';
  END IF;
  IF jsonb_typeof(p_lignes) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Format de balance invalide';
  END IF;

  CREATE TEMP TABLE _bal ON COMMIT DROP AS
    SELECT btrim(l.compte) AS compte, nullif(btrim(l.libelle), '') AS libelle,
           round(coalesce(l.solde, 0), 2) AS solde, l.mvt_debit, l.mvt_credit
      FROM jsonb_to_recordset(p_lignes)
        AS l(compte text, libelle text, solde numeric, mvt_debit numeric, mvt_credit numeric);

  SELECT compte INTO v_invalide FROM _bal WHERE compte IS NULL OR compte !~ '^[1-9][0-9]*$' LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Numéro de compte invalide : « % »', coalesce(v_invalide, '');
  END IF;
  SELECT compte INTO v_doublon FROM _bal GROUP BY compte HAVING count(*) > 1 LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Compte en double dans la balance : %', v_doublon; END IF;

  SELECT count(*), coalesce(sum(greatest(solde, 0)), 0), coalesce(sum(greatest(-solde, 0)), 0),
         bool_and(mvt_debit IS NOT NULL AND mvt_credit IS NOT NULL)
    INTO v_n, v_d, v_c, v_mvt FROM _bal;
  IF v_n = 0 THEN RAISE EXCEPTION 'Balance vide'; END IF;
  -- Une balance de clôture complète (classes 1 à 7) est équilibrée.
  IF abs(v_d - v_c) > 1 THEN
    RAISE EXCEPTION 'Balance déséquilibrée : soldes débiteurs % ≠ soldes créditeurs %', v_d, v_c;
  END IF;

  UPDATE public.balances_importees_lots SET remplace_le = now()
   WHERE exercice_id = p_exercice_id AND remplace_le IS NULL;
  INSERT INTO public.balances_importees_lots
    (exercice_id, fichier, nb_comptes, total_debit, total_credit, avec_mouvements)
  VALUES (p_exercice_id, p_fichier, v_n, v_d, v_c, coalesce(v_mvt, false))
  RETURNING lot_id INTO v_lot;
  INSERT INTO public.balances_importees (lot_id, numero_compte, libelle, solde, mvt_debit, mvt_credit)
    SELECT v_lot, compte, libelle, solde, mvt_debit, mvt_credit FROM _bal;
  RETURN v_lot;
END $$;
REVOKE ALL ON FUNCTION public.etats_financiers_importer_balance(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_importer_balance(uuid, text, jsonb) TO authenticated;

-- Contrôles de complétude d'une période, calculés sur les données réelles.
CREATE OR REPLACE FUNCTION public.etats_financiers_completude(p_debut date, p_fin date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;
  WITH ec AS (
    SELECT ec.ecriture_id, ec.exercice_id, ec.date_ecriture, ec.journal
      FROM public.ecritures_comptables ec
     WHERE ec.date_ecriture BETWEEN p_debut AND p_fin
  ), deseq AS (
    SELECT ec.ecriture_id
      FROM ec JOIN public.ecriture_lignes el ON el.ecriture_id = ec.ecriture_id
     GROUP BY ec.ecriture_id
    HAVING abs(sum(coalesce(el.debit, 0)) - sum(coalesce(el.credit, 0))) > 0.5
  ), fact AS (
    SELECT f.facture_id, f.montant_total
      FROM public.factures f
     WHERE f.date_facture BETWEEN p_debut AND p_fin
       AND f.statut <> 'annulee' AND coalesce(f.montant_total, 0) <> 0
       AND NOT EXISTS (SELECT 1 FROM public.ecritures_comptables e
                        WHERE e.piece_ref = 'FACT:' || f.facture_id::text)
  ), paie AS (
    SELECT b.salaire_brut
      FROM public.bulletins_paie b
     WHERE b.statut IN ('valide', 'paye')
       AND coalesce(b.date_fin, b.date_bulletin, b.date_etablissement) BETWEEN p_debut AND p_fin
  )
  SELECT jsonb_build_object(
    'ecritures_periode', (SELECT count(*) FROM ec),
    'ecritures_avant', (SELECT count(*) FROM public.ecritures_comptables WHERE date_ecriture < p_debut),
    'ecritures_sans_exercice', (SELECT count(*) FROM ec WHERE exercice_id IS NULL),
    -- La clôture de l'ERP ne passe pas d'à-nouveaux (balances cumulées) : un journal
    -- d'à-nouveaux saisi à la main ferait double emploi avec les soldes antérieurs.
    'ecritures_a_nouveaux', (SELECT count(*) FROM ec WHERE upper(coalesce(ec.journal, '')) IN ('AN', 'RAN')),
    'ecritures_desequilibrees', (SELECT count(*) FROM deseq),
    'factures_non_comptabilisees', (SELECT count(*) FROM fact),
    'factures_non_comptabilisees_montant', (SELECT coalesce(sum(montant_total), 0) FROM fact),
    'bulletins_valides', (SELECT count(*) FROM paie),
    'paie_brut', (SELECT coalesce(sum(salaire_brut), 0) FROM paie)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.etats_financiers_completude(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_completude(date, date) TO authenticated;

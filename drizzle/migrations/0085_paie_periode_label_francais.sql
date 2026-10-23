-- Libellé de période en français : « Octobre 2026 » au lieu de « 2026-10 »

-- 1. Libellé français (mois en lettres, majuscule, année)
CREATE OR REPLACE FUNCTION public.paie_periode_label(_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _date IS NULL THEN NULL
    ELSE (ARRAY['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'])[EXTRACT(MONTH FROM _date)::int]
         || ' ' || TO_CHAR(_date, 'YYYY')
  END;
$$;

-- 2. Enregistrement d'un bulletin : la période stockée suit ce libellé
CREATE OR REPLACE FUNCTION public.paie_enregistrer_bulletin(p_employe_id uuid, p_date_debut date, p_date_fin date, p_saisie jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE c jsonb; e record; v_id uuid; s jsonb := COALESCE(p_saisie,'{}'::jsonb);
BEGIN
  c := paie_calculer_bulletin(p_employe_id, p_date_debut, p_date_fin, s);
  SELECT * INTO e FROM employes WHERE employe_id = p_employe_id;
  INSERT INTO bulletins_paie (reference, employe_id, employe_nom, periode, date_bulletin, date_debut, date_fin,
    date_etablissement, date_paiement, mode_paiement, jours_travailles, regime_code, parts, saisie, snapshot,
    salaire_brut, brut_imposable, cotisations, retenues, total_indemnites_non_imposables, total_autres_retenues,
    arrondi, net_a_payer, salaire_net, cout_salarial, statut)
  VALUES (_next_ref('BUL', 'public.bulletins_paie'::regclass, 'reference'), p_employe_id,
    COALESCE(e.nom_complet, e.prenoms), public.paie_periode_label(p_date_fin), CURRENT_DATE,
    p_date_debut, p_date_fin, COALESCE((s->>'date_etablissement')::date, CURRENT_DATE),
    (s->>'date_paiement')::date, COALESCE(s->>'mode_paiement', e.mode_paiement_defaut, e.mode_paiement),
    (c->>'jours')::numeric, c->>'regime', (c->>'parts')::numeric, s, c->'snapshot',
    (c->>'brut_imposable')::numeric + (c->>'non_imposable')::numeric, (c->>'brut_imposable')::numeric,
    (c->'patronal'->>'total')::numeric, (c->>'total_retenues_fs')::numeric + (c->>'autres_retenues')::numeric,
    (c->>'non_imposable')::numeric, (c->>'autres_retenues')::numeric, (c->>'arrondi')::numeric,
    (c->>'net')::numeric, (c->>'net')::numeric, (c->>'cout_salarial')::numeric, 'brouillon')
  RETURNING bulletin_id INTO v_id;

  INSERT INTO bulletin_lignes (bulletin_id, code, libelle, numero_rubrique, designation, nombre, base, taux,
    montant, gain, retenue, type, bloc, ordre)
  SELECT v_id, x->>'n', x->>'d', x->>'n', x->>'d', (x->>'nb')::numeric, COALESCE((x->>'b')::numeric,0), COALESCE((x->>'t')::numeric,0),
    (x->>'g')::numeric + (x->>'r')::numeric, (x->>'g')::numeric, (x->>'r')::numeric,
    CASE WHEN (x->>'g')::numeric > 0 THEN 'gain' ELSE 'retenue' END, x->>'bl', o
  FROM jsonb_array_elements(c->'lignes') WITH ORDINALITY t(x, o);
  RETURN v_id;
END $function$;

-- 3. Bulletins déjà enregistrés : périodes « 2026-10 » écrites en français
UPDATE public.bulletins_paie
SET periode = public.paie_periode_label(date_fin)
WHERE date_fin IS NOT NULL
  AND periode ~ '^[0-9]{4}-[0-9]{2}$';
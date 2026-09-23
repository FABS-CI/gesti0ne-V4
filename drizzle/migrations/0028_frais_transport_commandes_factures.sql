-- 1) Colonnes additives (nullable) : un seul type de frais de transport, ou aucun
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS type_frais_transport text,
  ADD COLUMN IF NOT EXISTS montant_frais_transport numeric;

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS type_frais_transport text,
  ADD COLUMN IF NOT EXISTS montant_frais_transport numeric;

COMMENT ON COLUMN public.commandes.type_frais_transport IS 'NULL | livraison | expedition — un seul type possible par commande';
COMMENT ON COLUMN public.factures.type_frais_transport IS 'NULL | livraison | expedition — recopié depuis la commande à la validation';

-- 2) Cohérence type/montant
ALTER TABLE public.commandes
  DROP CONSTRAINT IF EXISTS commandes_frais_transport_chk;
ALTER TABLE public.commandes
  ADD CONSTRAINT commandes_frais_transport_chk CHECK (
    (type_frais_transport IS NULL
      AND COALESCE(montant_frais_transport, 0) = 0)
    OR (type_frais_transport IN ('livraison', 'expedition')
      AND montant_frais_transport IS NOT NULL
      AND montant_frais_transport >= 0)
  );

ALTER TABLE public.factures
  DROP CONSTRAINT IF EXISTS factures_frais_transport_chk;
ALTER TABLE public.factures
  ADD CONSTRAINT factures_frais_transport_chk CHECK (
    (type_frais_transport IS NULL
      AND COALESCE(montant_frais_transport, 0) = 0)
    OR (type_frais_transport IN ('livraison', 'expedition')
      AND montant_frais_transport IS NOT NULL
      AND montant_frais_transport >= 0)
  );

-- 3) Index pour le rapport transport
CREATE INDEX IF NOT EXISTS idx_factures_type_frais_transport
  ON public.factures (type_frais_transport)
  WHERE type_frais_transport IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commandes_type_frais_transport
  ON public.commandes (type_frais_transport)
  WHERE type_frais_transport IS NOT NULL;

-- 4) valider_commande : paramètres transport optionnels, transaction unique inchangée
CREATE OR REPLACE FUNCTION public.valider_commande(
  _commande_id uuid,
  _type_frais_transport text DEFAULT NULL,
  _montant_frais_transport numeric DEFAULT NULL
)
 RETURNS TABLE(facture_reference text, bl_reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cmd public.commandes;
  v_f_ref text := public._next_ref('FAC', 'public.factures', 'reference');
  v_bl_ref text := public._next_ref('BL', 'public.bons_livraison', 'reference');
  v_bl_id uuid;
  v_depot uuid;
  r record;
  v_dispo numeric;
  v_new_stock numeric;
  v_type text := NULLIF(btrim(COALESCE(_type_frais_transport, '')), '');
  v_frais numeric;
  v_total numeric;
BEGIN
  PERFORM public.assert_permission('commandes.valider');

  -- Contrôle du couple type / montant
  IF v_type IS NULL THEN
    IF COALESCE(_montant_frais_transport, 0) <> 0 THEN
      RAISE EXCEPTION 'Montant de transport sans type de frais de transport' USING ERRCODE = 'P0001';
    END IF;
    v_frais := NULL;
  ELSE
    IF v_type NOT IN ('livraison', 'expedition') THEN
      RAISE EXCEPTION 'Type de frais de transport invalide : %', v_type USING ERRCODE = 'P0001';
    END IF;
    IF _montant_frais_transport IS NULL THEN
      RAISE EXCEPTION 'Montant requis pour les frais de %', v_type USING ERRCODE = 'P0001';
    END IF;
    IF _montant_frais_transport < 0 THEN
      RAISE EXCEPTION 'Le montant des frais de transport ne peut pas être négatif' USING ERRCODE = 'P0001';
    END IF;
    v_frais := _montant_frais_transport;
  END IF;

  SELECT * INTO v_cmd FROM public.commandes WHERE commande_id = _commande_id FOR UPDATE;
  IF v_cmd.commande_id IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_cmd.statut = 'validee' THEN RAISE EXCEPTION 'Commande déjà validée'; END IF;
  IF v_cmd.statut = 'annulee' THEN RAISE EXCEPTION 'Commande annulée, impossible à valider'; END IF;

  v_depot := v_cmd.depot_id;
  IF v_depot IS NULL THEN
    SELECT depot_id INTO v_depot FROM public.depots WHERE is_principal = true LIMIT 1;
  END IF;
  IF v_depot IS NULL THEN
    RAISE EXCEPTION 'Aucun dépôt défini (ni sur la commande, ni comme dépôt principal)';
  END IF;

  -- 1) Décrément stock ligne par ligne (blocage si insuffisant)
  FOR r IN
    SELECT cl.produit_id, cl.quantite, cl.designation
    FROM public.commande_lignes cl
    WHERE cl.commande_id = _commande_id AND cl.produit_id IS NOT NULL
  LOOP
    SELECT quantite INTO v_dispo
    FROM public.stocks_depots
    WHERE produit_id = r.produit_id AND depot_id = v_depot
    FOR UPDATE;

    v_dispo := COALESCE(v_dispo, 0);
    IF v_dispo < r.quantite THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%": disponible %, demandé %',
        r.designation, v_dispo, r.quantite USING ERRCODE = 'P0001';
    END IF;

    v_new_stock := v_dispo - r.quantite;

    UPDATE public.stocks_depots
    SET quantite = v_new_stock, updated_at = now()
    WHERE produit_id = r.produit_id AND depot_id = v_depot;

    INSERT INTO public.stock_mouvements(
      produit_id, depot_id, type, quantite,
      quantite_entree, quantite_sortie, stock_resultant,
      origine, document_id, document_reference, document_table,
      user_id, motif
    ) VALUES (
      r.produit_id, v_depot, 'sortie', r.quantite,
      0, r.quantite, v_new_stock,
      'vente', _commande_id, v_cmd.reference, 'commandes',
      auth.uid(), 'Validation commande ' || COALESCE(v_cmd.reference,'')
    );
  END LOOP;

  -- 2) Frais de transport sur la commande + total facturé
  UPDATE public.commandes
  SET type_frais_transport = v_type,
      montant_frais_transport = v_frais
  WHERE commande_id = _commande_id;

  v_total := COALESCE(v_cmd.montant_total, 0) + COALESCE(v_frais, 0);

  -- 3) Facture + BL
  INSERT INTO public.factures(
    reference, client_id, client_nom, commande_id, exercice_id,
    date_facture, date_echeance, montant_total, statut,
    type_frais_transport, montant_frais_transport
  ) VALUES (
    v_f_ref, v_cmd.client_id, v_cmd.client_nom, _commande_id, v_cmd.exercice_id,
    current_date, current_date + 30, v_total, 'impayee',
    v_type, v_frais
  );

  INSERT INTO public.bons_livraison(
    reference, commande_id, client_id, client_nom, date_emission, statut, exercice_id
  ) VALUES (
    v_bl_ref, _commande_id, v_cmd.client_id, v_cmd.client_nom, current_date, 'a_preparer', v_cmd.exercice_id
  ) RETURNING bl_id INTO v_bl_id;

  UPDATE public.commandes SET statut = 'validee' WHERE commande_id = _commande_id;

  -- 4) Recalc solde client (nouvelle créance)
  PERFORM public._recalc_solde_client_internal(v_cmd.client_id);

  RETURN QUERY SELECT v_f_ref, v_bl_ref;
END; $function$;

GRANT EXECUTE ON FUNCTION public.valider_commande(uuid, text, numeric) TO authenticated;

-- 5) Rapport agrégé des frais de transport (RLS respectée : SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.rapport_frais_transport(
  _date_du date DEFAULT NULL,
  _date_au date DEFAULT NULL,
  _type text DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _statut text DEFAULT NULL,
  _exercice_id uuid DEFAULT NULL,
  _granularite text DEFAULT 'mois'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
WITH base AS (
  SELECT f.facture_id, f.reference, f.date_facture, f.client_id, f.client_nom,
         f.statut, f.montant_total, f.type_frais_transport,
         COALESCE(f.montant_frais_transport, 0) AS frais,
         c.reference AS commande_reference
  FROM public.factures f
  LEFT JOIN public.commandes c ON c.commande_id = f.commande_id
  WHERE f.type_frais_transport IS NOT NULL
    AND f.statut <> 'annulee'
    AND (_date_du IS NULL OR f.date_facture >= _date_du)
    AND (_date_au IS NULL OR f.date_facture <= _date_au)
    AND (_type IS NULL OR f.type_frais_transport = _type)
    AND (_client_id IS NULL OR f.client_id = _client_id)
    AND (_statut IS NULL OR f.statut = _statut)
    AND (_exercice_id IS NULL OR f.exercice_id = _exercice_id)
)
SELECT jsonb_build_object(
  'kpi', (SELECT jsonb_build_object(
      'total', COALESCE(SUM(frais), 0),
      'livraison', COALESCE(SUM(frais) FILTER (WHERE type_frais_transport = 'livraison'), 0),
      'expedition', COALESCE(SUM(frais) FILTER (WHERE type_frais_transport = 'expedition'), 0),
      'nb_factures', COUNT(*),
      'nb_commandes', COUNT(DISTINCT commande_reference),
      'moyenne', CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(SUM(frais) / COUNT(*)) END
    ) FROM base),
  'periodes', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'periode')
      FROM (
        SELECT jsonb_build_object(
          'periode', to_char(date_trunc(
            CASE _granularite WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week'
                              WHEN 'trimestre' THEN 'quarter' WHEN 'annee' THEN 'year'
                              ELSE 'month' END, date_facture), 'YYYY-MM-DD'),
          'livraison', COALESCE(SUM(frais) FILTER (WHERE type_frais_transport = 'livraison'), 0),
          'expedition', COALESCE(SUM(frais) FILTER (WHERE type_frais_transport = 'expedition'), 0),
          'total', SUM(frais)
        ) AS x
        FROM base
        GROUP BY date_trunc(
          CASE _granularite WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week'
                            WHEN 'trimestre' THEN 'quarter' WHEN 'annee' THEN 'year'
                            ELSE 'month' END, date_facture)
      ) s), '[]'::jsonb),
  'clients', COALESCE((SELECT jsonb_agg(x ORDER BY (x->>'total')::numeric DESC)
      FROM (
        SELECT jsonb_build_object('client', COALESCE(client_nom, '—'), 'total', SUM(frais)) AS x
        FROM base GROUP BY client_nom
      ) s), '[]'::jsonb),
  'lignes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'facture_id', facture_id,
        'facture', reference,
        'commande', commande_reference,
        'date', to_char(date_facture, 'DD/MM/YYYY'),
        'client', client_nom,
        'type', type_frais_transport,
        'transport', frais,
        'montant', montant_total,
        'statut', statut
      ) ORDER BY date_facture DESC) FROM base), '[]'::jsonb)
);
$function$;

GRANT EXECUTE ON FUNCTION public.rapport_frais_transport(date, date, text, uuid, text, uuid, text) TO authenticated;
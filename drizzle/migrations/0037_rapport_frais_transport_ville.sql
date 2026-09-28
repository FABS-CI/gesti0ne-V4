CREATE OR REPLACE FUNCTION public.rapport_frais_transport(_date_du date DEFAULT NULL::date, _date_au date DEFAULT NULL::date, _type text DEFAULT NULL::text, _client_id uuid DEFAULT NULL::uuid, _statut text DEFAULT NULL::text, _exercice_id uuid DEFAULT NULL::uuid, _granularite text DEFAULT 'mois'::text)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
WITH base AS (
  SELECT f.facture_id, f.reference, f.date_facture, f.client_id, f.client_nom,
         f.statut, f.montant_total, f.type_frais_transport,
         COALESCE(f.montant_frais_transport, 0) AS frais,
         c.reference AS commande_reference,
         NULLIF(btrim(COALESCE(NULLIF(btrim(c.ville), ''), cl.ville)), '') AS ville
  FROM public.factures f
  LEFT JOIN public.commandes c ON c.commande_id = f.commande_id
  LEFT JOIN public.clients cl ON cl.client_id = f.client_id
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
        SELECT jsonb_build_object('client', COALESCE(client_nom, '—'), 'client_id', client_id,
                                  'total', SUM(frais), 'nb', COUNT(*)) AS x
        FROM base GROUP BY client_nom, client_id
      ) s), '[]'::jsonb),
  'lignes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'facture_id', facture_id,
        'facture', reference,
        'commande', commande_reference,
        'date', to_char(date_facture, 'DD/MM/YYYY'),
        'date_iso', to_char(date_facture, 'YYYY-MM-DD'),
        'client', client_nom,
        'type', type_frais_transport,
        'transport', frais,
        'montant', montant_total,
        'statut', statut,
        'ville', ville
      ) ORDER BY date_facture DESC, reference DESC) FROM base), '[]'::jsonb)
);
$function$;
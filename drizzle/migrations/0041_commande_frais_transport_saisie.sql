DO $mig$
DECLARE
  d text;
  old1 text := E'    montant_total = v_ttc\n  WHERE commande_id = v_id;';
  old2 text := E'    depot_id = COALESCE(NULLIF(_payload->>''depot_id'','''')::uuid, depot_id)\n  WHERE commande_id = _commande_id;';
BEGIN
  -- creer_commande : enregistre les frais prévus sur la commande (colonnes existantes)
  d := pg_get_functiondef('public.creer_commande(jsonb)'::regprocedure);
  IF position('montant_frais_transport = CASE' in d) = 0 THEN
    IF position(old1 in d) = 0 THEN RAISE EXCEPTION 'creer_commande: motif introuvable'; END IF;
    d := replace(d, old1, E'    montant_total = v_ttc,\n    type_frais_transport = v_type_frais_transport,\n    montant_frais_transport = CASE WHEN v_type_frais_transport IS NULL THEN NULL ELSE v_montant_frais_transport END\n  WHERE commande_id = v_id;');
    d := replace(d, E'  PERFORM public.assert_permission(''commandes.creer'');\n', E'  PERFORM public.assert_permission(''commandes.creer'');\n  IF v_type_frais_transport IS NOT NULL THEN\n    IF v_type_frais_transport NOT IN (''livraison'',''expedition'') THEN\n      RAISE EXCEPTION ''Type de frais de transport invalide : %'', v_type_frais_transport USING ERRCODE = ''P0001'';\n    END IF;\n    IF v_montant_frais_transport IS NULL OR v_montant_frais_transport < 0 THEN\n      RAISE EXCEPTION ''Montant de transport invalide'' USING ERRCODE = ''P0001'';\n    END IF;\n  ELSIF COALESCE(v_montant_frais_transport,0) <> 0 THEN\n    RAISE EXCEPTION ''Montant de transport sans type de frais de transport'' USING ERRCODE = ''P0001'';\n  END IF;\n');
    EXECUTE d;
  END IF;

  -- modifier_commande : met à jour les frais prévus seulement s'ils sont fournis
  d := pg_get_functiondef('public.modifier_commande(uuid,jsonb)'::regprocedure);
  IF position('Frais de transport prévus' in d) = 0 THEN
    IF position(old2 in d) = 0 THEN RAISE EXCEPTION 'modifier_commande: motif introuvable'; END IF;
    d := replace(d, old2, old2 || E'\n\n  -- Frais de transport prévus (colonnes existantes)\n  IF _payload ? ''type_frais_transport'' THEN\n    DECLARE\n      v_t text := NULLIF(btrim(COALESCE(_payload->>''type_frais_transport'','''')), '''');\n      v_m numeric := NULLIF(_payload->>''montant_frais_transport'','''')::numeric;\n    BEGIN\n      IF v_t IS NOT NULL AND v_t NOT IN (''livraison'',''expedition'') THEN\n        RAISE EXCEPTION ''Type de frais de transport invalide : %'', v_t USING ERRCODE = ''P0001'';\n      END IF;\n      IF v_t IS NOT NULL AND (v_m IS NULL OR v_m < 0) THEN\n        RAISE EXCEPTION ''Montant de transport invalide'' USING ERRCODE = ''P0001'';\n      END IF;\n      UPDATE public.commandes SET\n        type_frais_transport = v_t,\n        montant_frais_transport = CASE WHEN v_t IS NULL THEN NULL ELSE v_m END\n      WHERE commande_id = _commande_id;\n    END;\n  END IF;');
    EXECUTE d;
  END IF;
END
$mig$;
CREATE OR REPLACE FUNCTION public._statut_libelle(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE v
    WHEN 'impayee' THEN 'Impayée' WHEN 'partielle' THEN 'Partielle' WHEN 'payee' THEN 'Payée'
    WHEN 'annulee' THEN 'Annulée' WHEN 'avoir' THEN 'Avoir' WHEN 'validee' THEN 'Validée'
    WHEN 'en_attente' THEN 'En attente' WHEN 'en_attente_validation' THEN 'En attente de validation'
    WHEN 'brouillon' THEN 'Brouillon' WHEN 'rejetee' THEN 'Rejetée'
    WHEN 'valide' THEN 'Validé' WHEN 'rejete' THEN 'Rejeté' WHEN 'annule' THEN 'Annulé'
    WHEN 'emise' THEN 'Émise' WHEN 'convertie' THEN 'Convertie' WHEN 'expiree' THEN 'Expirée'
    WHEN 'actif' THEN 'Actif' WHEN 'inactif' THEN 'Inactif' WHEN 'bloque' THEN 'Bloqué'
    WHEN 'livree' THEN 'Livrée' WHEN 'facturee' THEN 'Facturée' WHEN 'cloture' THEN 'Clôturé'
    ELSE coalesce(initcap(replace(v,'_',' ')), '—') END
$$;
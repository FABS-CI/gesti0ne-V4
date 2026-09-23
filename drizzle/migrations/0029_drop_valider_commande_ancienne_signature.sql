-- L'ancienne signature à 1 argument rendrait les appels valider_commande(uuid) ambigus
-- avec la nouvelle version à paramètres optionnels. Elle est remplacée, pas supprimée
-- fonctionnellement : la nouvelle fonction accepte exactement le même appel.
DROP FUNCTION IF EXISTS public.valider_commande(uuid);
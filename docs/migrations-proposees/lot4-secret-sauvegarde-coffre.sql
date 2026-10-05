-- PROPOSITION — NON APPLIQUÉE (lot 4, fichier-55). À valider avant exécution.
-- Objectif : le secret unique des sauvegardes planifiées ne doit plus être lu
-- en clair dans public.backup_cron_config, mais dans le coffre chiffré (Vault).
-- Migration additive : aucune table/colonne supprimée, aucune donnée effacée.
-- La valeur du secret est conservée à l'identique : la tâche de 3 h continue
-- de fonctionner pendant et après la bascule.

-- 1. Copier le jeton actuel dans le coffre (une seule fois).
SELECT vault.create_secret(
  (SELECT token FROM public.backup_cron_config WHERE id = 1),
  'backup_cron_token',
  'Secret unique des sauvegardes planifiées (en-tête x-backup-secret)'
)
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'backup_cron_token');

-- 2. Lecture réservée au serveur (service_role uniquement).
CREATE OR REPLACE FUNCTION public.get_backup_cron_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'backup_cron_token' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_backup_cron_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_backup_cron_token() TO service_role;

-- 3. La tâche de 3 h lit désormais le secret dans le coffre (même nom de tâche,
--    même horaire, même adresse : cron.schedule remplace la commande).
SELECT cron.schedule(
  'erp-global-backup-3h',
  '0 */3 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--a02a1c3e-8d53-45c8-a47f-0d8cbb0e64fa.lovable.app/api/public/backup/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Backup-Secret', public.get_backup_cron_token()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $job$
);

-- 4. Colonne en clair marquée comme retirée (non supprimée, non effacée).
COMMENT ON COLUMN public.backup_cron_config.token IS
  'DEPRECATED: secret déplacé dans vault (backup_cron_token), lire via get_backup_cron_token()';

-- Après application : basculer readExpectedToken() de src/lib/cron-auth.server.ts
-- sur supabaseAdmin.rpc("get_backup_cron_token"), puis (sur accord explicite)
-- remplacer la valeur en clair restante par une valeur aléatoire inutilisée.

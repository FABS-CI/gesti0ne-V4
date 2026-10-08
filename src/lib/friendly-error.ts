/**
 * Traduit une erreur brute (Supabase / PostgREST / RPC / réseau) en message
 * lisible par un utilisateur final francophone.
 *
 * Objectif MVP : plus jamais afficher "duplicate key value violates unique
 * constraint \"…_pkey\"" ou "new row violates row-level security policy"
 * dans un toast utilisateur.
 */

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const PG_CODE_MESSAGES: Record<string, string> = {
  "23505": "Enregistrement refusé : un élément identique existe déjà. Recherchez-le dans la liste ou changez la valeur en double.",
  "23503": "Action refusée : cet élément est utilisé par d'autres documents. Retirez-le d'abord de ces documents, ou désactivez-le au lieu de le supprimer.",
  "23502": "Enregistrement refusé : un champ obligatoire est vide. Complétez les champs marqués puis réessayez.",
  "23514": "Enregistrement refusé : une valeur ne respecte pas les règles (montant, quantité ou date). Corrigez-la puis réessayez.",
  "22001": "Enregistrement refusé : un texte saisi est trop long. Raccourcissez-le puis réessayez.",
  "22P02": "Enregistrement refusé : une valeur n'a pas le bon format (nombre ou date). Corrigez-la puis réessayez.",
  "42501": "Action refusée : votre rôle n'a pas ce droit. Demandez-le à un administrateur.",
  "42P01": "Élément introuvable : il a peut-être été supprimé. Rechargez la page.",
  "P0001": "", // raise exception métier — on utilise le message tel quel
  "PGRST301": "Action refusée : votre rôle n'a pas ce droit. Demandez-le à un administrateur.",
  "PGRST116": "Élément introuvable : il a peut-être été supprimé. Rechargez la page.",
};

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/row-level security|policy .* violated|not authorized/i,
    "Action refusée : votre rôle n'a pas ce droit. Demandez-le à un administrateur."],
  [/duplicate key|already exists/i,
    "Enregistrement refusé : un élément identique existe déjà. Recherchez-le dans la liste ou changez la valeur en double."],
  [/violates foreign key/i,
    "Action refusée : cet élément est utilisé par d'autres documents. Retirez-le d'abord de ces documents, ou désactivez-le au lieu de le supprimer."],
  [/not null|null value in column/i,
    "Enregistrement refusé : un champ obligatoire est vide. Complétez les champs marqués puis réessayez."],
  [/network|failed to fetch|networkerror/i,
    "Problème de connexion réseau. Vérifiez votre connexion et réessayez."],
  [/timeout|timed out/i,
    "Le serveur a mis trop de temps à répondre. Réessayez dans un instant."],
  [/jwt|token|expired|unauthorized|401/i,
    "Votre session a expiré. Reconnectez-vous pour continuer."],
];

export function friendlyError(err: unknown, fallback = "L'opération n'a pas abouti, sans cause précise renvoyée. Vérifiez votre connexion puis réessayez."): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;

  const e = err as SupabaseLikeError & Error;

  // 1. Erreur métier explicite (RAISE EXCEPTION côté RPC) — on garde le message tel quel
  if (e.code === "P0001" && e.message) return e.message;

  // 2. Code Postgres/PostgREST connu
  if (e.code && PG_CODE_MESSAGES[e.code]) return PG_CODE_MESSAGES[e.code];

  // 3. Patterns dans le message
  const msg = e.message ?? "";
  for (const [pattern, label] of MESSAGE_PATTERNS) {
    if (pattern.test(msg)) return label;
  }

  // 4. Message métier lisible (français, sans jargon SQL/technique)
  if (msg && !/^[A-Z_]+$/.test(msg) && msg.length < 200 && !msg.includes("constraint")) {
    return msg;
  }

  return fallback;
}

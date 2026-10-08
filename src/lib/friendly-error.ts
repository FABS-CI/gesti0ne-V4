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
  "23505": "Cet enregistrement existe déjà.",
  "23503": "Impossible : cet élément est référencé ailleurs dans le système.",
  "23502": "Un champ obligatoire est manquant.",
  "23514": "Une valeur saisie ne respecte pas les règles métier.",
  "22001": "Une valeur saisie est trop longue.",
  "22P02": "Format de donnée invalide.",
  "42501": "Vous n'avez pas les permissions nécessaires pour cette action.",
  "42P01": "Ressource introuvable dans la base.",
  "P0001": "", // raise exception métier — on utilise le message tel quel
  "PGRST301": "Vous n'avez pas les permissions nécessaires pour cette action.",
  "PGRST116": "Aucun résultat trouvé.",
};

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/row-level security|policy .* violated|not authorized/i,
    "Vous n'avez pas les permissions nécessaires pour cette action."],
  [/duplicate key|already exists/i,
    "Cet enregistrement existe déjà."],
  [/violates foreign key/i,
    "Impossible : cet élément est référencé ailleurs dans le système."],
  [/not null|null value in column/i,
    "Un champ obligatoire est manquant."],
  [/network|failed to fetch|networkerror/i,
    "Problème de connexion réseau. Vérifiez votre connexion et réessayez."],
  [/timeout|timed out/i,
    "L'opération a pris trop de temps. Réessayez."],
  [/jwt|token|expired|unauthorized|401/i,
    "Votre session a expiré. Veuillez vous reconnecter."],
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

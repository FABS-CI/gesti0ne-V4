/**
 * Neutralise une saisie utilisateur avant de l'insérer dans un filtre PostgREST `.or()`.
 * Les caractères , ( ) " \ * : servent de syntaxe au filtre et permettraient
 * d'ajouter des conditions non prévues. Ils sont remplacés par des espaces.
 */
export function pgSafe(value: string): string {
  return value.replace(/[,()"\\*:]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Motif `ilike` qui ne correspond qu'à la valeur exacte (casse ignorée).
 * `_` et `%` sont des jokers SQL : sans échappement, « FAC-2026-0005_ »
 * correspondrait à dix factures. À utiliser pour toute recherche par référence.
 */
export function ilikeExact(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

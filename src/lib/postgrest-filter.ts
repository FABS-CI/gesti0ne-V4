/**
 * Neutralise une saisie utilisateur avant de l'insérer dans un filtre PostgREST `.or()`.
 * Les caractères , ( ) " \ * : servent de syntaxe au filtre et permettraient
 * d'ajouter des conditions non prévues. Ils sont remplacés par des espaces.
 */
export function pgSafe(value: string): string {
  return value.replace(/[,()"\\*:]/g, " ").replace(/\s+/g, " ").trim();
}

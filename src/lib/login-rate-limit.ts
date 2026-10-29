// Limites d'échecs de connexion sur 15 minutes (table login_attempts).
// Le blocage principal porte sur le couple e-mail + IP : un inconnu qui connaît
// l'e-mail d'un employé ne bloque que sa propre adresse IP, pas le compte partout.
// Le plafond global par e-mail reste pour freiner une attaque répartie sur
// plusieurs IP ; comme une IP est plafonnée à MAX_FAILS_PER_IP, il en faut au moins deux.
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_EMAIL_IP = 5;
export const MAX_FAILS_PER_EMAIL = 30;
export const MAX_FAILS_PER_IP = 20;

export type LoginFailCounts = { emailIp: number; email: number; ip: number };

export function isLoginBlocked(c: LoginFailCounts): boolean {
  return (
    c.emailIp >= MAX_FAILS_PER_EMAIL_IP ||
    c.email >= MAX_FAILS_PER_EMAIL ||
    c.ip >= MAX_FAILS_PER_IP
  );
}

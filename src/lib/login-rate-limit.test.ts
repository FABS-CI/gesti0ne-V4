import { describe, it, expect } from "vitest";
import {
  isLoginBlocked,
  MAX_FAILS_PER_EMAIL,
  MAX_FAILS_PER_EMAIL_IP,
  MAX_FAILS_PER_IP,
} from "@/lib/login-rate-limit";

describe("isLoginBlocked", () => {
  it("bloque le couple e-mail + IP après 5 échecs", () => {
    expect(isLoginBlocked({ emailIp: MAX_FAILS_PER_EMAIL_IP - 1, email: 4, ip: 4 })).toBe(false);
    expect(isLoginBlocked({ emailIp: MAX_FAILS_PER_EMAIL_IP, email: 5, ip: 5 })).toBe(true);
  });
  it("ne bloque pas le compte depuis une autre IP après 5 échecs d'un inconnu", () => {
    // L'attaquant a échoué 5 fois depuis son IP ; l'employé se connecte depuis la sienne.
    expect(isLoginBlocked({ emailIp: 0, email: 5, ip: 0 })).toBe(false);
  });
  it("garde un plafond global par e-mail contre les attaques réparties", () => {
    expect(isLoginBlocked({ emailIp: 0, email: MAX_FAILS_PER_EMAIL, ip: 0 })).toBe(true);
  });
  it("garde le plafond par IP", () => {
    expect(isLoginBlocked({ emailIp: 0, email: 0, ip: MAX_FAILS_PER_IP })).toBe(true);
  });
  it("une seule IP ne peut pas atteindre le plafond global d'un e-mail", () => {
    expect(MAX_FAILS_PER_IP).toBeLessThan(MAX_FAILS_PER_EMAIL);
  });
});

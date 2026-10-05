import { describe, expect, it } from "vitest";
import { secretsMatch } from "./cron-auth.server";

describe("secretsMatch", () => {
  it("accepte uniquement le secret exact", () => {
    expect(secretsMatch("abc123", "abc123")).toBe(true);
    expect(secretsMatch("abc124", "abc123")).toBe(false);
    expect(secretsMatch("abc12", "abc123")).toBe(false);
  });

  it("refuse si le secret attendu ou fourni est vide", () => {
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("abc", "")).toBe(false);
    expect(secretsMatch("", "abc")).toBe(false);
  });
});

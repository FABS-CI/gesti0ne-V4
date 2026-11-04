import { describe, expect, it } from "vitest";
import { disposableDatabaseUrl } from "./disposable-database";

describe("Isolation des tests de base", () => {
  it("ignore les connexions PG héritées sans autorisation explicite", () => {
    expect(disposableDatabaseUrl({ PGHOST: "localhost", PGDATABASE: "postgres" })).toBeNull();
  });
  it("exige une URL dédiée même après autorisation", () => {
    expect(() => disposableDatabaseUrl({ GESTI0NE_RUN_DB_TESTS: "disposable" })).toThrow();
  });
  it("refuse une base distante même nommée test", () => {
    expect(() => disposableDatabaseUrl({ GESTI0NE_RUN_DB_TESTS: "disposable",
      GESTI0NE_TEST_DATABASE_URL: "postgresql://example.invalid/gesti0ne_test_ci" })).toThrow();
  });
  it("refuse la base locale normale", () => {
    expect(() => disposableDatabaseUrl({ GESTI0NE_RUN_DB_TESTS: "disposable",
      GESTI0NE_TEST_DATABASE_URL: "postgresql://localhost/postgres" })).toThrow();
  });
  it("autorise une base locale dédiée et explicitement jetable", () => {
    const url = "postgresql://localhost/gesti0ne_test_ci";
    expect(disposableDatabaseUrl({ GESTI0NE_RUN_DB_TESTS: "disposable",
      GESTI0NE_TEST_DATABASE_URL: url })).toBe(url);
  });
});
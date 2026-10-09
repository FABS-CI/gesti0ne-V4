import { describe, it, expect } from "vitest";
import { computePeriode, inPeriode } from "../paiements-periode";

const now = new Date(2026, 9, 9); // vendredi 9 octobre 2026

describe("computePeriode", () => {
  it("aujourd'hui", () => expect(computePeriode("today", now)).toEqual({ from: "2026-10-09", to: "2026-10-09" }));
  it("hier", () => expect(computePeriode("yesterday", now)).toEqual({ from: "2026-10-08", to: "2026-10-08" }));
  it("cette semaine commence lundi", () => expect(computePeriode("week", now).from).toBe("2026-10-05"));
  it("le mois dernier", () => expect(computePeriode("last_month", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" }));
  it("30 derniers jours inclut aujourd'hui", () => expect(computePeriode("30d", now).from).toBe("2026-09-10"));
  it("cette année", () => expect(computePeriode("year", now).from).toBe("2026-01-01"));
});

describe("inPeriode", () => {
  it("inclut les bornes", () => {
    expect(inPeriode("2026-10-01", "2026-10-01", "2026-10-31")).toBe(true);
    expect(inPeriode("2026-10-31", "2026-10-01", "2026-10-31")).toBe(true);
    expect(inPeriode("2026-11-01", "2026-10-01", "2026-10-31")).toBe(false);
  });
});

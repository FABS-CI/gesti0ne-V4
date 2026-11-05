import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatFCFA } from "@/lib/format";
import { easeOutCubic, valeurIntermediaire } from "@/lib/count-up";
import { AnimatedNumber } from "./AnimatedNumber";

describe("AnimatedNumber", () => {
  it("la courbe part de 0 et arrive à 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it("finit toujours sur la valeur exacte", () => {
    expect(valeurIntermediaire(0, 1_234_567, 1)).toBe(1_234_567);
    expect(valeurIntermediaire(0, 87.35, 1.2, 1)).toBe(87.35);
  });

  it("arrondit les valeurs intermédiaires", () => {
    expect(Number.isInteger(valeurIntermediaire(0, 999, 0.37))).toBe(true);
    expect(valeurIntermediaire(0, 10, 0.5, 1)).toBe(8.8);
  });

  it("sans animation possible (tests, mouvement réduit) affiche la valeur exacte", () => {
    render(<AnimatedNumber value={2_500_000} format={formatFCFA} />);
    expect(screen.getByText("2 500 000 FCFA")).toBeInTheDocument();
  });
});

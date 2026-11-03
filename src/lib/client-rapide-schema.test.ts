import { describe, it, expect } from "vitest";
import { clientRapideSchema, telephoneChiffres } from "./client-form-schema";

const base = { nom: "Librairie Yao", type_client: "librairie", representant: "", telephone: "07 59 69 98 11", ville: "Akoupé" };

describe("telephoneChiffres", () => {
  it("espaces retirés", () => expect(telephoneChiffres("07 59 69 98 11")).toBe("0759699811"));
  it("indicatif +225 retiré", () => expect(telephoneChiffres("+225 07 59 69 98 11")).toBe("0759699811"));
  it("indicatif 00225 retiré", () => expect(telephoneChiffres("002250759699811")).toBe("0759699811"));
});

describe("clientRapideSchema", () => {
  it("client complet accepté, téléphone stocké en 10 chiffres", () => {
    const r = clientRapideSchema.safeParse(base);
    expect(r.success && r.data.telephone).toBe("0759699811");
  });
  it("représentant facultatif", () => expect(clientRapideSchema.safeParse(base).success).toBe(true));
  it("nom obligatoire", () => expect(clientRapideSchema.safeParse({ ...base, nom: "  " }).success).toBe(false));
  it("type obligatoire", () => expect(clientRapideSchema.safeParse({ ...base, type_client: "" }).success).toBe(false));
  it("ville obligatoire", () => expect(clientRapideSchema.safeParse({ ...base, ville: "" }).success).toBe(false));
  it("téléphone à 10 chiffres", () =>
    expect(clientRapideSchema.safeParse({ ...base, telephone: "07 59 69" }).success).toBe(false));
});

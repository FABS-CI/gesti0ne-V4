import { describe, expect, it } from "vitest";
import { calculerRenommage, typePourReference, villeDetectee } from "@/lib/renommage-clients";

const c = (reference: string, nom: string, representant: string | null, id = reference) => ({
  client_id: id, reference, nom, representant,
});
const one = (x: ReturnType<typeof c>, excl: string[] = []) => calculerRenommage([x], excl)[0];

describe("renommage clients", () => {
  it("renomme une école en TYPE + représentant", () => {
    const l = one(c("CL-LYC-1", "LYCEE MODERNE TREICHVILLE", "monsekea"));
    expect(l.nouveau_nom).toBe(`${typePourReference("CL-LYC-1")} MONSEKEA`);
    expect(l.statut).toBe("renomme");
  });
  it("type stable et réparti entre LIBRAIRIE et PAPETERIE", () => {
    expect(typePourReference("CL-COL-154")).toBe(typePourReference("CL-COL-154"));
    const types = new Set(Array.from({ length: 40 }, (_, i) => typePourReference(`CL-LYC-${i}`)));
    expect(types.size).toBe(2);
  });
  it("CL-PAR avec mot-clé d'école est renommé, sans mot-clé non", () => {
    expect(one(c("CL-PAR-34", "LYCEE MUNICIPAL DE BONOUA", "KOFFI")).statut).toBe("renomme");
    expect(one(c("CL-PAR-70", "C.M. ST MARK", "KOFFI")).statut).toBe("renomme");
    expect(one(c("CL-PAR-9", "M. KOUAME JEAN", "KOUAME")).statut).toBe("non_concerne");
  });
  it("référence d'école suffit même sans mot-clé", () => {
    expect(one(c("CL-COL-3", "ARDOISE", "YAO")).statut).toBe("renomme");
  });
  it("nom commençant par LIBRAIRIE jamais renommé", () => {
    expect(one(c("CL-LYC-5", "LIBRAIRIE PAPETERIE DU LYCEE BONDOUKOU", "X")).statut).toBe("non_concerne");
  });
  it("CL-LIB renommé seulement si le nom commence par un mot-clé", () => {
    expect(one(c("CL-LIB-97", "LIB DU LYCEE", "X")).statut).toBe("non_concerne");
    expect(one(c("CL-LIB-98", "EPP ANONO", "X")).statut).toBe("renomme");
  });
  it("exclusion manuelle", () => {
    expect(one(c("CL-LYC-7", "LYCEE X", "Y"), ["CL-LYC-7"]).statut).toBe("non_concerne");
  });
  it("représentant vide ou générique → manuel", () => {
    expect(one(c("CL-LYC-8", "LYCEE X", "—")).statut).toBe("manuel");
    expect(one(c("CL-LYC-9", "LYCEE X", "Directeur")).statut).toBe("manuel");
  });
  it("référence d'école + représentant société → à vérifier", () => {
    expect(one(c("CL-COL-118", "TANON NAMAKO", "FABS INFORMATIQUE")).statut).toBe("verifier");
  });
  it("doublons : ville puis numéro, par référence croissante", () => {
    const r = calculerRenommage([
      { client_id: "a", reference: "CL-LYC-10", nom: "LYCEE ADZOPE", representant: "KOUAME", type_renommage: "LIBRAIRIE" },
      { client_id: "b", reference: "CL-LYC-2", nom: "LYCEE BONOUA", representant: "KOUAME", type_renommage: "LIBRAIRIE" },
      { client_id: "c", reference: "CL-LYC-11", nom: "LYCEE ADZOPE", representant: "KOUAME", type_renommage: "LIBRAIRIE" },
    ]);
    expect(r.map((l) => l.nouveau_nom)).toEqual([
      "LIBRAIRIE KOUAME", "LIBRAIRIE KOUAME ADZOPE", "LIBRAIRIE KOUAME 2",
    ]);
  });
  it("ville détectée retire les mots-clés et liaisons", () => {
    expect(villeDetectee("Lycée Moderne de Treichville")).toBe("TREICHVILLE");
  });
});

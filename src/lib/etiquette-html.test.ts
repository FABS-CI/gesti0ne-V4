import { describe, it, expect, vi } from "vitest";

vi.mock("@/assets/fabs-logo.png", () => ({ default: "logo.png" }));
vi.mock("qrcode", () => ({ default: { toDataURL: () => Promise.resolve("data:image/png;base64,QR") } }));

import { buildEtiquettesPrintHtml } from "./etiquette-html";
import type { EtiquettePayload } from "@/components/colisage/EtiquetteCarton";

const mk = (n: number, nb: number): EtiquettePayload => ({
  colis_id: `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`,
  reference_colis: `COL-0000${n}`,
  bl: "BL-2026-00047",
  commande: "CMD-2026-00047",
  client: "ADJAME ROXY",
  ville: "ADJAME",
  representant: "M. FOFANA",
  telephone: "07 07 16 12 30",
  numero_carton: n,
  nb_cartons: nb,
  mode_acheminement: "livraison",
  produits: [{ nom: "Cahier", quantite: 10 }],
});

describe("buildEtiquettesPrintHtml", () => {
  it("1 étiquette : page unique, références, QR, sans produits", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("x")) as unknown as typeof fetch;
    const html = await buildEtiquettesPrintHtml([mk(1, 1)]);
    expect(html).toContain("single-label-page");
    for (const t of ["ADJAME ROXY", "M. FOFANA", "07 07 16 12 30", "BL-2026-00047", "CMD-2026-00047", "COL-00001", "1 / 1", "data:image/png;base64,QR"])
      expect(html).toContain(t);
    expect(html).not.toContain("PRODUITS");
    expect(html).not.toContain("QUANTITÉ");
    expect(html).not.toContain("00000001".toUpperCase() + "<");
  });

  it("2 étiquettes : une page A4 double, 1 / 2 et 2 / 2", async () => {
    const html = await buildEtiquettesPrintHtml([mk(1, 2), mk(2, 2)]);
    expect(html.match(/double-label-page/g)?.length).toBe(1);
    expect(html).toContain("1 / 2");
    expect(html).toContain("2 / 2");
    expect(html).toContain("COL-00002");
    expect(html).not.toContain("PRODUITS");
  });
});

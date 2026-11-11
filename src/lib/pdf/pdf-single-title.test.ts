import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { drawHeader } from "./pdfChrome";

function countTitle(doc: jsPDF, title: string) {
  const raw = doc.output();
  return raw.split(`(${title})`).length - 1;
}

describe("titre principal unique des PDF", () => {
  it("l'en-tête rappelé sur la même page n'écrit le titre qu'une fois", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    drawHeader(doc, "JOURNAL DES VENTES");
    drawHeader(doc, "JOURNAL DES VENTES");
    expect(countTitle(doc, "JOURNAL DES VENTES")).toBe(1);
  });
  it("une nouvelle page reçoit son propre titre", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    drawHeader(doc, "JOURNAL DES VENTES");
    doc.addPage();
    drawHeader(doc, "JOURNAL DES VENTES");
    expect(countTitle(doc, "JOURNAL DES VENTES")).toBe(2);
  });
  it("titleInBody : l'en-tête n'écrit pas le titre", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    drawHeader(doc, "ETAT DE COMPTE", undefined, { titleInBody: true });
    expect(countTitle(doc, "ETAT DE COMPTE")).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { formatDocumentReference as f, toStoredReferencePattern as back } from "./document-reference";

describe("formatDocumentReference", () => {
  it.each([
    ["FAC-2026-00001", "|FC|26|1"],
    ["FAC-2026-00051", "|FC|26|51"],
    ["FAC-2026-00125", "|FC|26|125"],
    ["FAC-2026-01000", "|FC|26|1000"],
    ["PFMA-2025-01013", "|PFMA|25|1013"],
    ["PRO-2026-00025", "|PFMA|26|25"],
    ["BC-2026-00155", "|BC|26|155"],
    ["CMD-2026-00042", "|BC|26|42"],
    ["BL-2026-00040", "|BL|26|40"],
    ["PAI-2026-00031", "|PAI|26|31"],
    ["REC-2026-00015", "|REC|26|15"],
  ])("%s → %s", (a, b) => expect(f(a)).toBe(b));
  it("ne touche pas aux autres références", () => {
    expect(f("COL-00001")).toBe("COL-00001");
    expect(f("RET-260917-001")).toBe("RET-260917-001");
    expect(f("FABS-CI95")).toBe("FABS-CI95");
    expect(f(null)).toBe("");
  });
  it("recherche inverse", () => expect(back("|FC|26|51")).toBe("FAC-2026-00051"));
});

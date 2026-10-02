import { describe, it, expect } from "vitest";
import { buildColisReference, displayColisReference } from "./colis-reference";
describe("buildColisReference", () => {
  it("BL-2026-00040, 4 cartons", () => {
    expect([1, 2, 3, 4].map((n) => buildColisReference("BL-2026-00040", n))).toEqual([
      "CL-2026-40-C001", "CL-2026-40-C002", "CL-2026-40-C003", "CL-2026-40-C004",
    ]);
  });
  it("numéros nets et cartons 10/100", () => {
    expect(buildColisReference("BL-2026-00007", 1)).toBe("CL-2026-7-C001");
    expect(buildColisReference("BL-2026-00125", 1)).toBe("CL-2026-125-C001");
    expect(buildColisReference("BL-2026-00040", 10)).toBe("CL-2026-40-C010");
    expect(buildColisReference("BL-2026-00040", 100)).toBe("CL-2026-40-C100");
  });
  it("repli sur la référence stockée si non calculable", () => {
    expect(displayColisReference("XYZ", 1, "OLD")).toBe("OLD");
    expect(displayColisReference(null, null, null)).toBeUndefined();
  });
});

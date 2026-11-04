import { describe, expect, it } from "vitest";

import { ilikeExact } from "./postgrest-filter";

describe("ilikeExact", () => {
  it("laisse une référence ordinaire inchangée", () => {
    expect(ilikeExact("FAC-2026-00051")).toBe("FAC-2026-00051");
  });

  it("échappe les jokers SQL _ et %", () => {
    expect(ilikeExact("FAC-2026-0005_")).toBe("FAC-2026-0005\\_");
    expect(ilikeExact("CL-%")).toBe("CL-\\%");
  });

  it("échappe la barre oblique inverse avant les jokers", () => {
    expect(ilikeExact("a\\_b")).toBe("a\\\\\\_b");
  });
});

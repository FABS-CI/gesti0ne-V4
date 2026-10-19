import { describe, it, expect, vi } from "vitest";
const inMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ in: (_c: string, ids: string[]) => { inMock(ids); return Promise.resolve({ data: ids.filter((i) => i !== "absent").map((i) => ({ facture_id: i, client_id: "c-" + i })), error: null }); } }) }) },
}));
import { attachClientIds } from "@/lib/facture-client-ids";

describe("attachClientIds", () => {
  it("découpe les lectures par lots de 200", async () => {
    inMock.mockClear();
    const rows = Array.from({ length: 450 }, (_, i) => ({ facture_id: "f" + i }));
    await attachClientIds(rows);
    expect(inMock.mock.calls.map((c) => c[0].length)).toEqual([200, 200, 50]);
  });
  it("laisse client_id à null quand la facture est introuvable", async () => {
    const [r] = await attachClientIds([{ facture_id: "absent" }]);
    expect(r.client_id).toBeNull();
  });
  it("conserve un client_id déjà présent", async () => {
    const [r] = await attachClientIds([{ facture_id: "f1", client_id: "x" }]);
    expect(r.client_id).toBe("x");
  });
});

import { describe, expect, it, vi } from "vitest";
import { replaceUserScope } from "./sec-replace-user-scope";

type Db = Parameters<typeof replaceUserScope>[0];

function fakeDb(error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ error }));
  return { rpc, db: { rpc } as unknown as Db };
}

describe("replaceUserScope", () => {
  it("transmet _principal: null quand aucun dépôt principal n'est fourni", async () => {
    const { rpc, db } = fakeDb();
    await replaceUserScope(db, {
      _actor_id: "actor",
      _user_id: "user",
      _role_codes: ["comptable"],
      _depot_ids: [],
      _principal: null,
    });
    expect(rpc).toHaveBeenCalledWith("sec_replace_user_scope", {
      _actor_id: "actor",
      _user_id: "user",
      _role_codes: ["comptable"],
      _depot_ids: [],
      _principal: null,
    });
  });

  it("propage l'erreur renvoyée par la base", async () => {
    const { db } = fakeDb({ message: "refusé" });
    await expect(
      replaceUserScope(db, {
        _actor_id: "a",
        _user_id: "u",
        _role_codes: [],
        _depot_ids: [],
        _principal: null,
      }),
    ).rejects.toThrow("refusé");
  });
});

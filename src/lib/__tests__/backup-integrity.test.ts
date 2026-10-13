import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/gdrive-folder", () => ({ getOrCreateBackupFolder: async () => null }));
import { buildGlobalArchive } from "@/lib/global-backup.server";
import { verifyArchive, sortTablesByDependencies } from "@/lib/backup-verify";

function fakeClient(tables: Record<string, unknown[] | Error>) {
  return {
    rpc: async (name: string) =>
      name === "export_config_snapshot"
        ? { data: { tables: Object.keys(tables).map((n) => ({ name: n })) }, error: null }
        : { data: [], error: null },
    from: (t: string) => ({
      select: () => ({
        range: async (a: number) => {
          const v = tables[t];
          if (v instanceof Error) return { data: null, error: { message: v.message } };
          return { data: a === 0 ? v : [], error: null };
        },
      }),
    }),
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
    storage: { listBuckets: async () => ({ data: [], error: null }) },
  };
}

describe("sauvegarde : une sauvegarde incomplète est un échec", () => {
  it("une table en erreur fait échouer la sauvegarde", async () => {
    const c = fakeClient({ clients: [{ id: 1 }], factures: new Error("permission denied") });
    await expect(buildGlobalArchive(c, { trigger: "manuel" })).rejects.toThrow(/factures/);
  });

  it("une archive complète passe le contrôle", async () => {
    const c = fakeClient({ clients: [{ id: 1 }, { id: 2 }], factures: [{ id: 3 }] });
    const { bytes } = await buildGlobalArchive(c, { trigger: "manuel" });
    await expect(verifyArchive(bytes, { minBytes: 0 })).resolves.toMatchObject({ tables: 2 });
  });

  it("un décalage du nombre de lignes fait échouer le contrôle", async () => {
    const JSZip = (await import("jszip")).default;
    const z = new JSZip();
    z.file("MANIFEST.json", JSON.stringify({ tables_attendues: ["clients"], lignes_par_table: { clients: 3 } }));
    z.file("data/clients.json", JSON.stringify([{ id: 1 }, { id: 2 }]));
    const bytes = await z.generateAsync({ type: "uint8array" });
    await expect(verifyArchive(bytes, { minBytes: 0 })).rejects.toThrow(/2 lignes au lieu de 3/);
  });

  it("une table attendue absente fait échouer le contrôle", async () => {
    const JSZip = (await import("jszip")).default;
    const z = new JSZip();
    z.file("MANIFEST.json", JSON.stringify({ tables_attendues: ["clients", "factures"], lignes_par_table: { clients: 0, factures: 0 } }));
    z.file("data/clients.json", "[]");
    const bytes = await z.generateAsync({ type: "uint8array" });
    await expect(verifyArchive(bytes, { minBytes: 0 })).rejects.toThrow(/factures absente/);
  });
});

describe("restauration : ordre des clés étrangères", () => {
  it("restaure les tables référencées avant celles qui les référencent", () => {
    const order = sortTablesByDependencies(
      ["paiements", "factures", "clients"],
      [
        { table_name: "factures", depends_on: "clients" },
        { table_name: "paiements", depends_on: "factures" },
      ],
    );
    expect(order).toEqual(["clients", "factures", "paiements"]);
  });
});

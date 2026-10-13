/**
 * Contrôles purs des archives de sauvegarde (sans client serveur) :
 * vérification stricte du ZIP, empreinte SHA-256 et ordre des tables.
 */

const MIN_ZIP_BYTES = 1024;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Exige 100 % des tables annoncées dans MANIFEST.json et, pour chacune,
 * exactement le nombre de lignes annoncé.
 */
export async function verifyArchive(bytes: Uint8Array, opts: { minBytes?: number } = {}) {
  const JSZip = (await import("jszip")).default;
  const min = opts.minBytes ?? MIN_ZIP_BYTES;
  if (bytes.byteLength < min) throw new Error(`Archive trop petite (${bytes.byteLength} o)`);
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const mf = zip.file("MANIFEST.json");
  if (!mf) throw new Error("Contrôle : MANIFEST.json absent");
  const manifest = JSON.parse(await mf.async("string"));
  const expected: string[] = manifest?.tables_attendues ?? [];
  const counts: Record<string, number> = manifest?.lignes_par_table ?? {};
  if (!Array.isArray(expected) || expected.length === 0)
    throw new Error("Contrôle : liste des tables attendues absente du manifeste");
  for (const t of expected) {
    const f = zip.file(`data/${t}.json`);
    if (!f) throw new Error(`Contrôle : table ${t} absente de l'archive`);
    const rows = JSON.parse(await f.async("string"));
    if (!Array.isArray(rows)) throw new Error(`Contrôle : table ${t} illisible`);
    if (rows.length !== counts[t])
      throw new Error(`Contrôle : table ${t} contient ${rows.length} lignes au lieu de ${counts[t]}`);
  }
  const leaked = files.filter((p) => p.split("/").pop() === "original.png");
  if (leaked.length) throw new Error(`Contrôle : ${leaked.length} original.png présent(s)`);
  return {
    ok: true,
    fichiers: files.length,
    tables: expected.length,
    original_png: 0,
    manifest_ok: true,
    controle_at: new Date().toISOString(),
  };
}

/** Tri topologique : les tables référencées passent avant celles qui les référencent. */
export function sortTablesByDependencies(
  tables: string[],
  deps: Array<{ table_name: string; depends_on: string }>,
): string[] {
  const set = new Set(tables);
  const parents = new Map<string, Set<string>>();
  for (const t of tables) parents.set(t, new Set());
  for (const d of deps) {
    if (d.table_name === d.depends_on) continue;
    if (set.has(d.table_name) && set.has(d.depends_on)) parents.get(d.table_name)!.add(d.depends_on);
  }
  const out: string[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (t: string) => {
    const s = state.get(t);
    if (s === 2 || s === 1) return; // 1 = cycle : on garde l'ordre courant
    state.set(t, 1);
    for (const p of [...parents.get(t)!].sort()) visit(p);
    state.set(t, 2);
    out.push(t);
  };
  for (const t of [...tables].sort()) visit(t);
  return out;
}

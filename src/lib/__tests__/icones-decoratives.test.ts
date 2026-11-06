// Interface sans icônes décoratives : garde-fou des écrans déjà nettoyés.
//
// Règle : une icône n'est gardée que si elle sert à utiliser l'écran (case cochée,
// flèche de liste ou de tri, fermeture, chargement, menu d'options, mot de passe…).
// Titres, cartes, menus, boutons qui ont déjà un libellé : texte seul, sans emoji.
// Les écrans s'ajoutent à ECRANS_NETTOYES au fil des lots.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Icônes fonctionnelles autorisées. */
const ICONES_FONCTIONNELLES = new Set([
  "Check",
  "ChevronDown",
  "ChevronUp",
  "ChevronLeft",
  "ChevronRight",
  "ChevronsUpDown",
  "ChevronsLeft",
  "ChevronsRight",
  "X",
  "Loader2",
  "ArrowUpDown",
  "ArrowUp",
  "ArrowDown",
  "Eye",
  "EyeOff",
  "PanelLeft",
  "GripVertical",
  "MoreHorizontal",
  "MoreVertical",
  "Circle",
  "Minus",
  "Dot",
  "LucideIcon",
]);

const dossier = (d: string) =>
  readdirSync(d)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => join(d, f));

/** Lot 1 (05/11/2026) : tableaux de bord et navigation. */
const ECRANS_NETTOYES = [
  ...dossier("src/components/dashboard"),
  "src/routes/_authenticated/dashboard.index.tsx",
  "src/routes/_authenticated/compta-dashboard.tsx",
  "src/routes/_authenticated/paie-dashboard.tsx",
  "src/routes/_authenticated/rh-dashboard.tsx",
  "src/routes/_authenticated/dashboard-logistique.tsx",
  "src/routes/_authenticated/clients.dashboard.tsx",
  "src/components/security/SecurityDashboard.tsx",
  "src/components/layout/sidebar/SidebarNavItem.tsx",
  // SidebarNavGroup : retiré le 06/11/2026 (refonte UI lot 1) — une icône par module,
  // nécessaire au menu réduit en rail ; voir le test dédié plus bas.
  "src/components/layout/MobileBottomNav.tsx",
];

const EMOJI = /\p{Extended_Pictographic}/u;
const IMPORT_LUCIDE = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"lucide-react"/g;

function iconesImportees(src: string): string[] {
  const noms: string[] = [];
  for (const m of src.matchAll(IMPORT_LUCIDE)) {
    for (const brut of m[1].split(",")) {
      const nom = brut
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0];
      if (nom) noms.push(nom);
    }
  }
  return noms;
}

describe("écrans sans icônes décoratives", () => {
  for (const f of ECRANS_NETTOYES) {
    const src = readFileSync(f, "utf8");
    it(`${f} : seulement des icônes fonctionnelles`, () => {
      expect(iconesImportees(src).filter((n) => !ICONES_FONCTIONNELLES.has(n))).toEqual([]);
    });
    it(`${f} : aucun emoji`, () => {
      expect(EMOJI.test(src)).toBe(false);
    });
    it(`${f} : aucune icône affichée depuis les données (item.icon, Icon)`, () => {
      expect(src).not.toMatch(/<(?:Icon|GroupIcon|\w+\.icon)\b/);
    });
  }
});

describe("menu latéral : une icône par module, aucune par page", () => {
  const src = readFileSync("src/components/layout/sidebar/SidebarNavGroup.tsx", "utf8");
  it("les icônes viennent uniquement de group.groupIcon", () => {
    expect(src).not.toMatch(/item\.icon/);
    expect(src).toMatch(/group\.groupIcon/);
  });
  it("aucune icône lucide décorative importée", () => {
    expect(iconesImportees(src).filter((n) => !ICONES_FONCTIONNELLES.has(n))).toEqual([]);
  });
  it("les icônes de module sont monochromes, trait 1,75 : 20 px dans le menu réduit, 16 px déplié", () => {
    for (const m of src.matchAll(/<Icon\b[^>]*>/g)) {
      expect(m[0]).toMatch(/h-(4 w-4|5 w-5)/);
      expect(m[0]).toMatch(/strokeWidth=\{1\.75\}/);
    }
  });
});

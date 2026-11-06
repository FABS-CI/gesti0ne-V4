// Interface sans icônes décoratives (décision du 05/11/2026) : garde-fou sur tout l'ERP.
//
// Règle : une icône n'est gardée que si elle sert à utiliser l'écran (case cochée,
// flèche de liste ou de tri, fermeture, chargement, menu d'options, mot de passe…).
// Titres, cartes, menus, alertes, boutons qui ont déjà un libellé : texte seul, sans emoji.
// Tous les écrans de src/ sont vérifiés, sauf les composants de base src/components/ui
// (flèches du calendrier et du carrousel, loupe de la palette de commandes, etc.).

import { readFileSync, readdirSync, statSync } from "node:fs";
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

const EXCLUS = [join("src", "components", "ui")];

function ecrans(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (EXCLUS.includes(chemin)) continue;
    if (statSync(chemin).isDirectory()) out.push(...ecrans(chemin));
    else if (nom.endsWith(".tsx") && !nom.includes(".test.")) out.push(chemin);
  }
  return out;
}

const EMOJI = /\p{Extended_Pictographic}/u;
// ©, ® et ™ (mentions légales) et les flèches ← → ↔ (typographie) ne sont pas des emojis.
const TYPOGRAPHIE = /[©®™←-⇿]/g;
const IMPORT_LUCIDE = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']lucide-react["']/g;

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

describe("interface sans icônes décoratives", () => {
  const fichiers = ecrans("src").map((f) => ({ f, src: readFileSync(f, "utf8") }));

  it("vérifie bien l'ensemble des écrans", () => {
    expect(fichiers.length).toBeGreaterThan(300);
  });

  it("seulement des icônes fonctionnelles", () => {
    const fautes = fichiers.flatMap(({ f, src }) =>
      iconesImportees(src)
        .filter((n) => !ICONES_FONCTIONNELLES.has(n))
        .map((n) => `${f} : ${n}`),
    );
    expect(fautes).toEqual([]);
  });

  it("aucun emoji", () => {
    const fautes = fichiers
      .filter(({ src }) => EMOJI.test(src.replace(TYPOGRAPHIE, "")))
      .map(({ f }) => f);
    expect(fautes).toEqual([]);
  });

  it("aucune icône affichée depuis les données (item.icon, Icon)", () => {
    // Exception (refonte UI lot 1, 06/11/2026) : une icône par module dans le menu
    // réduit en rail, vérifiée par le bloc dédié plus bas.
    const RAIL = join("src", "components", "layout", "sidebar", "SidebarNavGroup.tsx");
    const fautes = fichiers
      .filter(({ f }) => f !== RAIL)
      .filter(({ src }) => /<(?:Icon|GroupIcon|\w+\.icon|\w+\.Icon)\b/.test(src))
      .map(({ f }) => f);
    expect(fautes).toEqual([]);
  });
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

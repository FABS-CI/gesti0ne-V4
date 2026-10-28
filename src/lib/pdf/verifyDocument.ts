// Contrôle automatisé : compare le QR JSON {ref, client, date, total, solde}
// et les éléments de mise en page entre le rendu et le modèle de référence,
// pour chaque type de document commercial.

import { buildQrPayload, type DocBase, type DocLigne } from "./fabsTemplates";

export type DocKind = "FC" | "PF" | "BC" | "BL" | "BR" | "AV" | "RECU";

export type VerifyIssue = {
  champ: string;
  attendu: unknown;
  recu: unknown;
};

export type VerifyResult = {
  ok: boolean;
  type: DocKind;
  qr: Record<string, unknown>;
  issues: VerifyIssue[];
};

// Éléments de mise en page attendus pour chaque type (modèle de référence FABS-CI).
const LAYOUT_REFERENCE: Record<DocKind, { qr: boolean }> = {
  FC: { qr: true },
  PF: { qr: true },
  BL: { qr: true },
  RECU: { qr: true },
  BC: { qr: false },
  BR: { qr: false },
  AV: { qr: false },
};

// Types nécessitant les coordonnées client complètes (nom, tél/adresse).
const REQUIRE_CLIENT: Record<DocKind, boolean> = {
  FC: true,
  PF: true,
  BL: true,
  BC: true,
  BR: true,
  AV: true,
  RECU: true,
};

// Types avec totaux monétaires (contrôle cohérence HT/TVA/TTC).
const REQUIRE_TOTALS: Record<DocKind, boolean> = {
  FC: true,
  PF: true,
  BL: false,
  BC: true,
  BR: false,
  AV: true,
  RECU: true,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
const FR_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

function isValidDate(v: unknown): boolean {
  if (typeof v !== "string" || !v.trim()) return false;
  if (!ISO_DATE_RE.test(v) && !FR_DATE_RE.test(v)) return false;
  const d = new Date(v.includes("/") ? v.split("/").reverse().join("-") : v);
  return !Number.isNaN(d.getTime());
}

function round(n: number): number {
  return Math.round(n);
}

function sumLignes(lignes: DocLigne[] | undefined): number {
  if (!lignes?.length) return 0;
  return lignes.reduce((s, l) => {
    const q = Number(l.qte ?? l.qteLivree ?? l.qteCommandee ?? 0);
    const p = Number(l.prixUnitaire ?? 0);
    const r = Number(l.remisePct ?? 0);
    const m = Number(l.montant ?? q * p * (1 - r / 100));
    return s + m;
  }, 0);
}

/**
 * Vérifie qu'un document respecte le modèle de référence :
 * - le QR JSON contient bien les champs canoniques attendus et non vides,
 * - les éléments de mise en page (présence du QR selon le type) sont conformes.
 */
export function verifyDocument(type: DocKind, data: DocBase): VerifyResult {
  const issues: VerifyIssue[] = [];
  const ref = LAYOUT_REFERENCE[type];
  const qrRaw = buildQrPayload(data);
  let qr: Record<string, unknown> = {};
  
  try {
    qr = JSON.parse(qrRaw);
  } catch (e) {
    issues.push({ champ: "qr", attendu: "JSON valide", recu: qrRaw });
  }

  // 1. Référence du document
  if (!data.reference || !/^[A-Z0-9-]+$/i.test(data.reference)) {
    issues.push({ champ: "reference", attendu: "format XXX-YYYYMMDD-###", recu: data.reference });
  }

  // 2. Date valide
  if (!isValidDate(data.date)) {
    issues.push({ champ: "date", attendu: "date ISO ou JJ/MM/AAAA", recu: data.date });
  }

  // 3. Coordonnées client
  if (REQUIRE_CLIENT[type]) {
    if (!data.clientNom || !data.clientNom.trim()) {
      issues.push({ champ: "clientNom", attendu: "non vide", recu: data.clientNom });
    }
  }

  // 4. Cohérence des totaux HT / TVA / TTC
  if (REQUIRE_TOTALS[type] && data.lignes && data.lignes.length > 0) {
    const totalVente = round(sumLignes(data.lignes));
    const remise = round(Number(data.remise ?? data.remiseGlobale ?? 0));
    const ht = round(Number(data.montantHT ?? totalVente - remise));
    const tvaPct = Number(data.tvaPct ?? 0);
    const tva = round(Number(data.tva ?? (ht * tvaPct) / 100));
    const ttc = round(Number(data.totalTTC ?? ht + tva));

    if (Math.abs(ht + tva - ttc) > 1) {
      issues.push({ champ: "totalTTC", attendu: ht + tva, recu: ttc });
    }
    if (tvaPct > 0 && Math.abs(round((ht * tvaPct) / 100) - tva) > 1) {
      issues.push({ champ: "tva", attendu: round((ht * tvaPct) / 100), recu: tva });
    }
    if (ttc < 0) {
      issues.push({ champ: "totalTTC", attendu: ">= 0", recu: ttc });
    }
  }

  if (ref.qr && qr) {
    // Champs requis du QR JSON
    const requiredString = ["ref", "cli", "date"];
    for (const k of requiredString) {
      const v = qr[k];
      if (typeof v !== "string" || v.trim() === "") {
        issues.push({ champ: `qr.${k}`, attendu: "valeur non vide", recu: v });
      }
    }
    if (typeof qr.tot !== "number" || Number.isNaN(qr.tot)) {
      issues.push({ champ: "qr.total", attendu: "nombre", recu: qr.tot });
    }
    // Cohérence du total avec les données source
    // Montants non arrondis (ex. 232 011,6) : on compare au franc près.
    const expectedTotal = Math.round(Number(data.totalVente ?? data.montantHT ?? 0));
    if (typeof qr.tot === "number" && Math.round(qr.tot) !== expectedTotal) {
      issues.push({ champ: "qr.total", attendu: expectedTotal, recu: qr.tot });
    }
  }

  return { ok: issues.length === 0, type, qr, issues };
}

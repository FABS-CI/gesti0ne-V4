import { pgSafe } from "@/lib/postgrest-filter";
import { supabase } from "@/integrations/supabase/client";

export type Produit = {
  produit_id: string;
  reference: string;
  titre: string;
  isbn: string | null;
  categorie: string;
  niveau: string | null;
  matiere: string | null;
  auteur: string | null;
  editeur: string | null;
  prix_vente: number;
  prix_achat: number;
  stock: number;
  seuil_alerte: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
  /** Chemin de l'image originale dans le bucket `product-covers` (null si aucune couverture). */
  cover_path?: string | null;
  /** Chemin de la miniature (WebP 256 px) dans le bucket `product-covers`. */
  cover_thumb_path?: string | null;
  /** Utilisé pour le cache-busting des URLs signées de couverture. */
  cover_updated_at?: string | null;
  /** Dernier prix d'achat constaté (injecté par jointure). */
  dernier_prix_achat?: { prix_unitaire: number; created_at: string }[] | null;
};

export type ProduitInput = {
  titre: string;
  isbn?: string | null;
  categorie: string;
  niveau?: string | null;
  matiere?: string | null;
  auteur?: string | null;
  editeur?: string | null;
  prix_vente?: number;
  prix_achat?: number;
  seuil_alerte?: number;
};

export type ListProduitsParams = {
  q?: string;
  categorie?: string;
  niveau?: string;
  actif?: boolean;
  page?: number;
  pageSize?: number;
};

export async function listProduits(params: ListProduitsParams = {}) {
  const { q, categorie, niveau, actif, page = 1, pageSize = 20 } = params;
  
  // 1. Fetch products from v_produits with their aggregated stock
  let query = supabase
    .from("v_produits")
    .select("*, stocks_depots(quantite)", { count: "exact" });

  if (q)
    query = query.or(
      `titre.ilike.%${pgSafe(q)}%,reference.ilike.%${pgSafe(q)}%,isbn.ilike.%${pgSafe(q)}%,auteur.ilike.%${pgSafe(q)}%,niveau.ilike.%${pgSafe(q)}%,categorie.ilike.%${pgSafe(q)}%`,
    );
  if (categorie) query = query.eq("categorie", categorie);
  if (niveau) query = query.ilike("niveau", `%${niveau}%`);
  if (actif != null) query = query.eq("actif", actif);

  const from = (page - 1) * pageSize;
  query = query
    .order("pin_order", { ascending: true })
    .order("niveau_ordre", { ascending: true })
    .order("titre", { ascending: true })
    .range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  // 1b. Calculate real stock from aggregated stocks_depots
  const items = (data ?? []).map((p: any) => {
    const totalStock = (p.stocks_depots || []).reduce(
      (sum: number, s: any) => sum + Number(s.quantite || 0),
      0,
    );
    return { ...p, stock: totalStock };
  });

  if (items.length > 0) {
    const productIds = items.map(p => p.produit_id || p.id);
    const { data: purchaseData } = await supabase.rpc('get_derniers_prix_achat', {
      _produit_ids: productIds
    });

    if (purchaseData) {
      const purchaseMap = new Map((purchaseData as any[]).map(pd => [pd.produit_id, pd]));
      items.forEach((p: any) => {
        const lastPurchase = purchaseMap.get(p.produit_id || p.id);
        p.dernier_prix_achat = lastPurchase ? [lastPurchase] : [];
      });
    }
  }

  return { items: items as unknown as Produit[], total: count ?? 0, page, pageSize };
}

export async function createProduit(payload: ProduitInput) {
  const { data, error } = await supabase.from("produits").insert(payload).select().single();
  if (error) throw error;
  return data as unknown as Produit;
}

export async function updateProduit(id: string, payload: Partial<ProduitInput>) {
  // Le stock n'existe plus comme colonne : il est calculé depuis stocks_depots.
  const { data, error } = await supabase
    .from("produits")
    .update(payload)
    .eq("produit_id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Produit;
}

export async function disableProduit(id: string) {
  const { error } = await supabase.from("produits").update({ actif: false }).eq("produit_id", id);
  if (error) throw error;
}

/**
 * Suppression définitive d'un produit via la RPC `supprimer_produit`.
 * Bloqué par la RPC si le produit est référencé (lignes de commande, colis,
 * mouvements de stock, inventaire, etc.) — l'utilisateur doit alors désactiver.
 */
export async function deleteProduit(id: string, motif?: string | null) {
  const { data, error } = await supabase.rpc("supprimer_produit", {
    _produit_id: id,
    _motif: motif ?? undefined,
  });
  if (error) throw error;
  return data;
}

// ── Contrôle d'intégrité du catalogue ──────────────────────────────

export type IntegriteIssue = {
  champ: "isbn" | "prix_achat" | "prix_vente";
  message: string;
  severite: "erreur" | "alerte";
};

export type ProduitIntegrite = {
  produit: Produit;
  issues: IntegriteIssue[];
};

export type IntegriteRapport = {
  total: number;
  conformes: number;
  problemes: ProduitIntegrite[];
  parChamp: { isbn: number; prix_achat: number; prix_vente: number };
};

/** Valide un ISBN-10 ou ISBN-13 (clé de contrôle incluse). */
export function isValidISBN(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  if (s.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      const d = s.charCodeAt(i) - 48;
      if (d < 0 || d > 9) return false;
      sum += (10 - i) * d;
    }
    const last = s[9] === "X" ? 10 : s.charCodeAt(9) - 48;
    if (s[9] !== "X" && (last < 0 || last > 9)) return false;
    return (sum + last) % 11 === 0;
  }
  if (s.length === 13) {
    if (!/^\d{13}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * (s.charCodeAt(i) - 48);
    const check = (10 - (sum % 10)) % 10;
    return check === s.charCodeAt(12) - 48;
  }
  return false;
}

function auditProduit(p: Produit): IntegriteIssue[] {
  const issues: IntegriteIssue[] = [];
  if (!p.isbn || !p.isbn.trim()) {
    issues.push({ champ: "isbn", message: "ISBN manquant", severite: "erreur" });
  } else if (!isValidISBN(p.isbn)) {
    issues.push({
      champ: "isbn",
      message: "ISBN invalide (clé de contrôle erronée)",
      severite: "erreur",
    });
  }
  if (p.prix_achat == null || Number(p.prix_achat) <= 0) {
    issues.push({
      champ: "prix_achat",
      message: "Prix d'achat manquant ou nul",
      severite: "erreur",
    });
  } else if (
    p.prix_vente != null &&
    Number(p.prix_vente) > 0 &&
    Number(p.prix_achat) >= Number(p.prix_vente)
  ) {
    issues.push({
      champ: "prix_achat",
      message: "Prix d'achat ≥ prix de vente (marge négative)",
      severite: "alerte",
    });
  }
  if (p.prix_vente == null || Number(p.prix_vente) <= 0) {
    issues.push({
      champ: "prix_vente",
      message: "Prix de vente manquant ou nul",
      severite: "alerte",
    });
  }
  return issues;
}

export async function controleIntegriteCatalogue(): Promise<IntegriteRapport> {
  const { data, error } = await supabase
    .from("v_produits")
    .select("*")
    .order("pin_order", { ascending: true })
    .order("niveau_ordre", { ascending: true })
    .order("titre", { ascending: true });
  if (error) throw error;
  const produits = (data ?? []) as unknown as Produit[];
  const problemes: ProduitIntegrite[] = [];
  const parChamp = { isbn: 0, prix_achat: 0, prix_vente: 0 };

  for (const produit of produits) {
    const issues = auditProduit(produit);
    if (issues.length) {
      problemes.push({ produit, issues });
      for (const i of issues) parChamp[i.champ] += 1;
    }
  }

  return {
    total: produits.length,
    conformes: produits.length - problemes.length,
    problemes,
    parChamp,
  };
}

export async function getProduit(id: string) {
  const { data, error } = await supabase
    .from("produits")
    .select("*")
    .eq("produit_id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Produit | null;
}

// ── Couvertures produits ───────────────────────────────────────────

const COVER_BUCKET = "product-covers";
const ACCEPTED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5 Mo
const THUMB_MAX_DIM = 256;

/** Génère une miniature WebP 256 px à partir d'un File image. */
async function generateThumbnail(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, THUMB_MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : (() => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        })();
  const ctx = (canvas as OffscreenCanvas).getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Impossible d'initialiser le canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("convertToBlob" in canvas) {
    return await (canvas as OffscreenCanvas).convertToBlob({ type: "image/webp", quality: 0.78 });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec de la miniature"))),
      "image/webp",
      0.78,
    );
  });
}

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Téléverse la couverture d'un produit :
 * - stocke l'original dans `covers/{id}/original.{ext}`,
 * - génère et stocke une miniature `covers/{id}/thumb.webp`,
 * - met à jour `produits.cover_path`, `cover_thumb_path`, `cover_updated_at`.
 */
export async function uploadProductCover(produitId: string, file: File): Promise<Produit> {
  if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
    throw new Error("Format non supporté (JPG, PNG ou WEBP)");
  }
  if (file.size > MAX_COVER_SIZE) {
    throw new Error("Image trop volumineuse (5 Mo max)");
  }
  const ext = extensionFor(file);
  const originalPath = `covers/${produitId}/original.${ext}`;
  const thumbPath = `covers/${produitId}/thumb.webp`;

  const thumb = await generateThumbnail(file);

  // Nettoyage des variantes obsolètes avant l'upload pour éviter les doublons
  // (par ex. si l'ancienne était en .png et la nouvelle en .jpg).
  await supabase.storage
    .from(COVER_BUCKET)
    .remove([
      `covers/${produitId}/original.jpg`,
      `covers/${produitId}/original.png`,
      `covers/${produitId}/original.webp`,
    ]);

  const up1 = await supabase.storage
    .from(COVER_BUCKET)
    .upload(originalPath, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (up1.error) throw up1.error;

  const up2 = await supabase.storage
    .from(COVER_BUCKET)
    .upload(thumbPath, thumb, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
  if (up2.error) throw up2.error;

  const { data, error } = await supabase
    .from("produits")
    .update({
      cover_path: originalPath,
      cover_thumb_path: thumbPath,
      cover_updated_at: new Date().toISOString(),
    })
    .eq("produit_id", produitId)
    .select()
    .single();
  if (error) throw error;

  invalidateCoverUrls(produitId);
  return data as unknown as Produit;
}

export async function deleteProductCover(produitId: string): Promise<void> {
  await supabase.storage
    .from(COVER_BUCKET)
    .remove([
      `covers/${produitId}/original.jpg`,
      `covers/${produitId}/original.png`,
      `covers/${produitId}/original.webp`,
      `covers/${produitId}/thumb.webp`,
    ]);
  const { error } = await supabase
    .from("produits")
    .update({ cover_path: null, cover_thumb_path: null, cover_updated_at: new Date().toISOString() })
    .eq("produit_id", produitId);
  if (error) throw error;
  invalidateCoverUrls(produitId);
}

/** Cache des URLs signées : clé = chemin storage, valeur = { url, expiresAt (ms) }. */
const coverUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL = 60 * 60; // 1 h côté storage
const SIGNED_URL_CACHE_MS = 55 * 60 * 1000; // 55 min côté client

function invalidateCoverUrls(produitId: string) {
  for (const key of Array.from(coverUrlCache.keys())) {
    if (key.startsWith(`covers/${produitId}/`)) coverUrlCache.delete(key);
  }
}

/**
 * Retourne une URL signée pour la couverture d'un produit ou `null` si aucune.
 * Les URLs sont mémorisées (~55 min) pour éviter la re-signature en boucle sur
 * les listes longues (recherche produit, table catalogue, lignes de commande…).
 */
export async function getCoverUrl(
  produit: Pick<Produit, "cover_path" | "cover_thumb_path">,
  variant: "thumb" | "original" = "thumb",
): Promise<string | null> {
  const path = variant === "thumb" ? produit.cover_thumb_path : produit.cover_path;
  if (!path) return null;
  const cached = coverUrlCache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.url;
  const { data, error } = await supabase.storage
    .from(COVER_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  coverUrlCache.set(path, { url: data.signedUrl, expiresAt: now + SIGNED_URL_CACHE_MS });
  return data.signedUrl;
}

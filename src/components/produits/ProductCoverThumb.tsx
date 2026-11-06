import { useEffect, useState } from "react";
import { getCoverUrl, type Produit } from "@/lib/produits-api";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  // Ratio portrait 3/4 (format livre) — les couvertures remplissent le holder
  // sans marge blanche et sans déformation excessive.
  xs: "h-8 w-6",
  sm: "h-12 w-9",
  md: "h-16 w-12",
  lg: "h-32 w-24",
};

type CoverInput = Pick<Produit, "cover_path" | "cover_thumb_path" | "cover_updated_at" | "titre">;

export interface ProductCoverThumbProps {
  produit: CoverInput | null | undefined;
  size?: Size;
  variant?: "thumb" | "original";
  className?: string;
  /** Bordure et fond doux pour un rendu carte. Désactivable pour un rendu inline plat. */
  framed?: boolean;
}

/**
 * Miniature de couverture produit avec chargement paresseux, cache d'URL signée
 * (via `getCoverUrl`) et placeholder neutre lorsqu'aucune image n'est associée.
 */
export function ProductCoverThumb({
  produit,
  size = "sm",
  variant = "thumb",
  className,
  framed = true,
}: ProductCoverThumbProps) {
  const path = variant === "thumb" ? produit?.cover_thumb_path : produit?.cover_path;
  const updatedAt = produit?.cover_updated_at ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Style calculé après analyse des bords sombres pour rogner automatiquement
  // les marges noires/blanches issues des couvertures extraites de PDF.
  const [imgStyle, setImgStyle] = useState<React.CSSProperties>({
    transform: "scale(1.05)",
    objectPosition: "center",
  });

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setImgStyle({ transform: "scale(1.05)", objectPosition: "center" });
    if (!path) {
      setUrl(null);
      return;
    }
    getCoverUrl(
      {
        cover_path: produit?.cover_path ?? null,
        cover_thumb_path: produit?.cover_thumb_path ?? null,
      },
      variant,
    )
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
    // `updatedAt` dans les deps → invalide l'aperçu après un remplacement.
  }, [path, updatedAt, variant, produit?.cover_path, produit?.cover_thumb_path]);

  const wrapperClass = cn(
    SIZE_CLASS[size],
    "shrink-0 overflow-hidden flex items-center justify-center",
    framed && "rounded-md border bg-muted",
    className,
  );

  if (!url || failed) {
    return <div className={wrapperClass} aria-hidden={!produit?.titre} />;
  }

  return (
    <div className={wrapperClass}>
      <img
        src={url}
        alt={produit?.titre ? `Couverture — ${produit.titre}` : "Couverture produit"}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        className="h-full w-full object-cover transition-transform duration-150"
        style={imgStyle}
        onLoad={(event) => {
          const img = event.currentTarget;
          try {
            const style = computeCropStyle(img);
            if (style) setImgStyle(style);
          } catch {
            /* CORS ou canvas indisponible → on garde le style par défaut */
          }
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/**
 * Analyse une image pour détecter et rogner automatiquement les marges
 * uniformes (noires ou blanches) souvent présentes autour des couvertures
 * extraites de PDF, puis retourne le `transform`/`object-position` à appliquer
 * pour que la vraie couverture remplisse le holder (portrait 3/4).
 */
function computeCropStyle(img: HTMLImageElement): React.CSSProperties | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  // Sous-échantillonne à ~64 px pour un scan bord très rapide.
  const scale = Math.min(1, 64 / Math.max(w, h));
  const cw = Math.max(8, Math.round(w * scale));
  const ch = Math.max(8, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, cw, ch);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, cw, ch).data;
  } catch {
    // getImageData bloqué (CORS) → placeholder par défaut
    return null;
  }
  const isMargin = (x: number, y: number) => {
    const i = (y * cw + x) * 4;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Considère margeuniforme : quasi-noir OU quasi-blanc, et faiblement coloré.
    return (max < 30 || min > 225) && max - min < 25;
  };
  const rowIsMargin = (y: number) => {
    let count = 0;
    for (let x = 0; x < cw; x++) if (isMargin(x, y)) count++;
    return count / cw > 0.9;
  };
  const colIsMargin = (x: number) => {
    let count = 0;
    for (let y = 0; y < ch; y++) if (isMargin(x, y)) count++;
    return count / ch > 0.9;
  };
  let top = 0,
    bottom = ch - 1,
    left = 0,
    right = cw - 1;
  while (top < ch - 1 && rowIsMargin(top)) top++;
  while (bottom > top && rowIsMargin(bottom)) bottom--;
  while (left < cw - 1 && colIsMargin(left)) left++;
  while (right > left && colIsMargin(right)) right--;
  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW < cw * 0.2 || cropH < ch * 0.2) {
    return { transform: "scale(1.05)", objectPosition: "center" };
  }
  // Barycentre de la zone utile (0..1) → objectPosition en %.
  const cx = (left + right) / 2 / cw;
  const cy = (top + bottom) / 2 / ch;
  // Ratio holder = 3/4 (portrait). On veut que la zone utile remplisse le holder.
  const holderRatio = 3 / 4;
  const cropRatio = cropW / cropH;
  // object-cover choisit le facteur qui remplit le holder ; on ajoute un léger
  // sur-zoom pour absorber quelques pixels de marge résiduelle.
  const baseFill =
    cropRatio > holderRatio
      ? ch / cropH // limité par la hauteur utile → l'image est mise à l'échelle sur H
      : cw / cropW;
  const zoom = Math.min(3, Math.max(1.02, baseFill * 1.04));
  return {
    transform: `scale(${zoom.toFixed(3)})`,
    objectPosition: `${(cx * 100).toFixed(1)}% ${(cy * 100).toFixed(1)}%`,
  };
}

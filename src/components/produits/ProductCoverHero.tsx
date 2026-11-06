import { memo, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { getCoverUrl, type Produit } from "@/lib/produits-api";
import { cn } from "@/lib/utils";

interface Props {
  produit: Pick<Produit, "cover_path" | "cover_thumb_path" | "cover_updated_at" | "titre">;
  className?: string;
}

/**
 * Zone visuelle de la fiche produit : miniature de couverture (WebP 256px, lazy)
 * cliquable pour agrandir dans une lightbox qui charge l'image originale à la
 * demande. Rendu mémorisé pour éviter les re-signatures d'URL inutiles.
 */
export const ProductCoverHero = memo(function ProductCoverHero({ produit, className }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const hasCover = !!produit.cover_thumb_path || !!produit.cover_path;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setThumbUrl(null);
    setFullUrl(null);
    if (!hasCover) return;
    getCoverUrl(produit, "thumb")
      .then((u) => {
        if (cancelled) return;
        if (!u) return setThumbUrl(null);
        const bust = produit.cover_updated_at
          ? `&v=${encodeURIComponent(produit.cover_updated_at)}`
          : "";
        setThumbUrl(u + bust);
      })
      .catch(() => !cancelled && setThumbUrl(null));
    return () => {
      cancelled = true;
    };
  }, [produit.cover_thumb_path, produit.cover_path, produit.cover_updated_at, hasCover, produit]);

  // Précharge l'image originale seulement à l'ouverture de la lightbox.
  useEffect(() => {
    if (!open || fullUrl) return;
    let cancelled = false;
    getCoverUrl(produit, "original")
      .then((u) => !cancelled && setFullUrl(u ?? thumbUrl))
      .catch(() => !cancelled && setFullUrl(thumbUrl));
    return () => {
      cancelled = true;
    };
  }, [open, fullUrl, produit, thumbUrl]);

  return (
    <div className={cn("flex justify-center sm:justify-start", className)}>
      {!hasCover || failed || !thumbUrl ? (
        <div className="flex h-48 w-36 items-center justify-center rounded-lg border bg-muted sm:h-56 sm:w-44">
          <span className="sr-only">Aucune couverture</span>
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="group relative h-48 w-36 overflow-hidden rounded-lg border bg-muted shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring sm:h-56 sm:w-44"
              aria-label="Agrandir la couverture"
            >
              <img
                src={thumbUrl}
                alt={produit.titre ? `Couverture — ${produit.titre}` : "Couverture produit"}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover"
                onError={() => setFailed(true)}
              />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl p-2 sm:p-4">
            <div className="flex items-center justify-center">
              <img
                src={fullUrl ?? thumbUrl}
                alt={produit.titre ? `Couverture — ${produit.titre}` : "Couverture produit"}
                className="max-h-[80vh] w-auto rounded-md object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});

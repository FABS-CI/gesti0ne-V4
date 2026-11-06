import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type Produit, deleteProductCover, uploadProductCover } from "@/lib/produits-api";
import { ProductCoverThumb } from "./ProductCoverThumb";
import { friendlyError } from "@/lib/friendly-error";

interface Props {
  produit: Produit;
  onChanged?: () => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Section « Couverture du produit » de la fiche : aperçu, téléversement,
 * remplacement et suppression. Formats JPG/PNG/WEBP, 5 Mo max. La miniature
 * WebP 256 px est générée automatiquement à l'upload.
 */
export function ProductCoverSection({ produit, onChanged }: Props) {
  const [current, setCurrent] = useState<Produit>(produit);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasCover = !!current.cover_thumb_path;

  const handlePick = () => fileRef.current?.click();

  const handleUpload = async (file: File) => {
    setBusy("upload");
    try {
      const updated = await uploadProductCover(current.produit_id, file);
      setCurrent(updated);
      toast.success("Couverture mise à jour");
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e, "Échec du téléversement"));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      await deleteProductCover(current.produit_id);
      setCurrent({
        ...current,
        cover_path: null,
        cover_thumb_path: null,
        cover_updated_at: new Date().toISOString(),
      });
      toast.success("Couverture supprimée");
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e, "Échec de la suppression"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <Label className="mb-2 block">Couverture du produit</Label>
      <div className="flex items-center gap-4">
        <ProductCoverThumb produit={current} size="lg" variant="thumb" />
        <div className="flex flex-1 flex-wrap gap-2">
          <Button
            type="button"
            variant={hasCover ? "outline" : "default"}
            size="sm"
            disabled={busy !== null}
            onClick={handlePick}
          >
            {busy === "upload" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : hasCover ? null : null}
            {hasCover ? "Remplacer l'image" : "Téléverser une image"}
          </Button>
          {hasCover && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              {busy === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Supprimer
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        JPG, PNG ou WEBP · 5 Mo max · une miniature WebP est générée automatiquement.
      </p>
    </div>
  );
}

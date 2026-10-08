import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Produit,
  deleteProductCover,
  uploadProductCover,
} from "@/lib/produits-api";
import { friendlyError } from '@/lib/friendly-error';

interface Props {
  produit: Produit;
  onChanged?: (updated?: Produit) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Actions compactes (Ajouter / Remplacer / Supprimer) de la couverture,
 * pensées pour être affichées à côté de la vignette dans l'en-tête produit.
 */
export function ProductCoverActions({ produit, onChanged }: Props) {
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasCover = !!produit.cover_thumb_path || !!produit.cover_path;

  const handleUpload = async (file: File) => {
    setBusy("upload");
    try {
      const updated = await uploadProductCover(produit.produit_id, file);
      toast.success("Couverture mise à jour");
      onChanged?.(updated);
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
      await deleteProductCover(produit.produit_id);
      toast.success("Couverture supprimée");
      onChanged?.();
    } catch (e) {
      toast.error(friendlyError(e, "Échec de la suppression"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={hasCover ? "outline" : "default"}
        size="sm"
        disabled={busy !== null}
        onClick={() => fileRef.current?.click()}
      >
        {busy === "upload" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : hasCover ? (
          <RefreshCw className="mr-2 h-4 w-4" />
        ) : (
          <ImagePlus className="mr-2 h-4 w-4" />
        )}
        {hasCover ? "Remplacer l'image" : "Ajouter une image"}
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
          {busy === "delete" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Supprimer
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        JPG, PNG ou WEBP · 5 Mo max
      </p>
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
  );
}

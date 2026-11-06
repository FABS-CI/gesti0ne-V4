import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { PdfPreviewModal } from "./PdfPreviewModal";
import {
  getOrCreatePdf,
  pdfCacheKey,
  invalidatePdfByPrefix,
  pdfCacheKeyPrefix,
} from "@/lib/pdf/pdfCache";
import { downloadBlob } from "@/lib/pdf/fabsTemplates";
import { printCached } from "@/lib/pdf/actions";
import type { FabsDocCode } from "@/lib/pdf/docTypeConfig";

type Props = {
  type: FabsDocCode;
  reference: string;
  /** updated_at ou version — change ⇒ régénération automatique. */
  version?: string | number | null;
  filename: string;
  generate: () => Promise<Blob>;
  /** Force la purge des versions antérieures (ex. après un edit local). */
  invalidatePrevious?: boolean;
};

/**
 * Bouton Aperçu + Télécharger + Imprimer harmonisé. Toutes les actions
 * partagent le même Blob via pdfCache (clé = type:reference:version).
 */
export function PdfActions({
  type,
  reference,
  version,
  filename,
  generate,
  invalidatePrevious,
}: Props) {
  const [open, setOpen] = useState(false);
  const key = pdfCacheKey(type, reference, version);

  const load = async () => {
    if (invalidatePrevious) invalidatePdfByPrefix(pdfCacheKeyPrefix(type, reference));
    return getOrCreatePdf(key, generate);
  };

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" title="Aperçu" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        title="Télécharger"
        onClick={async () => downloadBlob(await load(), filename)}
      >
        Télécharger
      </Button>
      <Button size="sm" variant="ghost" title="Imprimer" onClick={() => printCached(key, generate)}>
        Imprimer
      </Button>
      <PdfPreviewModal
        open={open}
        onOpenChange={setOpen}
        title={`${type} ${reference}`}
        filename={filename}
        load={load}
      />
    </div>
  );
}

import { friendlyError } from "@/lib/friendly-error";
import type { ComponentType, ReactNode } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SuperAdminDeleteButton } from "./SuperAdminDeleteButton";
import { printCached, viewCached, emailDoc } from "@/lib/pdf/actions";
import { getOrCreatePdf } from "@/lib/pdf/pdfCache";
import { downloadBlob } from "@/lib/pdf/fabsTemplates";

/**
 * Barre d'actions unifiée pour les documents Commandes / Proformas /
 * Factures (Lot B). Icônes, ordre et couleurs partagés.
 *
 * Ordre standard : Visualiser · Aperçu PDF · Télécharger · Imprimer ·
 *                  Email · Valider · Modifier · Transformer · Supprimer
 */
export type DocumentActionsProps = {
  /** Route TanStack vers la page détail (Visualiser). */
  viewTo?: string;
  /** Route TanStack vers la page d'édition (Modifier). */
  editTo?: string;
  /** Clé de cache PDF (pdfCacheKey(type, ref, version)). */
  cacheKey: string;
  /** Factory de génération du Blob PDF (partagée avec le cache). */
  buildBlob: () => Promise<Blob>;
  /** Nom de fichier téléchargé. */
  filename: string;
  /** Sujet email prérempli. */
  emailSubject: string;
  /** Corps email prérempli. */
  emailBody?: string;
  /** Handler Valider (si l'action est disponible). */
  onValidate?: () => void;
  /** Handler Transformer (BL / Facture / etc.). */
  onTransform?: () => void;
  /** Libellé du bouton Transformer (défaut : "Transformer"). */
  transformLabel?: string;
  /** Icône du bouton Transformer (par défaut Repeat). */
  transformIcon?: ComponentType<{ className?: string }>;
  /** Handler Supprimer + libellé de l'entité (Super Admin uniquement). */
  delete?: {
    entityLabel: string;
    onConfirm: () => Promise<void>;
    invalidateKeys?: readonly (readonly unknown[])[];
  };
  /** Indicateur de chargement (téléchargement/aperçu). */
  loading?: boolean;
  /** Progression 0-100 (téléchargement). */
  progress?: number;
  /** Slot supplémentaire (badges, actions spécifiques). */
  extra?: ReactNode;
};

export function DocumentActions({
  viewTo,
  editTo,
  cacheKey,
  buildBlob,
  filename,
  emailSubject,
  emailBody,
  onValidate,
  onTransform,
  transformLabel = "Transformer",
  delete: del,
  loading,
  progress,
  extra,
}: DocumentActionsProps) {
  const safe = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
    } catch (e) {
      toast.error(friendlyError(e, msg));
    }
  };

  return (
    <span className="inline-flex items-center justify-end gap-1 align-middle">
      {viewTo && (
        <Button aria-label="Visualiser" asChild variant="ghost" size="sm" title="Visualiser">
          <Link to={viewTo}>Voir</Link>
        </Button>
      )}
      <Button
        aria-label="Aperçu PDF"
        variant="ghost"
        size="sm"
        title="Aperçu PDF"
        onClick={() => safe(() => viewCached(cacheKey, buildBlob), "Erreur aperçu")}
      >
        Aperçu PDF
      </Button>
      <Button
        aria-label="Télécharger PDF"
        variant="ghost"
        size="sm"
        title="Télécharger PDF"
        disabled={loading}
        onClick={() =>
          safe(async () => {
            const blob = await getOrCreatePdf(cacheKey, buildBlob);
            downloadBlob(blob, filename);
          }, "Erreur téléchargement")
        }
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Télécharger"}
      </Button>
      <Button
        aria-label="Imprimer"
        variant="ghost"
        size="sm"
        title="Imprimer"
        onClick={() => safe(() => printCached(cacheKey, buildBlob), "Erreur impression")}
      >
        Imprimer
      </Button>
      <Button
        aria-label="Envoyer par email"
        variant="ghost"
        size="sm"
        title="Envoyer par email"
        onClick={() => emailDoc({ subject: emailSubject, body: emailBody })}
      >
        Email
      </Button>
      {onValidate && (
        <Button
          aria-label="Valider"
          variant="ghost"
          size="sm"
          title="Valider"
          onClick={onValidate}
          className="text-success hover:text-success"
        >
          Valider
        </Button>
      )}
      {editTo && (
        <Button aria-label="Modifier" asChild variant="ghost" size="sm" title="Modifier">
          <Link to={editTo}>Modifier</Link>
        </Button>
      )}
      {onTransform && (
        <Button
          aria-label={transformLabel}
          variant="ghost"
          size="sm"
          title={transformLabel}
          onClick={onTransform}
          className="text-primary hover:text-primary/80"
        >
          {transformLabel}
        </Button>
      )}
      {extra}
      {typeof progress === "number" && loading && (
        <Progress value={progress} className="h-1 w-16" />
      )}
      {del && (
        <SuperAdminDeleteButton
          entityLabel={del.entityLabel}
          onConfirm={del.onConfirm}
          invalidateKeys={del.invalidateKeys}
        />
      )}
    </span>
  );
}

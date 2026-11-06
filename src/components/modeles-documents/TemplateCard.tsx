import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Eye } from "lucide-react";
import type { PdfTemplate, PdfTemplateId } from "@/lib/pdf/pdfConfig";
import { Apercu } from "./Apercu";
import { Can } from "@/components/rbac/Can";

type Props = {
  t: PdfTemplate;
  active: boolean;
  onChoose: (id: PdfTemplateId) => void;
  onApercuPdf: (id: PdfTemplateId) => void;
  onDuplicate: (t: PdfTemplate) => void;
  onEdit: (t: PdfTemplate) => void;
  onDelete: (t: PdfTemplate) => void;
};

export const TemplateCard = React.memo(function TemplateCard({
  t,
  active,
  onChoose,
  onApercuPdf,
  onDuplicate,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Card
      className={`flex flex-col gap-3 p-4 transition-all ${
        active ? "ring-2 ring-primary" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{t.label}</span>
          {t.custom && <Badge variant="outline">Perso</Badge>}
          {active && (
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" /> Actif
            </Badge>
          )}
        </div>
      </div>
      <Apercu t={t} />
      <p className="min-h-[32px] text-xs text-muted-foreground">{t.description}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={active ? "secondary" : "default"}
          className="flex-1"
          onClick={() => onChoose(t.id)}
          disabled={active}
        >
          {active ? "Sélectionné" : "Utiliser"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onApercuPdf(t.id)}>
          <Eye className="mr-1 h-4 w-4" /> PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDuplicate(t)}
          title="Dupliquer ce modèle"
        >
          Dupliquer
        </Button>
        {t.custom && (
          <>
            <Button size="sm" variant="outline" onClick={() => onEdit(t)}>
              Modifier
            </Button>
            <Can permission="modeles_documents.supprimer">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(t)}
                className="text-destructive"
              >
                Supprimer
              </Button>
            </Can>
          </>
        )}
      </div>
    </Card>
  );
});

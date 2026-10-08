import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from '@/lib/friendly-error';
import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_TEMPLATE,
  getActiveTemplate,
  getAllTemplates,
  type PdfTemplate,
  type PdfTemplateId,
} from "@/lib/pdf/pdfConfig";
import {
  syncDocumentTemplates,
  setActiveTemplatePref,
  createCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
} from "@/lib/document-templates-api";
import {
  loadDocumentSettings,
  saveDocumentSettings,
  type DocType,
  type DocumentSettings,
} from "@/lib/document-settings-api";
import {
  generateFacturePDF as generateFacturePDFv10,
  downloadBlob,
  fileNameFor,
} from "@/lib/pdf/fabsTemplates";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { blankForm, type FormState } from "@/lib/modeles-documents-helpers";
import { LogoAndPerTypeCard } from "@/components/modeles-documents/LogoAndPerTypeCard";
import { TemplateCard } from "@/components/modeles-documents/TemplateCard";
import { TemplateEditorDialog } from "@/components/modeles-documents/TemplateEditorDialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/modeles-documents")({
  component: ModelesDocuments,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ModelesDocuments() {
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const [templates, setTemplates] = useState<PdfTemplate[]>(getAllTemplates());
  const [selected, setSelected] = useState<PdfTemplateId>(getActiveTemplate().id);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<DocumentSettings>({
    selected_template: getActiveTemplate().id,
    template_per_type: {},
    logo_url: null,
  });

  const refresh = async () => {
    try {
      const [{ templates: all, activeId }, s] = await Promise.all([
        syncDocumentTemplates(),
        loadDocumentSettings().catch(() => null),
      ]);
      setTemplates(all);
      setSelected(activeId);
      if (s) setSettings(s);
    } catch {
      toast.error("Impossible de charger les modèles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const choose = async (id: PdfTemplateId) => {
    setSelected(id);
    const label = templates.find((t) => t.id === id)?.label;
    try {
      await setActiveTemplatePref(id);
      await saveDocumentSettings({ selected_template: id });
      setSettings((s) => ({ ...s, selected_template: id }));
      toast.success(`Modèle « ${label} » appliqué à tous les documents`);
    } catch {
      toast.error("Impossible d'enregistrer la préférence");
    }
  };

  const setTemplateForType = async (type: DocType, id: PdfTemplateId | "_default") => {
    const next = { ...settings.template_per_type };
    if (id === "_default") delete next[type];
    else next[type] = id;
    setSettings((s) => ({ ...s, template_per_type: next }));
    try {
      await saveDocumentSettings({ template_per_type: next });
      toast.success("Préférence enregistrée");
    } catch {
      toast.error("Échec d'enregistrement");
    }
  };

  const onLogoFile = async (file: File | null) => {
    if (!file) {
      setSettings((s) => ({ ...s, logo_url: null }));
      try {
        await saveDocumentSettings({ logo_url: null });
        toast.success("Logo supprimé");
      } catch {
        toast.error("Échec");
      }
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error("Logo trop volumineux (max 512 Ko)");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    setSettings((s) => ({ ...s, logo_url: dataUrl }));
    try {
      await saveDocumentSettings({ logo_url: dataUrl });
      toast.success("Logo enregistré");
    } catch {
      toast.error("Échec d'enregistrement du logo");
    }
  };

  const apercuPdf = async (_id: PdfTemplateId) => {
    try {
      const blob = await generateFacturePDFv10({
        reference: "FA-2026-00042",
        date: new Date().toISOString().slice(0, 10),
        clientNom: "Lycée Moderne d'Abidjan",
        totalVente: 765_000,
        montantHT: 765_000,
        lignes: [
          { reference: "Manuel scolaire CE1", qte: 100, prixUnitaire: 2500, montant: 250_000 },
          {
            reference: "Cahier de travaux pratiques",
            qte: 80,
            prixUnitaire: 1500,
            montant: 120_000,
          },
          {
            reference: "Guide pédagogique enseignant",
            qte: 30,
            prixUnitaire: 5000,
            montant: 150_000,
          },
        ],
      });
      downloadBlob(blob, fileNameFor("FA-2026-00042", "Apercu"));
    } catch (e) {
      toast.error(friendlyError(e, "Erreur d'aperçu"));
    }
  };

  const apercuCycle = async () => {
    try {
      const blob = await generateFacturePDFv10({
        reference: "FA-APERCU-CYCLE",
        date: new Date().toISOString().slice(0, 10),
        clientNom: "Lycée Moderne d'Abidjan",
        totalVente: 1_215_000,
        montantHT: 1_215_000,
        paye: 500_000,
        soldeDu: 715_000,
        lignes: [
          {
            cycle: "PRIMAIRE",
            niveau: "CE1",
            matiere: "Français",
            reference: "Manuel de lecture CE1",
            qte: 100,
            prixUnitaire: 2500,
            montant: 250_000,
          },
          {
            cycle: "PRIMAIRE",
            niveau: "CM2",
            matiere: "Maths",
            reference: "Cahier d'exercices CM2",
            qte: 80,
            prixUnitaire: 1800,
            montant: 144_000,
          },
          {
            cycle: "PREMIER CYCLE",
            niveau: "5e",
            matiere: "SVT",
            reference: "Manuel SVT 5e",
            qte: 60,
            prixUnitaire: 3500,
            montant: 210_000,
          },
          {
            cycle: "PREMIER CYCLE",
            niveau: "3e",
            matiere: "Histoire-Géo",
            reference: "Atlas Histoire 3e",
            qte: 40,
            prixUnitaire: 4200,
            montant: 168_000,
          },
          {
            cycle: "SECOND CYCLE",
            niveau: "Terminale D",
            matiere: "Physique",
            reference: "Manuel Physique Term D",
            qte: 30,
            prixUnitaire: 5500,
            montant: 165_000,
          },
          {
            cycle: "SECOND CYCLE",
            niveau: "1ère A",
            matiere: "Philosophie",
            reference: "Cahier Philo 1ère A",
            qte: 35,
            prixUnitaire: 3800,
            montant: 133_000,
          },
          {
            cycle: "LIVRES COMMUNS",
            reference: "Dictionnaire Larousse",
            qte: 20,
            prixUnitaire: 7250,
            montant: 145_000,
          },
        ],
      });
      downloadBlob(blob, fileNameFor("FA-APERCU-CYCLE", "Apercu"));
      toast.success("Aperçu généré : vérifiez les bandeaux et sous-totaux par cycle");
    } catch (e) {
      toast.error(friendlyError(e, "Erreur d'aperçu"));
    }
  };

  const apercuPdfActif = async () => {
    try {
      const blob = await generateFacturePDFv10({
        reference: "FA-APERCU",
        date: new Date().toISOString().slice(0, 10),
        clientNom: "Aperçu",
        totalVente: 25_000,
        montantHT: 25_000,
        lignes: [{ reference: "Article démo", qte: 10, prixUnitaire: 2500, montant: 25_000 }],
      });
      downloadBlob(blob, fileNameFor("FA-APERCU", "Apercu"));
    } catch (e) {
      toast.error(friendlyError(e, "Erreur d'aperçu"));
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm());
    setEditorOpen(true);
  };

  const openEdit = (t: PdfTemplate) => {
    setEditingId(t.id);
    const { id: _id, custom: _custom, ...rest } = t;
    setForm({ ...rest, footerNote: t.footerNote ?? "" });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateCustomTemplate(editingId, form);
        toast.success("Modèle mis à jour");
      } else {
        await createCustomTemplate(form);
        toast.success("Modèle personnalisé créé");
      }
      setEditorOpen(false);
      await refresh();
    } catch {
      toast.error("Échec de l'enregistrement du modèle");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: PdfTemplate) => {
    const r = await confirm({
      title: "Supprimer ce modèle ?",
      entityLabel: "le modèle",
      entityName: t.label,
    });
    if (r === false) return;
    try {
      await deleteCustomTemplate(t.id);
      if (selected === t.id) await setActiveTemplatePref(DEFAULT_TEMPLATE.id);
      toast.success("Modèle supprimé");
      await refresh();
    } catch {
      toast.error("Suppression impossible");
    }
  };

  const handleDuplicate = (t: PdfTemplate) => {
    const { id: _id, custom: _custom, ...rest } = t;
    setEditingId(null);
    setForm({ ...rest, label: `${t.label} (copie)`, footerNote: t.footerNote ?? "" });
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="ds-page-title">Modèles de documents</h1>
            <p className="text-sm text-muted-foreground">
              Le modèle choisi est enregistré sur votre compte et appliqué à tous vos documents de
              vente. Sans choix, le modèle par défaut « {DEFAULT_TEMPLATE.label} » est utilisé.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Nouveau modèle
        </Button>
      </div>

      <LogoAndPerTypeCard
        settings={settings}
        templates={templates}
        onLogoFile={(f) => void onLogoFile(f)}
        setTemplateForType={(type, id) => void setTemplateForType(type, id)}
        onApercuCycle={() => void apercuCycle()}
      />

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des modèles…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              active={selected === t.id}
              onChoose={choose}
              onApercuPdf={apercuPdf}
              onDuplicate={handleDuplicate}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <TemplateEditorDialog
        open={editorOpen}
        setOpen={setEditorOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={handleSave}
        onApercuPdfActif={() => void apercuPdfActif()}
      />
      {confirmDialog}
    </div>
  );
}

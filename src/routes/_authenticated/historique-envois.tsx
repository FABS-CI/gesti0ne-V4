import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const CANAUX = [
  { value: "email", label: "Email", color: "#3B82F6" },
  { value: "whatsapp", label: "WhatsApp", color: "#10B981" },
  { value: "sms", label: "SMS", color: "#F97316" },
];

const STATUTS = [
  { value: "envoye", label: "Envoyé", color: "#10B981" },
  { value: "en_attente", label: "En attente", color: "#F97316" },
  { value: "echec", label: "Échec", color: "#EF4444" },
];

export const Route = createFileRoute("/_authenticated/historique-envois")({
  component: () => (
    <ResourceManager
      config={{
        table: "historique_envois",
        idField: "envoi_id",
        title: "Historique des envois",
        subtitle: "Journal multi-canal (email, WhatsApp, SMS)",
        newLabel: "Nouvel envoi",
        entityLabel: "envoi",
        searchFields: ["destinataire", "sujet", "document_type"],
        csvName: "historique-envois",
        statusFilter: { field: "statut", options: STATUTS },
        columns: [
          { name: "canal", label: "Canal", type: "badge", options: CANAUX },
          { name: "destinataire", label: "Destinataire" },
          { name: "sujet", label: "Sujet" },
          { name: "document_type", label: "Type doc" },
          { name: "statut", label: "Statut", type: "badge", options: STATUTS },
          { name: "created_at", label: "Date", type: "date" },
        ],
        fields: [
          { name: "canal", label: "Canal", type: "select", options: CANAUX, required: true },
          { name: "destinataire", label: "Destinataire", required: true },
          { name: "sujet", label: "Sujet", colSpan: 2 },
          { name: "contenu", label: "Contenu", type: "textarea", colSpan: 2 },
          { name: "document_type", label: "Type de document" },
          { name: "statut", label: "Statut", type: "select", options: STATUTS, default: "envoye" },
        ],
      }}
    />
  ),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

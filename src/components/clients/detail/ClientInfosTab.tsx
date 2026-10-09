import { Mail, MapPin, Phone, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "./shared";
import { formatFCFA } from "@/lib/format";
import type { Client } from "@/lib/clients-api";
import type { TYPE_COLOR } from "@/lib/company";

type TypeColor = ReturnType<typeof Object.values<(typeof TYPE_COLOR)[keyof typeof TYPE_COLOR]>>;

interface ClientInfosTabProps {
  client: Client;
  typeLabel: string;
}

export function ClientInfosTab({ client, typeLabel }: ClientInfosTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {client.ancien_nom && (
            <Info icon={<User className="h-4 w-4" />} label="Ancien nom" value={client.ancien_nom} />
          )}
          <Info
            icon={<User className="h-4 w-4" />}
            label="Représentant"
            value={client.representant}
          />
          <Info icon={<Phone className="h-4 w-4" />} label="Téléphone" value={client.telephone} />

          <Info icon={<Mail className="h-4 w-4" />} label="Email" value={client.email} />
          <Info icon={<MapPin className="h-4 w-4" />} label="Adresse" value={client.adresse} />
          <Info icon={<MapPin className="h-4 w-4" />} label="Quartier" value={client.quartier} />
          <Info
            icon={<MapPin className="h-4 w-4" />}
            label="Ville"
            value={client.ville}
            testId="readonly-ville"
          />
          <Info
            icon={<MapPin className="h-4 w-4" />}
            label="Commune"
            value={client.commune}
            testId="readonly-commune"
          />
          <Info label="BP" value={client.bp} />
          <Info label="Pays" value={client.pays} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Fiscal & commercial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Type" value={typeLabel} />
          <Info label="Catégorie" value={client.categorie} />
          <Info label="Secteur d'activité" value={client.secteur_activite} />
          <Info label="NIF" value={client.nif} />
          <Info label="Régime fiscal" value={client.regime_fiscal} />
          <Info label="Mode de paiement" value={client.mode_paiement} />
          <Info
            label="Délai de paiement"
            value={client.delai_paiement != null ? `${client.delai_paiement} j` : null}
          />
          <Info
            label="Remise habituelle"
            value={client.remise_habituelle != null ? `${client.remise_habituelle} %` : null}
          />
          <Info label="Plafond de crédit" value={formatFCFA(client.plafond_credit)} />
          <Info
            label="Statut"
            value={
              client.actif
                ? "Actif"
                : `Bloqué${client.motif_blocage ? ` — ${client.motif_blocage}` : ""}`
            }
          />
        </CardContent>
      </Card>

      {client.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-sm text-muted-foreground whitespace-pre-wrap">
            {client.notes}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

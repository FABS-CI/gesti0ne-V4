import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";

export type RetourEncours = { solde: number; reserve: number; disponible: number };

export async function getRetourEncours(clientId: string): Promise<RetourEncours> {
  const { data, error } = await supabase.rpc("retour_encours_disponible", { _client_id: clientId });
  if (error) throw error;
  const result = data as RetourEncours;
  if (!result || ![result.solde, result.reserve, result.disponible].every(Number.isFinite)) {
    throw new Error("Encours indisponible. Réessayez avant d’enregistrer le retour.");
  }
  return result;
}

export function retourEncoursMessage(encours: RetourEncours, montant: number): string | null {
  if (encours.solde <= 0) {
    return "Retour impossible : ce client ne présente aucun encours débiteur. Les retours sont autorisés uniquement dans la limite de sa dette actuelle.";
  }
  if (montant > encours.disponible) {
    return `Retour impossible : le montant du retour dépasse l'encours disponible du client. Encours disponible : ${formatFCFA(encours.disponible)}. Montant du retour : ${formatFCFA(montant)}.`;
  }
  return null;
}
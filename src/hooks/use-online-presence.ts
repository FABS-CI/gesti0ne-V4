import { useEffect, useState } from "react";
import { subscribePresence } from "@/lib/presence-channel";

export type OnlinePresence = {
  user_id: string;
  email: string;
  nom_complet: string | null;
  prenom: string | null;
  fonction: string | null;
  connected_at: string;
  last_activity: string;
  user_agent: string | null;
  url: string | null;
  // Enrichissements client (résolus au montage de usePresenceBroadcast)
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  isp: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
};

/**
 * Abonnement en lecture seule à la présence Realtime `app-presence`.
 * Passe par un singleton (`src/lib/presence-channel.ts`) qui enregistre les
 * handlers `.on('presence', …)` avant `subscribe()` — ce qui évite l'erreur
 * « cannot add presence callbacks after subscribe() » quand plusieurs
 * consommateurs (broadcast + observers) partagent le même topic.
 */
export function useOnlinePresence() {
  const [presences, setPresences] = useState<OnlinePresence[]>([]);
  useEffect(() => subscribePresence(setPresences), []);
  return presences;
}

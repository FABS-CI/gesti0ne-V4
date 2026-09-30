// Construit le PDF du relevé client ; les données viennent de releve-data.ts (source unique).
import { generateEtatCompteClientPDF } from "@/lib/pdf/fabsTemplates";
import { loadReleveClient, type EtatCompteClientArgs } from "@/lib/pdf/releve-data";

export { loadReleveClient };
export type { EtatCompteClientArgs, ReleveClientData } from "@/lib/pdf/releve-data";

export async function buildEtatCompteClientPDF(args: EtatCompteClientArgs): Promise<Blob> {
  const data = await loadReleveClient(args);
  return generateEtatCompteClientPDF({ ...data, client: { ...data.client, reference: data.client.code } });
}

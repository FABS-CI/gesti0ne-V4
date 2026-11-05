/** Display the combined invoice discount without applying it twice. */
export function retourLineAmounts(input: {
  prix: number;
  quantite: number;
  remisePct: number;
  remiseGlobalePct: number;
  remiseMontant?: number | null;
  totalLigne?: number | null;
}) {
  const brut = input.prix * input.quantite;
  const remiseLigne = input.remiseMontant ?? brut * input.remisePct / 100;
  const netAvantGlobale = input.totalLigne ?? brut - remiseLigne;
  const net = netAvantGlobale * (1 - input.remiseGlobalePct / 100);
  return {
    brut,
    remiseLigne,
    netAvantGlobale,
    net,
    remiseEffectivePct: brut === 0 ? 0 : 100 * (1 - net / brut),
    remiseEffectiveMontant: brut - net,
  };
}

/** Origin labels only: invoice numbering and all stored references stay intact. */
export function retourOriginReference(ref: string): string {
  return ref.replace(/^(CMD|BC|BL)-(\d{2}|\d{4})-0*(\d+)$/i,
    (_match, prefix: string, year: string, number: string) => `${prefix}-${year}-${Number(number)}`);
}
import { describe, expect, it } from 'vitest';
import { paiementDetteMessage, paiementEntierementAffecte } from './paiement-dette';

describe('paiement limité à la dette', () => {
  it.each([0, -10000])('bloque une dette de %i', solde => {
    expect(paiementDetteMessage({ solde, reserve: 0, disponible: 0 }, 1)).not.toBeNull();
  });
  it('autorise 300 000 sur 500 000', () => {
    expect(paiementDetteMessage({ solde: 500000, reserve: 0, disponible: 500000 }, 300000)).toBeNull();
  });
  it('autorise le paiement intégral de 500 000', () => {
    expect(paiementDetteMessage({ solde: 500000, reserve: 0, disponible: 500000 }, 500000)).toBeNull();
  });
  it('refuse 600 000 sur 500 000', () => {
    expect(paiementDetteMessage({ solde: 500000, reserve: 0, disponible: 500000 }, 600000)).not.toBeNull();
  });
  it('limite à la sélection de deux factures de 100 000 et 200 000', () => {
    expect(paiementDetteMessage({ solde: 500000, reserve: 0, disponible: 500000 }, 300000, 100000 + 200000)).toBeNull();
    expect(paiementDetteMessage({ solde: 500000, reserve: 0, disponible: 500000 }, 300001, 300000)).not.toBeNull();
  });
  it('réserve 300 000 en attente sans compter deux fois', () => {
    expect(paiementDetteMessage({ solde: 500000, reserve: 300000, disponible: 200000 }, 200001)).not.toBeNull();
  });
  it('refuse tout surplus non affecté', () => {
    expect(paiementEntierementAffecte(600000, 500000)).toBe(false);
    expect(paiementEntierementAffecte(500000, 500000)).toBe(true);
    expect(paiementEntierementAffecte(500000.01, 500000)).toBe(false);
  });
});
# Correction ciblée des PDF de facture et des frais de transport

## Résultat attendu

- Les PDF générés depuis la liste des factures et depuis les commandes affichent toujours le montant payé et le reste à payer réels.
- La validation immédiate d’une nouvelle commande ouvre la même fenêtre « Frais de transport » que la validation différée.
- Le choix livraison, expédition ou aucun frais est transmis à la validation unique qui crée la facture et le bon de livraison.

## Modifications

1. **Actions PDF depuis les commandes**
   - Charger aussi l’identifiant interne de la facture.
   - Le transmettre comme `id` et `facture_id` au générateur PDF existant.

2. **Actions PDF depuis la liste des factures**
   - Transmettre `facture_id` au même générateur.
   - Conserver la fonction centrale actuelle de calcul des paiements, sans nouvelle formule.

3. **Validation immédiate d’une commande**
   - Remplacer l’envoi direct après « Valider la facture » par l’ouverture de la fenêtre existante des frais de transport.
   - Ajouter le choix confirmé au formulaire envoyé lors de la création.
   - Étendre la création côté base afin qu’elle appelle la validation existante avec ces frais dans la même opération.
   - Ne pas modifier la validation différée, déjà correcte.

4. **Contrôles**
   - Ajouter des tests ciblés sur la transmission de l’identifiant facture et des frais.
   - Vérifier le contrôle TypeScript et les tests concernés.
   - Tester le PDF de `FAC-2026-00024` depuis les deux points d’entrée et confirmer `136 000 FCFA` payé, `200 000 FCFA` restant.
   - Tester la fenêtre en validation immédiate avec aucun frais, livraison et expédition, puis confirmer les valeurs créées sur commande et facture.

## Détails techniques

- Fichiers principaux : `src/lib/commandes-pdf-actions.ts`, `src/components/factures/list/FacturePdfActions.tsx`, `src/components/commandes/CommandeForm.tsx`, `src/lib/commandes-api.ts`.
- Une migration additive remplacera uniquement la définition de `creer_commande(jsonb)` pour lire les deux champs de transport et les transmettre à `valider_commande`; aucune table ni logique parallèle ne sera créée.
- Le calcul central `calculateInvoicePaymentStatus`, le rendu des totaux, le QR et la validation différée resteront inchangés.

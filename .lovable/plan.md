# Correction du relevé client et du bon de retour

## Objectif
Corriger les deux documents sans modifier les données métier ni créer une logique parallèle, puis reprendre les lots de qualité déjà ouverts.

## Étapes
1. **Relevé de compte client**
   - Vérifier les sources actuelles des factures, affectations de paiements et retours validés.
   - Faire correspondre exactement les lignes affichées, les totaux et le solde progressif.
   - Compter dans « Total Paiement » uniquement les montants réellement affectés et validés.
   - Afficher les retours séparément, une seule fois au crédit, sans double déduction.
   - Contrôler le cas LIBRAIRIE BELLO attendu à 15 900 000 FCFA lorsque le retour de 100 000 FCFA est financièrement validé.

2. **Bon de retour**
   - Réutiliser les liens existants entre retour, facture, client, lignes, dépôt et validations.
   - Remplir automatiquement toutes les informations disponibles; ne rien inventer.
   - Conserver les calculs, statuts, contrôles métier et informations de traçabilité existants.
   - Vérifier que les lignes et informations longues restent entièrement visibles dans le PDF.

3. **Validation**
   - Ajouter ou adapter les tests ciblés des calculs sans écrire de données métier.
   - Vérifier les deux PDF avec des données existantes et contrôler l’absence d’erreur dans l’application.
   - Mettre à jour la liste des travaux avec les résultats et les éventuels blocages réels.

4. **Suite des lots**
   - Terminer le Lot 3, puis les Lots 4 et 5.
   - Réaliser le Lot 6A en audit uniquement et présenter ses conclusions avant toute correction.

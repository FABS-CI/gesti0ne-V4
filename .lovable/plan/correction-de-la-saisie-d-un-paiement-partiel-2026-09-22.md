# Correction de la saisie d’un paiement partiel

## Objectif
Éviter l’erreur « Le total affecté aux factures dépasse le montant reçu » lorsque le montant payé est réduit après sélection des factures.

## Modifications
- Faire du champ « Montant payé » la source du montant réellement reçu.
- Réajuster automatiquement les affectations des factures sélectionnées, sans dépasser leur solde.
- Conserver la possibilité d’ajuster ensuite chaque affectation manuellement.
- Garder le contrôle bloquant comme sécurité si une incohérence subsiste.
- Ajouter des tests sur paiement partiel, paiement multi-factures et montant supérieur aux soldes.

## Validation
- Vérifier que 30 000 FCFA saisis sur une facture de 70 000 affectent automatiquement 30 000 FCFA.
- Vérifier la répartition sur plusieurs factures.
- Vérifier l’absence d’erreur TypeScript et la non-régression des calculs.

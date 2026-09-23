# Frais de transport (livraison ou expédition)

## Ce que ça change pour vous

- Une commande en attente reste inchangée : aucun champ transport visible.
- Au clic sur « Valider », une petite fenêtre s'ouvre : **Aucun frais** (par défaut), **Frais de livraison** ou **Frais d'expédition**, avec un montant en FCFA demandé uniquement si un type est choisi.
- « Annuler » ferme la fenêtre sans rien valider ; « Confirmer et valider » enchaîne la validation habituelle (facture + bon de livraison).
- La facture, son récapitulatif à l'écran et son PDF affichent une seule ligne de transport (ou aucune), et le total inclut ce montant.
- Le menu Rapports reçoit une entrée « Frais de transport » avec filtres, indicateurs, graphiques, tableau détaillé et export.

## Résultat de l'audit (rien n'existe encore)

- Aucune colonne ni logique de frais de transport dans les commandes ou les factures.
- La validation passe par une seule opération en base (`valider_commande`) qui vérifie la permission `commandes.valider`, décrémente le stock, crée la facture et le BL, puis recalcule le solde client. C'est le point d'entrée à étendre — pas à remplacer.
- Le bouton « Valider » est branché dans la liste des commandes via `useCommandesList` → `validerCommande`.
- Les PDF passent tous par un générateur unique (`base-document` / `commercial-document` / `unified-generator`) dont le bloc totaux est centralisé.
- Les rapports sont pilotés par une liste de définitions déclaratives avec permissions et export.

## Mise en œuvre

### Base de données (une migration additive)
- `commandes` et `factures` : ajout de `type_frais_transport` (texte nullable, valeurs `livraison` / `expedition`) et `montant_frais_transport` (numérique nullable).
- Contrainte de cohérence : type absent ⇒ montant nul ou absent ; type présent ⇒ montant ≥ 0. Un seul champ de type ⇒ livraison + expédition simultanés impossibles par construction.
- Index sur `type_frais_transport` pour le rapport.
- Aucune colonne supprimée, aucune donnée touchée (tout est nullable, l'historique reste valide).

### Validation transactionnelle
- Nouvelle signature de `valider_commande(_commande_id, _type_frais_transport default null, _montant_frais_transport default null)` : mêmes contrôles qu'aujourd'hui, plus la validation du couple type/montant, l'enregistrement sur la commande **et** sur la facture créée, et l'ajout du montant au total facturé. Tout reste dans une seule transaction (rollback complet en cas d'échec).
- L'appel existant sans frais continue de fonctionner à l'identique (paramètres optionnels), donc `creer_commande`, `convertir_proforma_en_commande` et les autres appels internes ne changent pas.
- Ré-validation d'une commande déjà validée : toujours refusée (verrou implicite sur une facture déjà émise).
- Trace d'audit : réutilisation du mécanisme existant, avec type (ou « Aucun ») et montant.

### Interface
- Nouveau composant `FraisTransportDialog` (composants UI déjà présents : Dialog, RadioGroup, Input, Button), responsive, montant numérique ≥ 0 requis seulement si un type est choisi, double-clic bloqué.
- `commandes.index.tsx` : le bouton « Valider » ouvre le dialogue et transmet le choix à la mutation ; `useCommandesList` / `cycle-vente.validerCommande` acceptent les deux paramètres optionnels.
- Détail facture : ligne « Frais de livraison » ou « Frais d'expédition » insérée dans le récapitulatif, avant le total, uniquement si renseignée.

### PDF
- Ajout d'une ligne optionnelle dans le bloc totaux du générateur existant, entre le sous-total/remise et le total à payer. Aucun nouveau générateur, aucun changement pour les autres documents.

### Rapports
- Fonction d'agrégation en base (KPI + séries par période + répartition + par client) pour éviter de charger les factures dans le navigateur, avec les mêmes règles d'accès que les factures.
- Nouvelle page « Frais de transport » branchée sur la navigation, les filtres, le tableau et l'export existants (Excel/PDF, filtres conservés). Les documents sans frais sont exclus des totaux.

### Tests
- Tests unitaires sur la règle type/montant (les 14 cas listés, dont montant vide, montant négatif, aucun type, double validation).
- Vérification réelle : validation sans frais, avec livraison, avec expédition, puis contrôle de la facture, du PDF et du rapport filtré.

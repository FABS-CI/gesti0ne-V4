# Paiements limités à la dette réelle

## Résultat attendu
- Refuser tout paiement lorsque le client ne doit rien ou présente un solde créditeur.
- Limiter le montant reçu à la dette réellement disponible et au reste dû des factures sélectionnées.
- Conserver les paiements globaux sur plusieurs factures et la validation actuelle.
- Empêcher les dépassements simultanés et les doubles soumissions sans modifier les anciens paiements.

## Constat vérifié
Les contrôles actuels plafonnent les affectations par facture, mais ne vérifient pas la dette globale du client après les retours validés. Le montant reçu peut également être supérieur au total affecté. La clé anti-doublon existe déjà, mais sa lecture intervient avant le verrouillage commun. Les 115 paiements actuels ont tous une clé et un montant entièrement affecté ; leurs valeurs resteront inchangées.

## Modifications
1. Ajouter un contrôle centralisé de la dette réelle lors de l'enregistrement et de la validation. Les paiements en attente réservent leur montant sans réduire le solde comptable ; rejet ou annulation libèrent cette capacité.
2. Exiger un montant reçu entièrement affecté aux factures choisies, sans dépassement client ni facture. Garder les règlements multi-factures ; ne pas rendre obligatoire la ventilation sur les lignes de produits.
3. Sécuriser les nouvelles opérations et changements financiers même via les accès directs. Ne pas bloquer une simple modification de notes sur un ancien paiement pour un écart historique.
4. Renforcer l'anti-doublon : une seconde soumission identique retrouve le paiement existant ; une clé réutilisée avec un autre montant, client ou choix de factures est refusée, sans exposer le paiement d'un autre utilisateur.
5. Afficher les deux messages exacts fournis, le montant disponible et empêcher l'enregistrement tant que le contrôle ne peut pas être effectué. Rafraîchir les données avant confirmation et après refus.

## Vérifications
Tests dans une base locale jetable : dette nulle/créditrice, 300 000 sur 500 000, paiement intégral de 500 000, refus de 600 000, paiement global, deux paiements simultanés, double soumission. Ajouter les cas de retours validés, paiements en attente, affectation partielle et contournement par écriture directe.

Contrôler le formulaire connecté avec des clients réels sans enregistrer d'encaissement dans leur historique. Vérifier le parcours d'enregistrement et de validation dans l'environnement jetable ; signaler toute partie non vérifiable.

## Détails techniques
- Ajouter les règles par une seule nouvelle migration, sans réappliquer les précédentes ni écrire directement `clients.solde`.
- Réutiliser `solde_client_calcule`, les affectations existantes et le verrou transactionnel commun déjà utilisé par les paiements et retours, acquis avant les verrous de lignes.
- Utiliser des contrôles différés sur paiements et affectations afin de vérifier l'état complet de la transaction ; plafonner strictement sans tolérance autorisant un dépassement.
- Protéger la lecture du disponible par le droit `paiements.creer` ; conserver les contrôles de droits des opérations existantes.
- Conserver les ventilations produit historiques et leur correction explicite, mais retirer leur génération obligatoire lors d'un nouvel encaissement.
- Préserver les définitions antérieures pour documenter un retour arrière des contrôles si nécessaire ; aucun ancien montant, statut ou solde ne sera corrigé dans cette intervention.
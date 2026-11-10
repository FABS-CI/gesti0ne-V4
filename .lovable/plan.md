# Retours clients limités à la dette disponible

## Règle à appliquer
- Interdire les retours si le solde client réel est nul ou créditeur.
- Autoriser un retour seulement si son montant est inférieur ou égal à la dette disponible.
- Réserver le montant des demandes en attente sans les comptabiliser. Un refus ou une annulation libère cette réservation.
- Recontrôler la dette au moment de chaque validation ; exclure la réservation du retour en cours pour ne pas la compter deux fois.

Exemples : dette de **100 000 FCFA**, plafond de **100 000 FCFA** ; dette de **500 000 FCFA**, retour de **300 000 FCFA** autorisé, retour de **600 000 FCFA** refusé.

## Mise en œuvre
1. Ajouter un contrôle unique côté serveur, commun à la création d'une demande, au parcours de création avec validation immédiate et aux validations des retours existants.
2. Valoriser les réservations avec les prix et remises d'origine et les quantités demandées ; utiliser les quantités effectivement retenues lors de la réception et validation, selon les règles existantes.
3. Protéger les opérations simultanées pour que deux demandes ne puissent pas réserver la même dette disponible.
4. Afficher la dette disponible dans le formulaire et les messages exacts demandés :
   - « Retour impossible : ce client ne présente aucun encours débiteur. Les retours sont autorisés uniquement dans la limite de sa dette actuelle. »
   - « Retour impossible : le montant du retour dépasse l'encours disponible du client. Encours disponible : XXX FCFA. Montant du retour : XXX FCFA. »
5. Préserver les droits, les réceptions physiques, les validations comptables, les documents et l'historique.

## Détails techniques et sécurité
- Utiliser exclusivement `solde_client_calcule` pour la dette réelle ; ne pas se fier au solde affiché ni au montant transmis par le navigateur.
- Installer une migration dédiée avec une protection au niveau des écritures de retours et de leurs lignes, en plus des contrôles des RPC, afin de couvrir les accès directs autorisés à la base.
- Sérialiser les opérations concernées par client, avec un ordre de verrouillage cohérent ; relecture du solde après verrouillage et validation transactionnelle de l'état final des lignes.
- Inclure les états historiques d'attente dans les réservations ; exclure les retours déjà comptabilisés, annulés ou refusés.
- Ne pas réécrire les anciens retours : les nouvelles demandes et prochaines validations seront contrôlées ; un ancien dossier dépassant désormais le plafond sera bloqué avec le message explicite.
- Le code actuellement en service contient encore une soustraction directe dans la validation comptable interne. La remplacer par le recalcul central existant, sans changer la formule ni les écritures produites, pour respecter la règle du projet et éviter un solde dépendant de la dernière opération.
- Aucune suppression, aucune donnée fictive dans la base réelle ; prévoir le retrait des nouveaux contrôles comme retour arrière, sans toucher aux documents.

## Vérifications avant livraison
- Tests sur une base locale jetable explicitement autorisée, avec transactions annulées : solde zéro, solde créditeur, plafond de 100 000, dette de 500 000 avec retours de 300 000 et 600 000.
- Vérifier l'égalité au plafond, les remises d'origine, la réservation sans impact comptable, la libération après refus/annulation et l'absence de double réservation à la validation.
- Deux demandes simultanées de 300 000 sur une dette de 500 000 : une seule doit être acceptée ; contrôle également d'une validation concurrente avec un paiement.
- Tester les différents points d'entrée et un accès direct aux retours/lignes pour vérifier l'absence de contournement.
- Contrôle connecté sur le formulaire du client AGBOVILLE, actuellement sans dette : alerte visible et demande impossible, sans créer de document.

**Limite de vérification :** si aucune base jetable n'est disponible, ne pas effectuer les scénarios d'écriture et de concurrence sur la base réelle ; signaler explicitement ces vérifications non exécutées.
# Rapport d'audit ERP — passe 1

Méthode : analyse du code + tests réels dans le navigateur (session authentifiée), relevé des
erreurs console et des appels base de données en échec, puis scénario de bout en bout.

## Module 1 — Documents commerciaux

| Module | Fonction | Problème | Gravité | Cause | Correction |
|---|---|---|---|---|---|
| Facturation normalisée (FNE/DGI) | Chargement des paramètres, liste, soumission, avoir | Toutes les requêtes échouaient (erreur 400) — module entièrement inutilisable | 🔴 Critique | Les tables `fne_settings`, `fne_factures`, `fne_logs` ne contenaient aucune des colonnes utilisées par l'application | Colonnes ajoutées (migration additive, aucune donnée existante) |
| Modèles de documents PDF | Liste, création, modification, suppression, modèle actif | Toutes les requêtes échouaient (erreur 400) | 🔴 Critique | Colonnes `template_id`, `label`, `config`, `active_template_id` absentes des tables | Colonnes ajoutées + valeurs par défaut |
| Fiche produit | Historique d'inventaire | Erreur 400, onglet vide | 🟠 Important | Colonnes inexistantes (`stock_theorique`, `quantite_comptee`, `numero`) | Code corrigé vers `quantite_theorique`, `quantite_physique`, `reference` |
| Fiche produit | Mouvements de stock par dépôt | Erreur 400 | 🟠 Important | Lien manquant entre `stock_mouvements` et `depots` | Clé étrangère + index ajoutés (0 ligne orpheline) |
| Liste produits | Dernier prix d'achat | Erreur 404, information jamais affichée | 🟠 Important | Fonction base `get_derniers_prix_achat` inexistante | Fonction créée |
| Liste factures | — | Avertissement React (mise à jour d'état hors montage) | 🔵 Mineur | Effet asynchrone | Non bloquant, à traiter |

### Vérifications après correction
- `/factures`, `/proformas`, `/bons-livraison`, `/commandes`, `/centre-documents`, `/modeles-documents`,
  `/fne`, `/paiements`, `/clients`, `/stock`, `/produits` : plus aucune requête en échec.
- Scénario réel FNE : saisie client + article → « Soumettre à la DGI » → facture créée, statut
  `accepted`, code DGI généré, QR code affiché, redirection vers la fiche de détail. Auparavant
  impossible. Facture de test supprimée après contrôle.
- Compilation TypeScript : aucune erreur.

## Module 2 — Clients & CRM (et pages devenues inaccessibles)

| Module | Fonction | Problème | Gravité | Cause | Correction |
|---|---|---|---|---|---|
| Clients | Bouton « Modifier » (liste + fiche) | Le formulaire de modification ne s'ouvrait jamais : l'adresse affichait à nouveau la fiche du client | 🔴 Critique | La page « fiche client » était déclarée comme page parente de la page « modifier » sans zone d'affichage pour sa page enfant | Page fiche transformée en page d'accueil de la section ; la page « modifier » s'affiche maintenant |
| Contrats RH | Modifier un contrat | Même problème : page inaccessible | 🔴 Critique | Idem | Corrigé |
| Livraison-suivi | Remise d'une commande, détail d'une tournée | Pages inaccessibles | 🔴 Critique | Idem | Corrigé |
| Exercices comptables | Journal de clôture, Comparatif, Rapport | Pages inaccessibles | 🔴 Critique | Idem | Corrigé |
| Paramètres | Zones de livraison | Page inaccessible | 🔴 Critique | Idem | Corrigé |
| Stock | Audit stock | Page inaccessible | 🔴 Critique | Idem | Corrigé |
| Administration | Détail d'une annulation de paiement | Page inaccessible | 🔴 Critique | Idem | Corrigé |
| Exercices | Comparatif ouvert directement (lien copié, favori) | Écran d'erreur « Cette page n'a pas pu charger » | 🟠 Important | Paramètre d'adresse obligatoire | Paramètre rendu optionnel |
| Stock | Audit stock — indicateurs | Tous les compteurs vides et date « Invalid Date », verdict faux | 🟠 Important | La page lisait un résultat qui n'avait pas la forme attendue | Nouveau calcul de synthèse côté base ; la page affiche produits, mouvements, écarts, stock négatif, doublons et la date |

### Vérifications après correction (navigateur, session réelle)
- Création d'un client → enregistré en base ; ouverture de la fiche → informations correctes.
- Modification (nom + ville) → enregistrée, redirection vers la fiche, valeurs à jour en base.
- Fiche client (onglets, indicateurs), tableau de bord CRM (CA, encaissements, taux) : OK, aucune erreur.
- Les 12 pages auparavant inaccessibles s'affichent toutes avec leur contenu réel.
- Client de test supprimé après contrôle. Compilation TypeScript : aucune erreur.

---

## Module 3 — Stock, produits, dépôts, inventaires

| Domaine | Problème constaté | Gravité | Cause | Correction |
|---|---|---|---|---|
| Inventaires | La liste des inventaires ne s'affichait jamais (erreur serveur à chaque ouverture) | 🔴 Critique | La table n'avait ni exercice comptable, ni type, ni numéro, ni compteurs attendus par l'application | Colonnes ajoutées (numéro, type, catégorie, exercice, nb produits, nb écarts, valeur, observations, auteur, dates de validation/régularisation) et rattachement automatique à l'exercice |
| Inventaires | Le formulaire « Nouvel inventaire physique » ne chargeait pas les catégories (erreur serveur) | 🔴 Critique | La liste demandait un libellé de catégorie sous un nom inexistant | Lecture du bon libellé |
| Inventaires | Le filtre « Catégorie » du formulaire n'avait aucun effet : l'inventaire contenait toujours tous les produits | 🟠 Important | La catégorie choisie n'était pas transmise ni utilisée à la création | La création filtre désormais réellement les produits de la catégorie choisie |
| Inventaires | Après création, message « Inventaire undefined » et fiche « Inventaire introuvable » | 🔴 Critique | Le résultat de la création n'était pas lu correctement + relations manquantes entre inventaires, dépôts et produits | Lecture normalisée du résultat ; relations ajoutées |
| Inventaires | La validation d'un comptage remettait toutes les quantités comptées à zéro | 🔴 Critique | Les quantités saisies étaient envoyées sous un nom que le traitement ignorait | La validation accepte la saisie réelle, recalcule écarts, nombre d'écarts et valeur, et horodate la validation |
| Inventaires | Statut initial incohérent : l'inventaire créé n'était jamais modifiable | 🔴 Critique | Statut « en cours » créé, alors que seule la mention « brouillon » autorise la saisie | Les inventaires sont créés en brouillon, saisissables immédiatement |
| Inventaires | Valeurs unitaires et références produit absentes des lignes | 🟠 Important | Colonnes inexistantes | Ajoutées et renseignées à la création (prix d'achat, référence) |

### Vérifications après correction (navigateur, session réelle)
- Création d'un inventaire physique depuis le formulaire : inventaire INV-2026-00001 créé, 50 produits, valeur théorique calculée, statut Brouillon.
- Liste des inventaires : numéro, type, date (16/09/2026), dépôt, produits, écarts, valeur, statut — tout s'affiche.
- Fiche inventaire : lignes produits avec référence, stock théorique, écart et valeurs ; saisie possible.
- Pages stock, audit stock, produits, alertes, dépôts, transferts : ouvertes sans erreur.
- Inventaire de test supprimé après contrôle. Compilation TypeScript : aucune erreur.

## Modules restants (à auditer)
4. Paiements & comptabilité — 5. Logistique — 6. Achats — 7. RH & paie —
8. Administration — 9. Transverse.

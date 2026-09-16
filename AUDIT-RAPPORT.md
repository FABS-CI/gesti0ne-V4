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

## Modules restants (à auditer)
3. Stock / inventaires / transferts — 4. Paiements & comptabilité —
5. Logistique — 6. Achats — 7. RH & paie — 8. Administration — 9. Transverse.

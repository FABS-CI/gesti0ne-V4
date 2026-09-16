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

## Modules restants (à auditer)
2. Clients & CRM — 3. Stock / inventaires / transferts — 4. Paiements & comptabilité —
5. Logistique — 6. Achats — 7. RH & paie — 8. Administration — 9. Transverse.

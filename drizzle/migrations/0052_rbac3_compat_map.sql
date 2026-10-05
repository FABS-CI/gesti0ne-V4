-- Correspondance codes historiques (sous_module.action) -> permissions RBAC3 (module.action).
-- Miroir de src/lib/rbac3-bridge.ts. Aucun changement de comportement : fonction de lecture seule.
CREATE OR REPLACE FUNCTION public.rbac3_compat_map()
RETURNS TABLE(v2_code text, v3_code text)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $fn$
WITH sm(module_code, sous_module) AS (VALUES
('tableau_bord','dashboard'),('tableau_bord','dashboard_direction'),('tableau_bord','dashboard_metier'),('tableau_bord','dashboard_personnel'),('tableau_bord','mon_dashboard'),('tableau_bord','dashboard_global'),
('clients','clients'),('clients','clients_dashboard'),('clients','prospects'),('clients','tarifs'),('clients','etat_compte_clients'),
('commandes','commandes'),('devis','proformas'),('factures','factures'),('factures','avoirs'),('paiements','paiements'),
('retours','retours'),('retours','specimens'),('ventes','commandes'),('ventes','proformas'),('ventes','factures'),('ventes','specimens'),
('produits','produits'),('produits','alertes_stock'),('catalogue','produits'),('catalogue','tarifs'),
('stocks','stock'),('stocks','alertes_stock'),('stocks','transferts'),('stocks','incidents'),('depots','depots'),('depots','transferts'),
('inventaires','inventaires'),('achats','achats'),('achats','approvisionnements'),('fournisseurs','fournisseurs'),
('logistique','colisage'),('logistique','colisage_responsables'),('logistique','flotte'),('logistique','tournees'),('logistique','livreurs'),('logistique','livraison_suivi'),('logistique','bons_livraison'),('logistique','livraisons'),('logistique','expeditions'),('logistique','couts_logistiques'),('logistique','dashboard_logistique'),('logistique','rapports_logistique'),
('comptabilite','compta_dashboard'),('comptabilite','comptabilite'),('comptabilite','ecritures_comptables'),('comptabilite','plan_comptable'),('comptabilite','balance'),('comptabilite','grand_livre'),('comptabilite','etats_comptables'),('comptabilite','fec'),('comptabilite','fne'),('comptabilite','rapports_comptables'),('comptabilite','exercices'),
('banque','finances'),('banque','tresorerie'),('caisse','finances'),('caisse','tresorerie'),
('rh','employes'),('rh','departements'),('rh','fonctions'),('rh','contrats'),('rh','conges'),('rh','absences'),('rh','missions'),('rh','evaluations'),('rh','paie'),('rh','bulletins'),('rh','paie_parametres'),('rh','paie_rubriques'),
('rapports','rapports'),('rapports','exports'),('rapports','bi_analytics'),('audit','audit'),
('administration','utilisateurs'),('administration','roles_permissions'),('administration','backup'),('administration','documents'),('administration','centre_documents'),('administration','modeles_documents'),('administration','workflows'),('administration','integrations'),
('parametres','parametres'),('parametres','exercices'),('parametres','modeles_documents'),('parametres','historique_envois'),('parametres','configurations')),
act(v3, ui) AS (VALUES
('lire','voir'),('lire','voir_historique'),('lire','voir_stats'),('creer','creer'),('creer','dupliquer'),('creer','importer'),
('modifier','modifier'),('modifier','changer_statut'),('supprimer','supprimer'),('supprimer','archiver'),('valider','valider'),('annuler','annuler'),
('imprimer','imprimer'),('imprimer','telecharger'),('exporter','exporter_pdf'),('exporter','exporter_excel'),('exporter','telecharger')),
spec(v2, v3) AS (VALUES
('tournees.cloturer','logistique.valider'),('tournees.valider','logistique.valider'),('tournees.valider_couts','logistique.valider'),('tournees.refuser_couts','logistique.valider'),
('tournees.annuler_validation','logistique.annuler'),('livraisons.avancer_etape','logistique.modifier'),('livraisons.avancer_masse','logistique.modifier'),('colisage.deverrouiller','logistique.modifier'),
('commandes.convertir_en_bl','commandes.valider'),('commandes.convertir_en_bl','logistique.creer'),('commandes.generer_proforma','devis.creer'),('commandes.generer_proforma','commandes.creer'),
('commandes.soumettre','commandes.creer'),('proformas.convertir_en_commande','commandes.creer'),('retours.receptionner','stocks.modifier'),('retours.refuser_magasin','stocks.modifier'),
('retours.valider_compta','comptabilite.valider'),('retours.refuser_compta','comptabilite.valider'),('transferts.receptionner','stocks.modifier'),('transferts.receptionner','depots.modifier'),
('transferts.executer','stocks.modifier'),('transferts.executer','depots.modifier'),('inventaires.regulariser','inventaires.valider'),('depots.definir_principal','depots.modifier'),
('paiements.rejeter','paiements.valider'),('stock.voir_audit','stocks.valider'),('stock.voir_audit','audit.lire'),('dashboard.voir_ca','rapports.lire'),('dashboard.voir_ca','comptabilite.lire'),
('rapports.voir_ca','rapports.lire'),('rapports.voir_ca','comptabilite.lire'),('roles_permissions.assigner_permission','administration.modifier'),('approbations.voir','tableau_bord.lire'),
('approbations.valider','administration.valider'),('approbations.valider','comptabilite.valider'),('approbations.refuser','administration.valider'),('approbations.refuser','comptabilite.valider')),
all_act(v3) AS (VALUES ('lire'),('creer'),('modifier'),('supprimer'),('valider'),('annuler'),('imprimer'),('exporter'))
SELECT sm.sous_module || '.' || act.ui, sm.module_code || '.' || act.v3 FROM sm JOIN act ON true
UNION
SELECT sm.sous_module || '.voir', sm.module_code || '.' || all_act.v3 FROM sm JOIN all_act ON true
UNION
SELECT v2, v3 FROM spec
UNION
SELECT 'parametres.acceder_parametres', 'parametres.lire'
$fn$;

REVOKE ALL ON FUNCTION public.rbac3_compat_map() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rbac3_compat_map() TO authenticated, service_role;
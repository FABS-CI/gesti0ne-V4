export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          absence_id: string
          created_at: string
          date_debut: string | null
          date_fin: string | null
          employe_id: string | null
          employe_nom: string | null
          justifie: boolean
          motif: string | null
          statut: string
          type: string | null
          updated_at: string
        }
        Insert: {
          absence_id?: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          employe_id?: string | null
          employe_nom?: string | null
          justifie?: boolean
          motif?: string | null
          statut?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          absence_id?: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          employe_id?: string | null
          employe_nom?: string | null
          justifie?: boolean
          motif?: string | null
          statut?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      achat_lignes: {
        Row: {
          achat_id: string
          created_at: string
          designation: string
          ligne_id: string
          prix_unitaire: number
          produit_id: string | null
          quantite: number
          reference_produit: string | null
          remise_pct: number
          total_ligne: number
        }
        Insert: {
          achat_id: string
          created_at?: string
          designation?: string
          ligne_id?: string
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          remise_pct?: number
          total_ligne?: number
        }
        Update: {
          achat_id?: string
          created_at?: string
          designation?: string
          ligne_id?: string
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          remise_pct?: number
          total_ligne?: number
        }
        Relationships: [
          {
            foreignKeyName: "achat_lignes_achat_id_fkey"
            columns: ["achat_id"]
            isOneToOne: false
            referencedRelation: "achats"
            referencedColumns: ["achat_id"]
          },
          {
            foreignKeyName: "achat_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["produit_id"]
          },
          {
            foreignKeyName: "achat_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "v_produits"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      achats: {
        Row: {
          achat_id: string
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_achat: string
          depot_id: string | null
          exercice_id: string | null
          fournisseur_id: string | null
          fournisseur_nom: string | null
          idempotency_key: string | null
          libelle: string
          montant: number
          notes: string | null
          reference: string
          reference_fournisseur: string | null
          statut: string
          total_quantite: number
          updated_at: string
        }
        Insert: {
          achat_id?: string
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_achat?: string
          depot_id?: string | null
          exercice_id?: string | null
          fournisseur_id?: string | null
          fournisseur_nom?: string | null
          idempotency_key?: string | null
          libelle?: string
          montant?: number
          notes?: string | null
          reference?: string
          reference_fournisseur?: string | null
          statut?: string
          total_quantite?: number
          updated_at?: string
        }
        Update: {
          achat_id?: string
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_achat?: string
          depot_id?: string | null
          exercice_id?: string | null
          fournisseur_id?: string | null
          fournisseur_nom?: string | null
          idempotency_key?: string | null
          libelle?: string
          montant?: number
          notes?: string | null
          reference?: string
          reference_fournisseur?: string | null
          statut?: string
          total_quantite?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achats_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "achats_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices_comptables"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "achats_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["fournisseur_id"]
          },
        ]
      }
      alertes_stock: {
        Row: {
          active: boolean
          alerte_id: string
          created_at: string
          depot_id: string | null
          message: string | null
          niveau: string | null
          produit_id: string | null
          quantite_actuelle: number | null
          seuil: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          alerte_id?: string
          created_at?: string
          depot_id?: string | null
          message?: string | null
          niveau?: string | null
          produit_id?: string | null
          quantite_actuelle?: number | null
          seuil?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          alerte_id?: string
          created_at?: string
          depot_id?: string | null
          message?: string | null
          niveau?: string | null
          produit_id?: string | null
          quantite_actuelle?: number | null
          seuil?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      approbation_seuils: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          module: string
          seuil_critique: number
          seuil_urgent: number
          sla_critique_heures: number
          sla_normal_heures: number
          sla_urgent_heures: number
          type_operation: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          module: string
          seuil_critique?: number
          seuil_urgent?: number
          sla_critique_heures?: number
          sla_normal_heures?: number
          sla_urgent_heures?: number
          type_operation?: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          seuil_critique?: number
          seuil_urgent?: number
          sla_critique_heures?: number
          sla_normal_heures?: number
          sla_urgent_heures?: number
          type_operation?: string
          updated_at?: string
        }
        Relationships: []
      }
      approvisionnement_lignes: {
        Row: {
          approvisionnement_id: string
          created_at: string
          designation: string | null
          ligne_id: string
          prix_unitaire: number | null
          produit_id: string | null
          quantite: number | null
          total_ligne: number | null
          updated_at: string
        }
        Insert: {
          approvisionnement_id: string
          created_at?: string
          designation?: string | null
          ligne_id?: string
          prix_unitaire?: number | null
          produit_id?: string | null
          quantite?: number | null
          total_ligne?: number | null
          updated_at?: string
        }
        Update: {
          approvisionnement_id?: string
          created_at?: string
          designation?: string | null
          ligne_id?: string
          prix_unitaire?: number | null
          produit_id?: string | null
          quantite?: number | null
          total_ligne?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvisionnement_lignes_approvisionnement_id_fkey"
            columns: ["approvisionnement_id"]
            isOneToOne: false
            referencedRelation: "approvisionnements"
            referencedColumns: ["approvisionnement_id"]
          },
        ]
      }
      approvisionnements: {
        Row: {
          approvisionnement_id: string
          created_at: string
          date_appro: string | null
          depot_id: string | null
          fournisseur_id: string | null
          montant: number | null
          notes: string | null
          reference: string | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          approvisionnement_id?: string
          created_at?: string
          date_appro?: string | null
          depot_id?: string | null
          fournisseur_id?: string | null
          montant?: number | null
          notes?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          approvisionnement_id?: string
          created_at?: string
          date_appro?: string | null
          depot_id?: string | null
          fournisseur_id?: string | null
          montant?: number | null
          notes?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          browser: string | null
          browser_version: string | null
          city: string | null
          correlation_id: string | null
          country: string | null
          country_code: string | null
          created_at: string
          criticite: string | null
          details: Json | null
          device: string | null
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          http_method: string | null
          id: string
          ip_address: string | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          os: string | null
          record_id: string | null
          screen_resolution: string | null
          session_id: string | null
          status: string | null
          status_code: number | null
          table_name: string | null
          timezone: string | null
          url: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          browser?: string | null
          browser_version?: string | null
          city?: string | null
          correlation_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          criticite?: string | null
          details?: Json | null
          device?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          http_method?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          os?: string | null
          record_id?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          status?: string | null
          status_code?: number | null
          table_name?: string | null
          timezone?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          browser?: string | null
          browser_version?: string | null
          city?: string | null
          correlation_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          criticite?: string | null
          details?: Json | null
          device?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          http_method?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          os?: string | null
          record_id?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          status?: string | null
          status_code?: number | null
          table_name?: string | null
          timezone?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_stock: {
        Row: {
          audit_id: string
          created_at: string
          date_audit: string | null
          depot_id: string | null
          motif: string | null
          produit_id: string | null
          quantite_apres: number | null
          quantite_avant: number | null
          updated_at: string
          user_email: string | null
        }
        Insert: {
          audit_id?: string
          created_at?: string
          date_audit?: string | null
          depot_id?: string | null
          motif?: string | null
          produit_id?: string | null
          quantite_apres?: number | null
          quantite_avant?: number | null
          updated_at?: string
          user_email?: string | null
        }
        Update: {
          audit_id?: string
          created_at?: string
          date_audit?: string | null
          depot_id?: string | null
          motif?: string | null
          produit_id?: string | null
          quantite_apres?: number | null
          quantite_avant?: number | null
          updated_at?: string
          user_email?: string | null
        }
        Relationships: []
      }
      backup_schedules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          destination: string
          frequence: string
          last_run_at: string | null
          next_run_at: string | null
          nom: string
          retention_count: number
          schedule_id: string
          type_sauvegarde: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          destination?: string
          frequence: string
          last_run_at?: string | null
          next_run_at?: string | null
          nom: string
          retention_count?: number
          schedule_id?: string
          type_sauvegarde?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          destination?: string
          frequence?: string
          last_run_at?: string | null
          next_run_at?: string | null
          nom?: string
          retention_count?: number
          schedule_id?: string
          type_sauvegarde?: string
          updated_at?: string
        }
        Relationships: []
      }
      backups: {
        Row: {
          backup_id: string
          created_at: string
          destination: string
          destination_ref: string | null
          destination_url: string | null
          duree_ms: number | null
          error: string | null
          error_message: string | null
          fichier_nom: string | null
          finished_at: string | null
          nb_enregistrements: number | null
          nb_tables: number | null
          project_id: string | null
          project_name: string | null
          run_id: string | null
          scope: Json | null
          scope_type: Database["public"]["Enums"]["backup_scope_type"] | null
          sha256: string | null
          started_at: string
          statut: string
          taille_octets: number | null
          trigger_type:
            | Database["public"]["Enums"]["backup_trigger_type"]
            | null
          type: string
          updated_at: string
          user_email: string | null
          verifie: boolean | null
          verifie_at: string | null
          verifie_methode: string | null
        }
        Insert: {
          backup_id?: string
          created_at?: string
          destination?: string
          destination_ref?: string | null
          destination_url?: string | null
          duree_ms?: number | null
          error?: string | null
          error_message?: string | null
          fichier_nom?: string | null
          finished_at?: string | null
          nb_enregistrements?: number | null
          nb_tables?: number | null
          project_id?: string | null
          project_name?: string | null
          run_id?: string | null
          scope?: Json | null
          scope_type?: Database["public"]["Enums"]["backup_scope_type"] | null
          sha256?: string | null
          started_at?: string
          statut?: string
          taille_octets?: number | null
          trigger_type?:
            | Database["public"]["Enums"]["backup_trigger_type"]
            | null
          type?: string
          updated_at?: string
          user_email?: string | null
          verifie?: boolean | null
          verifie_at?: string | null
          verifie_methode?: string | null
        }
        Update: {
          backup_id?: string
          created_at?: string
          destination?: string
          destination_ref?: string | null
          destination_url?: string | null
          duree_ms?: number | null
          error?: string | null
          error_message?: string | null
          fichier_nom?: string | null
          finished_at?: string | null
          nb_enregistrements?: number | null
          nb_tables?: number | null
          project_id?: string | null
          project_name?: string | null
          run_id?: string | null
          scope?: Json | null
          scope_type?: Database["public"]["Enums"]["backup_scope_type"] | null
          sha256?: string | null
          started_at?: string
          statut?: string
          taille_octets?: number | null
          trigger_type?:
            | Database["public"]["Enums"]["backup_trigger_type"]
            | null
          type?: string
          updated_at?: string
          user_email?: string | null
          verifie?: boolean | null
          verifie_at?: string | null
          verifie_methode?: string | null
        }
        Relationships: []
      }
      backups_security_backup: {
        Row: {
          backup_id: string | null
          created_at: string | null
          destination: string | null
          destination_ref: string | null
          destination_url: string | null
          duree_ms: number | null
          error: string | null
          fichier_nom: string | null
          finished_at: string | null
          nb_enregistrements: number | null
          nb_tables: number | null
          scope: Json | null
          sha256: string | null
          started_at: string | null
          statut: string | null
          taille_octets: number | null
          type: string | null
          updated_at: string | null
          user_email: string | null
          verifie: boolean | null
          verifie_at: string | null
          verifie_methode: string | null
        }
        Insert: {
          backup_id?: string | null
          created_at?: string | null
          destination?: string | null
          destination_ref?: string | null
          destination_url?: string | null
          duree_ms?: number | null
          error?: string | null
          fichier_nom?: string | null
          finished_at?: string | null
          nb_enregistrements?: number | null
          nb_tables?: number | null
          scope?: Json | null
          sha256?: string | null
          started_at?: string | null
          statut?: string | null
          taille_octets?: number | null
          type?: string | null
          updated_at?: string | null
          user_email?: string | null
          verifie?: boolean | null
          verifie_at?: string | null
          verifie_methode?: string | null
        }
        Update: {
          backup_id?: string | null
          created_at?: string | null
          destination?: string | null
          destination_ref?: string | null
          destination_url?: string | null
          duree_ms?: number | null
          error?: string | null
          fichier_nom?: string | null
          finished_at?: string | null
          nb_enregistrements?: number | null
          nb_tables?: number | null
          scope?: Json | null
          sha256?: string | null
          started_at?: string | null
          statut?: string | null
          taille_octets?: number | null
          type?: string | null
          updated_at?: string | null
          user_email?: string | null
          verifie?: boolean | null
          verifie_at?: string | null
          verifie_methode?: string | null
        }
        Relationships: []
      }
      bons_livraison: {
        Row: {
          adresse_livraison: string | null
          bl_id: string
          client_id: string | null
          client_nom: string | null
          commande_id: string | null
          created_at: string
          date_bon: string | null
          date_emission: string | null
          date_livraison: string | null
          date_reception_client: string | null
          exercice_id: string | null
          livraison_id: string | null
          montant: number | null
          nom_livreur: string | null
          nom_receptionnaire_client: string | null
          notes: string | null
          reference: string | null
          statut: string
          transporteur: string | null
          updated_at: string
        }
        Insert: {
          adresse_livraison?: string | null
          bl_id?: string
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          date_bon?: string | null
          date_emission?: string | null
          date_livraison?: string | null
          date_reception_client?: string | null
          exercice_id?: string | null
          livraison_id?: string | null
          montant?: number | null
          nom_livreur?: string | null
          nom_receptionnaire_client?: string | null
          notes?: string | null
          reference?: string | null
          statut?: string
          transporteur?: string | null
          updated_at?: string
        }
        Update: {
          adresse_livraison?: string | null
          bl_id?: string
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          date_bon?: string | null
          date_emission?: string | null
          date_livraison?: string | null
          date_reception_client?: string | null
          exercice_id?: string | null
          livraison_id?: string | null
          montant?: number | null
          nom_livreur?: string | null
          nom_receptionnaire_client?: string | null
          notes?: string | null
          reference?: string | null
          statut?: string
          transporteur?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bons_livraison_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
        ]
      }
      bulletin_lignes: {
        Row: {
          base: number | null
          bulletin_id: string
          code: string | null
          created_at: string
          libelle: string | null
          ligne_id: string
          montant: number | null
          rubrique_id: string | null
          taux: number | null
          type: string | null
          updated_at: string
        }
        Insert: {
          base?: number | null
          bulletin_id: string
          code?: string | null
          created_at?: string
          libelle?: string | null
          ligne_id?: string
          montant?: number | null
          rubrique_id?: string | null
          taux?: number | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          base?: number | null
          bulletin_id?: string
          code?: string | null
          created_at?: string
          libelle?: string | null
          ligne_id?: string
          montant?: number | null
          rubrique_id?: string | null
          taux?: number | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_lignes_bulletin_id_fkey"
            columns: ["bulletin_id"]
            isOneToOne: false
            referencedRelation: "bulletins_paie"
            referencedColumns: ["bulletin_id"]
          },
        ]
      }
      bulletins_paie: {
        Row: {
          bulletin_id: string
          cotisations: number | null
          created_at: string
          date_bulletin: string | null
          employe_id: string | null
          pdf_url: string | null
          periode: string | null
          reference: string | null
          salaire_brut: number | null
          salaire_net: number | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          bulletin_id?: string
          cotisations?: number | null
          created_at?: string
          date_bulletin?: string | null
          employe_id?: string | null
          pdf_url?: string | null
          periode?: string | null
          reference?: string | null
          salaire_brut?: number | null
          salaire_net?: number | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          bulletin_id?: string
          cotisations?: number | null
          created_at?: string
          date_bulletin?: string | null
          employe_id?: string | null
          pdf_url?: string | null
          periode?: string | null
          reference?: string | null
          salaire_brut?: number | null
          salaire_net?: number | null
          statut?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories_produits: {
        Row: {
          actif: boolean
          categorie_id: string
          code: string | null
          created_at: string
          description: string | null
          libelle: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          libelle: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          libelle?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_produits_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_produits"
            referencedColumns: ["categorie_id"]
          },
        ]
      }
      clients: {
        Row: {
          actif: boolean
          adresse: string | null
          bp: string | null
          categorie: string | null
          client_id: string
          commune: string | null
          created_at: string
          delai_paiement: number | null
          email: string | null
          mode_paiement: string | null
          motif_blocage: string | null
          nif: string | null
          nom: string
          notes: string | null
          pays: string | null
          phone_normalized: string | null
          plafond_credit: number | null
          quartier: string | null
          reference: string | null
          regime_fiscal: string | null
          remise_habituelle: number | null
          representant: string | null
          secteur_activite: string | null
          solde: number | null
          solde_points: number | null
          statut: string | null
          telephone: string | null
          type_client: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          bp?: string | null
          categorie?: string | null
          client_id?: string
          commune?: string | null
          created_at?: string
          delai_paiement?: number | null
          email?: string | null
          mode_paiement?: string | null
          motif_blocage?: string | null
          nif?: string | null
          nom: string
          notes?: string | null
          pays?: string | null
          phone_normalized?: string | null
          plafond_credit?: number | null
          quartier?: string | null
          reference?: string | null
          regime_fiscal?: string | null
          remise_habituelle?: number | null
          representant?: string | null
          secteur_activite?: string | null
          solde?: number | null
          solde_points?: number | null
          statut?: string | null
          telephone?: string | null
          type_client?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          bp?: string | null
          categorie?: string | null
          client_id?: string
          commune?: string | null
          created_at?: string
          delai_paiement?: number | null
          email?: string | null
          mode_paiement?: string | null
          motif_blocage?: string | null
          nif?: string | null
          nom?: string
          notes?: string | null
          pays?: string | null
          phone_normalized?: string | null
          plafond_credit?: number | null
          quartier?: string | null
          reference?: string | null
          regime_fiscal?: string | null
          remise_habituelle?: number | null
          representant?: string | null
          secteur_activite?: string | null
          solde?: number | null
          solde_points?: number | null
          statut?: string | null
          telephone?: string | null
          type_client?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      colis: {
        Row: {
          bl_id: string
          colis_id: string
          commande_id: string | null
          commune: string | null
          contenu: string | null
          created_at: string
          date_colisage: string | null
          date_envoi: string | null
          destinataire: string | null
          gare_depart: string | null
          gare_responsable: string | null
          gare_telephone: string | null
          livreur_nom: string | null
          livreur_telephone: string | null
          mode_acheminement: string | null
          nb_cartons: number | null
          numero_carton: number | null
          observations: string | null
          poids: number | null
          quartier: string | null
          reference: string | null
          responsable_id: string | null
          responsable_nom: string | null
          statut: string
          tournee_id: string | null
          transporteur: string | null
          updated_at: string
          vehicule: string | null
          ville_destination: string | null
          ville_livraison: string | null
        }
        Insert: {
          bl_id: string
          colis_id?: string
          commande_id?: string | null
          commune?: string | null
          contenu?: string | null
          created_at?: string
          date_colisage?: string | null
          date_envoi?: string | null
          destinataire?: string | null
          gare_depart?: string | null
          gare_responsable?: string | null
          gare_telephone?: string | null
          livreur_nom?: string | null
          livreur_telephone?: string | null
          mode_acheminement?: string | null
          nb_cartons?: number | null
          numero_carton?: number | null
          observations?: string | null
          poids?: number | null
          quartier?: string | null
          reference?: string | null
          responsable_id?: string | null
          responsable_nom?: string | null
          statut?: string
          tournee_id?: string | null
          transporteur?: string | null
          updated_at?: string
          vehicule?: string | null
          ville_destination?: string | null
          ville_livraison?: string | null
        }
        Update: {
          bl_id?: string
          colis_id?: string
          commande_id?: string | null
          commune?: string | null
          contenu?: string | null
          created_at?: string
          date_colisage?: string | null
          date_envoi?: string | null
          destinataire?: string | null
          gare_depart?: string | null
          gare_responsable?: string | null
          gare_telephone?: string | null
          livreur_nom?: string | null
          livreur_telephone?: string | null
          mode_acheminement?: string | null
          nb_cartons?: number | null
          numero_carton?: number | null
          observations?: string | null
          poids?: number | null
          quartier?: string | null
          reference?: string | null
          responsable_id?: string | null
          responsable_nom?: string | null
          statut?: string
          tournee_id?: string | null
          transporteur?: string | null
          updated_at?: string
          vehicule?: string | null
          ville_destination?: string | null
          ville_livraison?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colis_bl_id_fkey"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bons_livraison"
            referencedColumns: ["bl_id"]
          },
          {
            foreignKeyName: "colis_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
        ]
      }
      colis_lignes: {
        Row: {
          colis_id: string
          created_at: string
          designation: string | null
          ligne_id: string
          produit_id: string | null
          quantite: number
          reference_produit: string | null
        }
        Insert: {
          colis_id: string
          created_at?: string
          designation?: string | null
          ligne_id?: string
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
        }
        Update: {
          colis_id?: string
          created_at?: string
          designation?: string | null
          ligne_id?: string
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colis_lignes_colis_id_fkey"
            columns: ["colis_id"]
            isOneToOne: false
            referencedRelation: "colis"
            referencedColumns: ["colis_id"]
          },
        ]
      }
      colis_statut_historique: {
        Row: {
          ancien_statut: string | null
          bl_id: string | null
          colis_id: string | null
          created_at: string
          historique_id: string
          motif: string | null
          nouveau_statut: string | null
          user_id: string | null
          user_nom: string | null
        }
        Insert: {
          ancien_statut?: string | null
          bl_id?: string | null
          colis_id?: string | null
          created_at?: string
          historique_id?: string
          motif?: string | null
          nouveau_statut?: string | null
          user_id?: string | null
          user_nom?: string | null
        }
        Update: {
          ancien_statut?: string | null
          bl_id?: string | null
          colis_id?: string | null
          created_at?: string
          historique_id?: string
          motif?: string | null
          nouveau_statut?: string | null
          user_id?: string | null
          user_nom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colis_statut_historique_colis_id_fkey"
            columns: ["colis_id"]
            isOneToOne: false
            referencedRelation: "colis"
            referencedColumns: ["colis_id"]
          },
        ]
      }
      colisage_responsables: {
        Row: {
          actif: boolean
          created_at: string
          created_by: string | null
          date_affectation: string
          depot_id: string | null
          employe_id: string
          responsable_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          date_affectation?: string
          depot_id?: string | null
          employe_id: string
          responsable_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          date_affectation?: string
          depot_id?: string | null
          employe_id?: string
          responsable_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colisage_responsables_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
          {
            foreignKeyName: "colisage_responsables_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: true
            referencedRelation: "employes"
            referencedColumns: ["employe_id"]
          },
        ]
      }
      commande_lignes: {
        Row: {
          commande_id: string
          created_at: string
          designation: string
          ligne_id: string
          montant_remise: number
          prix_unitaire: number
          produit_id: string | null
          quantite: number
          reference_produit: string | null
          remise_pct: number
          total_ht_ligne: number
          total_ligne: number
          updated_at: string
        }
        Insert: {
          commande_id: string
          created_at?: string
          designation: string
          ligne_id?: string
          montant_remise?: number
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          remise_pct?: number
          total_ht_ligne?: number
          total_ligne?: number
          updated_at?: string
        }
        Update: {
          commande_id?: string
          created_at?: string
          designation?: string
          ligne_id?: string
          montant_remise?: number
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          remise_pct?: number
          total_ht_ligne?: number
          total_ligne?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commande_lignes_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
          {
            foreignKeyName: "commande_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["produit_id"]
          },
          {
            foreignKeyName: "commande_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "v_produits"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      commandes: {
        Row: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          commande_id: string
          commentaire_validation: string | null
          commercial_id: string | null
          commercial_nom: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_commande: string
          depot_id: string | null
          etablissement: string | null
          exercice_id: string | null
          idempotency_key: string | null
          montant_total: number
          montant_ttc: number
          montant_tva: number
          motif_rejet: string | null
          nb_produits: number
          net_a_payer: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          rejete_le: string | null
          rejete_par: string | null
          remise: number
          remise_globale_montant: number
          remise_globale_pct: number
          representant_nom: string | null
          statut: string
          taux_tva: number
          telephone: string | null
          total_ht_brut: number
          total_ht_net: number
          total_quantite: number
          total_remises_lignes: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string
          commentaire_validation?: string | null
          commercial_id?: string | null
          commercial_nom?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_commande?: string
          depot_id?: string | null
          etablissement?: string | null
          exercice_id?: string | null
          idempotency_key?: string | null
          montant_total?: number
          montant_ttc?: number
          montant_tva?: number
          motif_rejet?: string | null
          nb_produits?: number
          net_a_payer?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          reference?: string | null
          rejete_le?: string | null
          rejete_par?: string | null
          remise?: number
          remise_globale_montant?: number
          remise_globale_pct?: number
          representant_nom?: string | null
          statut?: string
          taux_tva?: number
          telephone?: string | null
          total_ht_brut?: number
          total_ht_net?: number
          total_quantite?: number
          total_remises_lignes?: number
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string
          commentaire_validation?: string | null
          commercial_id?: string | null
          commercial_nom?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_commande?: string
          depot_id?: string | null
          etablissement?: string | null
          exercice_id?: string | null
          idempotency_key?: string | null
          montant_total?: number
          montant_ttc?: number
          montant_tva?: number
          motif_rejet?: string | null
          nb_produits?: number
          net_a_payer?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          reference?: string | null
          rejete_le?: string | null
          rejete_par?: string | null
          remise?: number
          remise_globale_montant?: number
          remise_globale_pct?: number
          representant_nom?: string | null
          statut?: string
          taux_tva?: number
          telephone?: string | null
          total_ht_brut?: number
          total_ht_net?: number
          total_quantite?: number
          total_remises_lignes?: number
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      conges: {
        Row: {
          conge_id: string
          created_at: string
          date_debut: string
          date_fin: string
          employe_id: string
          motif: string | null
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          conge_id?: string
          created_at?: string
          date_debut: string
          date_fin: string
          employe_id: string
          motif?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Update: {
          conge_id?: string
          created_at?: string
          date_debut?: string
          date_fin?: string
          employe_id?: string
          motif?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conges_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["employe_id"]
          },
        ]
      }
      contrats: {
        Row: {
          contrat_id: string
          created_at: string
          date_debut: string | null
          date_fin: string | null
          document_url: string | null
          employe_id: string | null
          employe_nom: string | null
          notes: string | null
          salaire: number | null
          statut: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          contrat_id?: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          document_url?: string | null
          employe_id?: string | null
          employe_nom?: string | null
          notes?: string | null
          salaire?: number | null
          statut?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          contrat_id?: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          document_url?: string | null
          employe_id?: string | null
          employe_nom?: string | null
          notes?: string | null
          salaire?: number | null
          statut?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      couts_logistiques: {
        Row: {
          cout_id: string
          created_at: string
          date_cout: string | null
          libelle: string | null
          livraison_id: string | null
          montant: number | null
          notes: string | null
          reference: string | null
          tournee_id: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          cout_id?: string
          created_at?: string
          date_cout?: string | null
          libelle?: string | null
          livraison_id?: string | null
          montant?: number | null
          notes?: string | null
          reference?: string | null
          tournee_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          cout_id?: string
          created_at?: string
          date_cout?: string | null
          libelle?: string | null
          livraison_id?: string | null
          montant?: number | null
          notes?: string | null
          reference?: string | null
          tournee_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      couts_logistiques_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          apres: Json | null
          audit_id: string
          avant: Json | null
          commentaire: string | null
          created_at: string
          tournee_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          apres?: Json | null
          audit_id?: string
          avant?: Json | null
          commentaire?: string | null
          created_at?: string
          tournee_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          apres?: Json | null
          audit_id?: string
          avant?: Json | null
          commentaire?: string | null
          created_at?: string
          tournee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couts_logistiques_audit_tournee_id_fkey"
            columns: ["tournee_id"]
            isOneToOne: false
            referencedRelation: "tournees"
            referencedColumns: ["tournee_id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          agent_email: string | null
          canal: string | null
          client_id: string | null
          created_at: string
          date_interaction: string | null
          interaction_id: string
          resume: string | null
          sujet: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          agent_email?: string | null
          canal?: string | null
          client_id?: string | null
          created_at?: string
          date_interaction?: string | null
          interaction_id?: string
          resume?: string | null
          sujet?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          agent_email?: string | null
          canal?: string | null
          client_id?: string | null
          created_at?: string
          date_interaction?: string | null
          interaction_id?: string
          resume?: string | null
          sujet?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      declarations_paie: {
        Row: {
          created_at: string
          date_declaration: string | null
          declaration_id: string
          montant: number | null
          notes: string | null
          periode: string | null
          reference: string | null
          statut: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_declaration?: string | null
          declaration_id?: string
          montant?: number | null
          notes?: string | null
          periode?: string | null
          reference?: string | null
          statut?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_declaration?: string | null
          declaration_id?: string
          montant?: number | null
          notes?: string | null
          periode?: string | null
          reference?: string | null
          statut?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      departements: {
        Row: {
          actif: boolean
          code: string | null
          created_at: string
          departement_id: string
          libelle: string
          nom: string | null
          responsable: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code?: string | null
          created_at?: string
          departement_id?: string
          libelle: string
          nom?: string | null
          responsable?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string | null
          created_at?: string
          departement_id?: string
          libelle?: string
          nom?: string | null
          responsable?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      depots: {
        Row: {
          actif: boolean
          adresse: string | null
          capacite: number | null
          code: string | null
          code_postal: string | null
          commune: string | null
          created_at: string
          depot_id: string
          description: string | null
          is_principal: boolean
          latitude: number | null
          longitude: number | null
          nom: string
          pays: string | null
          quartier: string | null
          responsable: string | null
          responsable_email: string | null
          telephone: string | null
          type_depot: string
          updated_at: string
          ville: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          capacite?: number | null
          code?: string | null
          code_postal?: string | null
          commune?: string | null
          created_at?: string
          depot_id?: string
          description?: string | null
          is_principal?: boolean
          latitude?: number | null
          longitude?: number | null
          nom: string
          pays?: string | null
          quartier?: string | null
          responsable?: string | null
          responsable_email?: string | null
          telephone?: string | null
          type_depot?: string
          updated_at?: string
          ville?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          capacite?: number | null
          code?: string | null
          code_postal?: string | null
          commune?: string | null
          created_at?: string
          depot_id?: string
          description?: string | null
          is_principal?: boolean
          latitude?: number | null
          longitude?: number | null
          nom?: string
          pays?: string | null
          quartier?: string | null
          responsable?: string | null
          responsable_email?: string | null
          telephone?: string | null
          type_depot?: string
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      document_certifications: {
        Row: {
          canonical_hash: string
          certification_id: string
          certified_at: string
          certified_by: string | null
          document_id: string
          document_reference: string
          document_type: string
          key_id: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          signature: string
          snapshot: Json
          statut: string
          token_hash: string
          verification_token: string | null
          verification_url: string | null
          version: number
        }
        Insert: {
          canonical_hash: string
          certification_id?: string
          certified_at?: string
          certified_by?: string | null
          document_id: string
          document_reference: string
          document_type: string
          key_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signature: string
          snapshot?: Json
          statut?: string
          token_hash: string
          verification_token?: string | null
          verification_url?: string | null
          version?: number
        }
        Update: {
          canonical_hash?: string
          certification_id?: string
          certified_at?: string
          certified_by?: string | null
          document_id?: string
          document_reference?: string
          document_type?: string
          key_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signature?: string
          snapshot?: Json
          statut?: string
          token_hash?: string
          verification_token?: string | null
          verification_url?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_certifications_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "signature_keys"
            referencedColumns: ["key_id"]
          },
        ]
      }
      document_drafts: {
        Row: {
          created_at: string
          doc_type: string
          draft_id: string
          entity_id: string | null
          id: string
          payload: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          draft_id: string
          entity_id?: string | null
          id?: string
          payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          draft_id?: string
          entity_id?: string | null
          id?: string
          payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_settings: {
        Row: {
          created_at: string
          logo_url: string | null
          selected_template: string
          template_per_type: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          logo_url?: string | null
          selected_template?: string
          template_per_type?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          logo_url?: string | null
          selected_template?: string
          template_per_type?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_template_prefs: {
        Row: {
          active_template_id: string | null
          created_at: string
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active_template_id?: string | null
          created_at?: string
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active_template_id?: string | null
          created_at?: string
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          actif: boolean
          code: string
          config: Json
          contenu: Json
          created_at: string
          description: string | null
          id: string
          label: string | null
          libelle: string
          template_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actif?: boolean
          code?: string
          config?: Json
          contenu?: Json
          created_at?: string
          description?: string | null
          id?: string
          label?: string | null
          libelle?: string
          template_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actif?: boolean
          code?: string
          config?: Json
          contenu?: Json
          created_at?: string
          description?: string | null
          id?: string
          label?: string | null
          libelle?: string
          template_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      document_verification_logs: {
        Row: {
          certification_id: string | null
          created_at: string
          document_reference: string | null
          ip_hash: string | null
          log_id: string
          result: string
          user_agent: string | null
        }
        Insert: {
          certification_id?: string | null
          created_at?: string
          document_reference?: string | null
          ip_hash?: string | null
          log_id?: string
          result: string
          user_agent?: string | null
        }
        Update: {
          certification_id?: string | null
          created_at?: string
          document_reference?: string | null
          ip_hash?: string | null
          log_id?: string
          result?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_verification_logs_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "document_certifications"
            referencedColumns: ["certification_id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          mime_type: string | null
          taille_octets: number | null
          titre: string
          type: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          taille_octets?: number | null
          titre: string
          type?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          taille_octets?: number | null
          titre?: string
          type?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      ecriture_lignes: {
        Row: {
          compte: string | null
          compte_id: string | null
          compte_libelle: string | null
          created_at: string
          credit: number | null
          debit: number | null
          ecriture_id: string
          libelle: string | null
          ligne_id: string
          numero_compte: string | null
          updated_at: string
        }
        Insert: {
          compte?: string | null
          compte_id?: string | null
          compte_libelle?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          ecriture_id: string
          libelle?: string | null
          ligne_id?: string
          numero_compte?: string | null
          updated_at?: string
        }
        Update: {
          compte?: string | null
          compte_id?: string | null
          compte_libelle?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          ecriture_id?: string
          libelle?: string | null
          ligne_id?: string
          numero_compte?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecriture_lignes_ecriture_id_fkey"
            columns: ["ecriture_id"]
            isOneToOne: false
            referencedRelation: "ecritures_comptables"
            referencedColumns: ["ecriture_id"]
          },
        ]
      }
      ecritures_comptables: {
        Row: {
          created_at: string
          date_ecriture: string | null
          ecriture_id: string
          exercice_id: string | null
          journal: string | null
          journal_id: string | null
          lettrage: string | null
          libelle: string | null
          montant: number | null
          piece_ref: string | null
          reference: string | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_ecriture?: string | null
          ecriture_id?: string
          exercice_id?: string | null
          journal?: string | null
          journal_id?: string | null
          lettrage?: string | null
          libelle?: string | null
          montant?: number | null
          piece_ref?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_ecriture?: string | null
          ecriture_id?: string
          exercice_id?: string | null
          journal?: string | null
          journal_id?: string | null
          lettrage?: string | null
          libelle?: string | null
          montant?: number | null
          piece_ref?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employe_documents: {
        Row: {
          created_at: string
          employe_id: string
          id: string
          mime_type: string | null
          nom: string
          storage_path: string
          taille_octets: number | null
          type_document: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          employe_id: string
          id?: string
          mime_type?: string | null
          nom: string
          storage_path: string
          taille_octets?: number | null
          type_document: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          employe_id?: string
          id?: string
          mime_type?: string | null
          nom?: string
          storage_path?: string
          taille_octets?: number | null
          type_document?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employe_documents_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["employe_id"]
          },
        ]
      }
      employes: {
        Row: {
          actif: boolean
          adresse: string | null
          avantages: Json | null
          banque: string | null
          categorie: string | null
          centre_cout: string | null
          certifications: Json | null
          commune: string | null
          competences: Json | null
          contact_urgence_lien: string | null
          contact_urgence_nom: string | null
          contact_urgence_telephone: string | null
          created_at: string
          date_embauche: string
          date_fin_contrat: string | null
          date_naissance: string | null
          deleted_at: string | null
          departement: string
          devise: string | null
          diplomes: Json | null
          echelon: string | null
          email: string | null
          employe_id: string
          fonction_id: string | null
          indemnites: Json | null
          lieu_naissance: string | null
          matricule: string
          mode_paiement: string | null
          nationalite: string | null
          niveau_etudes: string | null
          nom_complet: string
          numero_cni: string | null
          numero_cnps: string | null
          numero_compte: string | null
          numero_securite_sociale: string | null
          observations: string | null
          pays: string | null
          phone_normalized: string | null
          photo_url: string | null
          poste: string | null
          prenoms: string | null
          primes: Json | null
          responsable_hierarchique_id: string | null
          salaire: number
          service: string | null
          sexe: string | null
          site_affectation: string | null
          situation_matrimoniale: string | null
          statut_employe: string | null
          telephone: string | null
          telephone_secondaire: string | null
          temps_travail: string | null
          type_contrat: string | null
          updated_at: string
          user_id: string | null
          ville: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          avantages?: Json | null
          banque?: string | null
          categorie?: string | null
          centre_cout?: string | null
          certifications?: Json | null
          commune?: string | null
          competences?: Json | null
          contact_urgence_lien?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          date_embauche?: string
          date_fin_contrat?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          departement?: string
          devise?: string | null
          diplomes?: Json | null
          echelon?: string | null
          email?: string | null
          employe_id?: string
          fonction_id?: string | null
          indemnites?: Json | null
          lieu_naissance?: string | null
          matricule?: string
          mode_paiement?: string | null
          nationalite?: string | null
          niveau_etudes?: string | null
          nom_complet: string
          numero_cni?: string | null
          numero_cnps?: string | null
          numero_compte?: string | null
          numero_securite_sociale?: string | null
          observations?: string | null
          pays?: string | null
          phone_normalized?: string | null
          photo_url?: string | null
          poste?: string | null
          prenoms?: string | null
          primes?: Json | null
          responsable_hierarchique_id?: string | null
          salaire?: number
          service?: string | null
          sexe?: string | null
          site_affectation?: string | null
          situation_matrimoniale?: string | null
          statut_employe?: string | null
          telephone?: string | null
          telephone_secondaire?: string | null
          temps_travail?: string | null
          type_contrat?: string | null
          updated_at?: string
          user_id?: string | null
          ville?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          avantages?: Json | null
          banque?: string | null
          categorie?: string | null
          centre_cout?: string | null
          certifications?: Json | null
          commune?: string | null
          competences?: Json | null
          contact_urgence_lien?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          date_embauche?: string
          date_fin_contrat?: string | null
          date_naissance?: string | null
          deleted_at?: string | null
          departement?: string
          devise?: string | null
          diplomes?: Json | null
          echelon?: string | null
          email?: string | null
          employe_id?: string
          fonction_id?: string | null
          indemnites?: Json | null
          lieu_naissance?: string | null
          matricule?: string
          mode_paiement?: string | null
          nationalite?: string | null
          niveau_etudes?: string | null
          nom_complet?: string
          numero_cni?: string | null
          numero_cnps?: string | null
          numero_compte?: string | null
          numero_securite_sociale?: string | null
          observations?: string | null
          pays?: string | null
          phone_normalized?: string | null
          photo_url?: string | null
          poste?: string | null
          prenoms?: string | null
          primes?: Json | null
          responsable_hierarchique_id?: string | null
          salaire?: number
          service?: string | null
          sexe?: string | null
          site_affectation?: string | null
          situation_matrimoniale?: string | null
          statut_employe?: string | null
          telephone?: string | null
          telephone_secondaire?: string | null
          temps_travail?: string | null
          type_contrat?: string | null
          updated_at?: string
          user_id?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          commentaire: string | null
          created_at: string
          date_evaluation: string | null
          employe_id: string | null
          employe_nom: string | null
          evaluateur: string | null
          evaluation_id: string
          note: number | null
          periode: string | null
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date_evaluation?: string | null
          employe_id?: string | null
          employe_nom?: string | null
          evaluateur?: string | null
          evaluation_id?: string
          note?: number | null
          periode?: string | null
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date_evaluation?: string | null
          employe_id?: string | null
          employe_nom?: string | null
          evaluateur?: string | null
          evaluation_id?: string
          note?: number | null
          periode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exercice_cloture_journal: {
        Row: {
          cloture_par: string | null
          created_at: string
          date_cloture: string
          details: Json | null
          exercice_cible_id: string | null
          exercice_source_id: string | null
          journal_id: string
          montant_total_clients: number
          montant_total_fournisseurs: number
          nb_clients_reportes: number
          nb_fournisseurs_reportes: number
          updated_at: string
        }
        Insert: {
          cloture_par?: string | null
          created_at?: string
          date_cloture?: string
          details?: Json | null
          exercice_cible_id?: string | null
          exercice_source_id?: string | null
          journal_id?: string
          montant_total_clients?: number
          montant_total_fournisseurs?: number
          nb_clients_reportes?: number
          nb_fournisseurs_reportes?: number
          updated_at?: string
        }
        Update: {
          cloture_par?: string | null
          created_at?: string
          date_cloture?: string
          details?: Json | null
          exercice_cible_id?: string | null
          exercice_source_id?: string | null
          journal_id?: string
          montant_total_clients?: number
          montant_total_fournisseurs?: number
          nb_clients_reportes?: number
          nb_fournisseurs_reportes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercice_cloture_journal_exercice_cible_id_fkey"
            columns: ["exercice_cible_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "exercice_cloture_journal_exercice_cible_id_fkey"
            columns: ["exercice_cible_id"]
            isOneToOne: false
            referencedRelation: "exercices_comptables"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "exercice_cloture_journal_exercice_source_id_fkey"
            columns: ["exercice_source_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "exercice_cloture_journal_exercice_source_id_fkey"
            columns: ["exercice_source_id"]
            isOneToOne: false
            referencedRelation: "exercices_comptables"
            referencedColumns: ["exercice_id"]
          },
        ]
      }
      exercices_comptables: {
        Row: {
          cloture_le: string | null
          code: string | null
          created_at: string
          date_debut: string
          date_fin: string
          exercice_id: string
          is_actif: boolean
          libelle: string
          statut: string
          updated_at: string
        }
        Insert: {
          cloture_le?: string | null
          code?: string | null
          created_at?: string
          date_debut: string
          date_fin: string
          exercice_id?: string
          is_actif?: boolean
          libelle: string
          statut?: string
          updated_at?: string
        }
        Update: {
          cloture_le?: string | null
          code?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string
          exercice_id?: string
          is_actif?: boolean
          libelle?: string
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      expeditions: {
        Row: {
          bl_id: string | null
          created_at: string
          date_arrivee_prevue: string | null
          date_depart: string | null
          expedition_id: string
          notes: string | null
          reference: string
          statut: string
          transporteur: string | null
          transporteur_id: string | null
          updated_at: string
        }
        Insert: {
          bl_id?: string | null
          created_at?: string
          date_arrivee_prevue?: string | null
          date_depart?: string | null
          expedition_id?: string
          notes?: string | null
          reference: string
          statut?: string
          transporteur?: string | null
          transporteur_id?: string | null
          updated_at?: string
        }
        Update: {
          bl_id?: string | null
          created_at?: string
          date_arrivee_prevue?: string | null
          date_depart?: string | null
          expedition_id?: string
          notes?: string | null
          reference?: string
          statut?: string
          transporteur?: string | null
          transporteur_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expeditions_bl_id_fkey"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bons_livraison"
            referencedColumns: ["bl_id"]
          },
          {
            foreignKeyName: "expeditions_transporteur_id_fkey"
            columns: ["transporteur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs"
            referencedColumns: ["transporteur_id"]
          },
        ]
      }
      factures: {
        Row: {
          client_id: string | null
          client_nom: string | null
          commande_id: string | null
          created_at: string
          date_echeance: string | null
          date_facture: string
          exercice_id: string | null
          facture_id: string
          montant_paye: number
          montant_total: number
          notes: string | null
          reference: string
          statut: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          exercice_id?: string | null
          facture_id?: string
          montant_paye?: number
          montant_total?: number
          notes?: string | null
          reference?: string
          statut?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          exercice_id?: string | null
          facture_id?: string
          montant_paye?: number
          montant_total?: number
          notes?: string | null
          reference?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
        ]
      }
      fne_declarations: {
        Row: {
          created_at: string
          date_declaration: string | null
          facture_id: string | null
          fne_id: string
          message: string | null
          numero_fne: string | null
          qr_code: string | null
          reference: string | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_declaration?: string | null
          facture_id?: string | null
          fne_id?: string
          message?: string | null
          numero_fne?: string | null
          qr_code?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_declaration?: string | null
          facture_id?: string | null
          fne_id?: string
          message?: string | null
          numero_fne?: string | null
          qr_code?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fne_factures: {
        Row: {
          balance_sticker: number | null
          client_email: string | null
          client_ncc: string | null
          client_nom: string | null
          client_seller_name: string | null
          client_telephone: string | null
          code_dgi: string | null
          commercial_message: string | null
          created_at: string
          date_emission: string | null
          discount: number
          error_message: string | null
          establishment: string | null
          facture_id: string | null
          fne_id: string
          fne_ref: string | null
          footer: string | null
          id: string
          invoice_type: string | null
          items: Json
          metadata: Json
          montant: number | null
          notes: string | null
          parent_fne_id: string | null
          payment_method: string | null
          point_of_sale: string | null
          qr_code: string | null
          reference: string | null
          response_payload: Json | null
          source: string | null
          statut: string
          submitted_at: string | null
          template: string | null
          token: string | null
          updated_at: string
          validated_at: string | null
          verification_url: string | null
        }
        Insert: {
          balance_sticker?: number | null
          client_email?: string | null
          client_ncc?: string | null
          client_nom?: string | null
          client_seller_name?: string | null
          client_telephone?: string | null
          code_dgi?: string | null
          commercial_message?: string | null
          created_at?: string
          date_emission?: string | null
          discount?: number
          error_message?: string | null
          establishment?: string | null
          facture_id?: string | null
          fne_id?: string
          fne_ref?: string | null
          footer?: string | null
          id?: string
          invoice_type?: string | null
          items?: Json
          metadata?: Json
          montant?: number | null
          notes?: string | null
          parent_fne_id?: string | null
          payment_method?: string | null
          point_of_sale?: string | null
          qr_code?: string | null
          reference?: string | null
          response_payload?: Json | null
          source?: string | null
          statut?: string
          submitted_at?: string | null
          template?: string | null
          token?: string | null
          updated_at?: string
          validated_at?: string | null
          verification_url?: string | null
        }
        Update: {
          balance_sticker?: number | null
          client_email?: string | null
          client_ncc?: string | null
          client_nom?: string | null
          client_seller_name?: string | null
          client_telephone?: string | null
          code_dgi?: string | null
          commercial_message?: string | null
          created_at?: string
          date_emission?: string | null
          discount?: number
          error_message?: string | null
          establishment?: string | null
          facture_id?: string | null
          fne_id?: string
          fne_ref?: string | null
          footer?: string | null
          id?: string
          invoice_type?: string | null
          items?: Json
          metadata?: Json
          montant?: number | null
          notes?: string | null
          parent_fne_id?: string | null
          payment_method?: string | null
          point_of_sale?: string | null
          qr_code?: string | null
          reference?: string | null
          response_payload?: Json | null
          source?: string | null
          statut?: string
          submitted_at?: string | null
          template?: string | null
          token?: string | null
          updated_at?: string
          validated_at?: string | null
          verification_url?: string | null
        }
        Relationships: []
      }
      fne_logs: {
        Row: {
          action: string | null
          attempt_number: number | null
          created_at: string
          duration_ms: number | null
          facture_id: string | null
          fne_facture_id: string | null
          http_status: number | null
          id: string
          message: string | null
          niveau: string
          payload: Json
          response: Json | null
          statut: string | null
        }
        Insert: {
          action?: string | null
          attempt_number?: number | null
          created_at?: string
          duration_ms?: number | null
          facture_id?: string | null
          fne_facture_id?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          niveau?: string
          payload?: Json
          response?: Json | null
          statut?: string | null
        }
        Update: {
          action?: string | null
          attempt_number?: number | null
          created_at?: string
          duration_ms?: number | null
          facture_id?: string | null
          fne_facture_id?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          niveau?: string
          payload?: Json
          response?: Json | null
          statut?: string | null
        }
        Relationships: []
      }
      fne_settings: {
        Row: {
          actif: boolean
          cle: string | null
          cle_api: string | null
          config: Json
          created_at: string
          environnement: string
          id: string
          identifiant: string | null
          setting_id: string
          updated_at: string
          valeur: string | null
        }
        Insert: {
          actif?: boolean
          cle?: string | null
          cle_api?: string | null
          config?: Json
          created_at?: string
          environnement?: string
          id?: string
          identifiant?: string | null
          setting_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Update: {
          actif?: boolean
          cle?: string | null
          cle_api?: string | null
          config?: Json
          created_at?: string
          environnement?: string
          id?: string
          identifiant?: string | null
          setting_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Relationships: []
      }
      fonctions: {
        Row: {
          actif: boolean
          code: string | null
          created_at: string
          departement_id: string | null
          description: string | null
          fonction_id: string
          libelle: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code?: string | null
          created_at?: string
          departement_id?: string | null
          description?: string | null
          fonction_id?: string
          libelle: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string | null
          created_at?: string
          departement_id?: string | null
          description?: string | null
          fonction_id?: string
          libelle?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fonctions_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["departement_id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          actif: boolean
          adresse: string | null
          contact: string | null
          created_at: string
          email: string | null
          fournisseur_id: string
          raison_sociale: string
          reference: string | null
          representant: string | null
          telephone: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          fournisseur_id?: string
          raison_sociale: string
          reference?: string | null
          representant?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          fournisseur_id?: string
          raison_sociale?: string
          reference?: string | null
          representant?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      gares: {
        Row: {
          actif: boolean
          code: string | null
          created_at: string
          gare_id: string
          nom: string
          transporteur_id: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          actif?: boolean
          code?: string | null
          created_at?: string
          gare_id?: string
          nom: string
          transporteur_id?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          actif?: boolean
          code?: string | null
          created_at?: string
          gare_id?: string
          nom?: string
          transporteur_id?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gares_transporteur_id_fkey"
            columns: ["transporteur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs"
            referencedColumns: ["transporteur_id"]
          },
        ]
      }
      historique_envois: {
        Row: {
          created_at: string
          destinataire: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          metadata: Json
          reference: string | null
          sent_by: string | null
          statut: string
          type: string
        }
        Insert: {
          created_at?: string
          destinataire?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          reference?: string | null
          sent_by?: string | null
          statut?: string
          type: string
        }
        Update: {
          created_at?: string
          destinataire?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          reference?: string | null
          sent_by?: string | null
          statut?: string
          type?: string
        }
        Relationships: []
      }
      incident_alerts: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      incident_lignes: {
        Row: {
          created_at: string
          designation: string
          incident_id: string
          ligne_id: string
          produit_id: string | null
          quantite: number
          reference_produit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string
          incident_id: string
          ligne_id?: string
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string
          incident_id?: string
          ligne_id?: string
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_lignes_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["incident_id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          created_by: string | null
          date_incident: string | null
          depot_id: string | null
          description: string | null
          exercice_id: string | null
          gravite: string | null
          incident_id: string
          motif: string | null
          nb_produits: number
          numero: string | null
          observations: string | null
          produit_id: string | null
          reference: string | null
          responsable_id: string | null
          responsable_nom: string | null
          statut: string | null
          total_quantite: number
          type_incident: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_incident?: string | null
          depot_id?: string | null
          description?: string | null
          exercice_id?: string | null
          gravite?: string | null
          incident_id?: string
          motif?: string | null
          nb_produits?: number
          numero?: string | null
          observations?: string | null
          produit_id?: string | null
          reference?: string | null
          responsable_id?: string | null
          responsable_nom?: string | null
          statut?: string | null
          total_quantite?: number
          type_incident?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_incident?: string | null
          depot_id?: string | null
          description?: string | null
          exercice_id?: string | null
          gravite?: string | null
          incident_id?: string
          motif?: string | null
          nb_produits?: number
          numero?: string | null
          observations?: string | null
          produit_id?: string | null
          reference?: string | null
          responsable_id?: string | null
          responsable_nom?: string | null
          statut?: string | null
          total_quantite?: number
          type_incident?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventaire_lignes: {
        Row: {
          created_at: string
          designation: string | null
          ecart: number | null
          inventaire_id: string
          ligne_id: string
          observation: string | null
          produit_id: string | null
          quantite_comptee: number
          quantite_physique: number | null
          quantite_theorique: number | null
          reference_produit: string | null
          stock_theorique: number
          updated_at: string
          valeur_ecart: number
          valeur_unitaire: number
        }
        Insert: {
          created_at?: string
          designation?: string | null
          ecart?: number | null
          inventaire_id: string
          ligne_id?: string
          observation?: string | null
          produit_id?: string | null
          quantite_comptee?: number
          quantite_physique?: number | null
          quantite_theorique?: number | null
          reference_produit?: string | null
          stock_theorique?: number
          updated_at?: string
          valeur_ecart?: number
          valeur_unitaire?: number
        }
        Update: {
          created_at?: string
          designation?: string | null
          ecart?: number | null
          inventaire_id?: string
          ligne_id?: string
          observation?: string | null
          produit_id?: string | null
          quantite_comptee?: number
          quantite_physique?: number | null
          quantite_theorique?: number | null
          reference_produit?: string | null
          stock_theorique?: number
          updated_at?: string
          valeur_ecart?: number
          valeur_unitaire?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventaire_lignes_inventaire_id_fkey"
            columns: ["inventaire_id"]
            isOneToOne: false
            referencedRelation: "inventaires"
            referencedColumns: ["inventaire_id"]
          },
          {
            foreignKeyName: "inventaire_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["produit_id"]
          },
          {
            foreignKeyName: "inventaire_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "v_produits"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      inventaires: {
        Row: {
          categorie_id: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_inventaire: string | null
          depot_id: string | null
          ecart_total: number | null
          exercice_id: string | null
          inventaire_id: string
          nb_ecarts: number
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          regularized_at: string | null
          statut: string | null
          type_inventaire: string
          updated_at: string
          valeur_totale: number
          validated_at: string | null
        }
        Insert: {
          categorie_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_inventaire?: string | null
          depot_id?: string | null
          ecart_total?: number | null
          exercice_id?: string | null
          inventaire_id?: string
          nb_ecarts?: number
          nb_produits?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          reference?: string | null
          regularized_at?: string | null
          statut?: string | null
          type_inventaire?: string
          updated_at?: string
          valeur_totale?: number
          validated_at?: string | null
        }
        Update: {
          categorie_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_inventaire?: string | null
          depot_id?: string | null
          ecart_total?: number | null
          exercice_id?: string | null
          inventaire_id?: string
          nb_ecarts?: number
          nb_produits?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          reference?: string | null
          regularized_at?: string | null
          statut?: string | null
          type_inventaire?: string
          updated_at?: string
          valeur_totale?: number
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventaires_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories_produits"
            referencedColumns: ["categorie_id"]
          },
          {
            foreignKeyName: "inventaires_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
          {
            foreignKeyName: "inventaires_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "inventaires_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices_comptables"
            referencedColumns: ["exercice_id"]
          },
        ]
      }
      journaux_comptables: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          journal_id: string
          libelle: string
          type: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          journal_id?: string
          libelle: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          journal_id?: string
          libelle?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      livraisons: {
        Row: {
          adresse: string | null
          adresse_livraison: string | null
          bl_id: string | null
          client_id: string | null
          client_nom: string | null
          colisage_id: string | null
          commande_id: string | null
          commune: string | null
          contact_dest: string | null
          created_at: string
          date_livraison: string | null
          expedition_id: string | null
          figee: boolean
          gare_arrivee_id: string | null
          gare_depart_id: string | null
          livraison_id: string
          livreur_id: string | null
          notes: string | null
          reference: string | null
          statut: string | null
          telephone_dest: string | null
          tournee_id: string | null
          transporteur: string | null
          transporteur_id: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_livraison?: string | null
          bl_id?: string | null
          client_id?: string | null
          client_nom?: string | null
          colisage_id?: string | null
          commande_id?: string | null
          commune?: string | null
          contact_dest?: string | null
          created_at?: string
          date_livraison?: string | null
          expedition_id?: string | null
          figee?: boolean
          gare_arrivee_id?: string | null
          gare_depart_id?: string | null
          livraison_id?: string
          livreur_id?: string | null
          notes?: string | null
          reference?: string | null
          statut?: string | null
          telephone_dest?: string | null
          tournee_id?: string | null
          transporteur?: string | null
          transporteur_id?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_livraison?: string | null
          bl_id?: string | null
          client_id?: string | null
          client_nom?: string | null
          colisage_id?: string | null
          commande_id?: string | null
          commune?: string | null
          contact_dest?: string | null
          created_at?: string
          date_livraison?: string | null
          expedition_id?: string | null
          figee?: boolean
          gare_arrivee_id?: string | null
          gare_depart_id?: string | null
          livraison_id?: string
          livreur_id?: string | null
          notes?: string | null
          reference?: string | null
          statut?: string | null
          telephone_dest?: string | null
          tournee_id?: string | null
          transporteur?: string | null
          transporteur_id?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livraisons_bl_id_fkey"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bons_livraison"
            referencedColumns: ["bl_id"]
          },
          {
            foreignKeyName: "livraisons_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "livraisons_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
          {
            foreignKeyName: "livraisons_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["expedition_id"]
          },
          {
            foreignKeyName: "livraisons_gare_arrivee_id_fkey"
            columns: ["gare_arrivee_id"]
            isOneToOne: false
            referencedRelation: "gares"
            referencedColumns: ["gare_id"]
          },
          {
            foreignKeyName: "livraisons_gare_depart_id_fkey"
            columns: ["gare_depart_id"]
            isOneToOne: false
            referencedRelation: "gares"
            referencedColumns: ["gare_id"]
          },
          {
            foreignKeyName: "livraisons_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["livreur_id"]
          },
          {
            foreignKeyName: "livraisons_transporteur_id_fkey"
            columns: ["transporteur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs"
            referencedColumns: ["transporteur_id"]
          },
        ]
      }
      livraisons_commande: {
        Row: {
          bl_id: string | null
          commande_id: string | null
          created_at: string
          gare_nom: string | null
          livraison_id: string
          nb_cartons: number | null
          quantite_commandee: number | null
          statut: string | null
          tournee_id: string | null
          transporteur: string | null
          type_livraison: string | null
          updated_at: string
          ville_livraison: string | null
        }
        Insert: {
          bl_id?: string | null
          commande_id?: string | null
          created_at?: string
          gare_nom?: string | null
          livraison_id?: string
          nb_cartons?: number | null
          quantite_commandee?: number | null
          statut?: string | null
          tournee_id?: string | null
          transporteur?: string | null
          type_livraison?: string | null
          updated_at?: string
          ville_livraison?: string | null
        }
        Update: {
          bl_id?: string | null
          commande_id?: string | null
          created_at?: string
          gare_nom?: string | null
          livraison_id?: string
          nb_cartons?: number | null
          quantite_commandee?: number | null
          statut?: string | null
          tournee_id?: string | null
          transporteur?: string | null
          type_livraison?: string | null
          updated_at?: string
          ville_livraison?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livraisons_commande_bl_id_fkey"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bons_livraison"
            referencedColumns: ["bl_id"]
          },
          {
            foreignKeyName: "livraisons_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
          {
            foreignKeyName: "livraisons_commande_tournee_id_fkey"
            columns: ["tournee_id"]
            isOneToOne: false
            referencedRelation: "tournees"
            referencedColumns: ["tournee_id"]
          },
        ]
      }
      livreurs: {
        Row: {
          actif: boolean
          created_at: string
          livreur_id: string
          matricule: string | null
          nom: string | null
          nom_complet: string
          permis: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          livreur_id?: string
          matricule?: string | null
          nom?: string | null
          nom_complet: string
          permis?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          livreur_id?: string
          matricule?: string | null
          nom?: string | null
          nom_complet?: string
          permis?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      livsuivi_commandes: {
        Row: {
          cloturee: boolean
          commande_id: string
          commentaire_reception: string | null
          created_at: string
          derniere_maj: string
          gare_depot: string | null
          gare_destination: string | null
          heure_arrivee: string | null
          heure_depart: string | null
          heure_livraison: string | null
          id: string
          livreur_nom: string | null
          nb_cartons: number | null
          ordre_passage: number | null
          photo_preuve_url: string | null
          point_livraison: string | null
          receptionnaire_nom: string | null
          receptionnaire_telephone: string | null
          retour_motif: string | null
          signature_url: string | null
          statut: string
          tournee_id: string | null
          type_livraison: string
          updated_at: string
          vehicule: string | null
          ville_destination: string | null
        }
        Insert: {
          cloturee?: boolean
          commande_id: string
          commentaire_reception?: string | null
          created_at?: string
          derniere_maj?: string
          gare_depot?: string | null
          gare_destination?: string | null
          heure_arrivee?: string | null
          heure_depart?: string | null
          heure_livraison?: string | null
          id?: string
          livreur_nom?: string | null
          nb_cartons?: number | null
          ordre_passage?: number | null
          photo_preuve_url?: string | null
          point_livraison?: string | null
          receptionnaire_nom?: string | null
          receptionnaire_telephone?: string | null
          retour_motif?: string | null
          signature_url?: string | null
          statut?: string
          tournee_id?: string | null
          type_livraison?: string
          updated_at?: string
          vehicule?: string | null
          ville_destination?: string | null
        }
        Update: {
          cloturee?: boolean
          commande_id?: string
          commentaire_reception?: string | null
          created_at?: string
          derniere_maj?: string
          gare_depot?: string | null
          gare_destination?: string | null
          heure_arrivee?: string | null
          heure_depart?: string | null
          heure_livraison?: string | null
          id?: string
          livreur_nom?: string | null
          nb_cartons?: number | null
          ordre_passage?: number | null
          photo_preuve_url?: string | null
          point_livraison?: string | null
          receptionnaire_nom?: string | null
          receptionnaire_telephone?: string | null
          retour_motif?: string | null
          signature_url?: string | null
          statut?: string
          tournee_id?: string | null
          type_livraison?: string
          updated_at?: string
          vehicule?: string | null
          ville_destination?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livsuivi_commandes_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
          {
            foreignKeyName: "livsuivi_commandes_tournee_id_fkey"
            columns: ["tournee_id"]
            isOneToOne: false
            referencedRelation: "tournees"
            referencedColumns: ["tournee_id"]
          },
        ]
      }
      livsuivi_historique: {
        Row: {
          commentaire: string | null
          created_at: string
          etape: string
          id: string
          livraison_id: string
          meta: Json
          user_id: string | null
          user_nom: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          etape: string
          id?: string
          livraison_id: string
          meta?: Json
          user_id?: string | null
          user_nom?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          etape?: string
          id?: string
          livraison_id?: string
          meta?: Json
          user_id?: string | null
          user_nom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livsuivi_historique_livraison_id_fkey"
            columns: ["livraison_id"]
            isOneToOne: false
            referencedRelation: "livsuivi_commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      missions: {
        Row: {
          created_at: string
          date_debut: string | null
          date_fin: string | null
          destination: string | null
          employe_id: string | null
          libelle: string | null
          mission_id: string
          montant: number | null
          notes: string | null
          reference: string | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          destination?: string | null
          employe_id?: string | null
          libelle?: string | null
          mission_id?: string
          montant?: number | null
          notes?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          destination?: string | null
          employe_id?: string | null
          libelle?: string | null
          mission_id?: string
          montant?: number | null
          notes?: string | null
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          modules_desactives: string[]
          notifs_navigateur: boolean
          son_active: boolean
          types_desactives: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          modules_desactives?: string[]
          notifs_navigateur?: boolean
          son_active?: boolean
          types_desactives?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          modules_desactives?: string[]
          notifs_navigateur?: boolean
          son_active?: boolean
          types_desactives?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          date_notification: string
          document_id: string | null
          document_reference: string | null
          document_type: string | null
          lien: string | null
          lu: boolean
          message: string | null
          metadata: Json | null
          module: string | null
          notification_id: string
          priorite: string | null
          role_cible: string | null
          titre: string
          type_notification: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date_notification?: string
          document_id?: string | null
          document_reference?: string | null
          document_type?: string | null
          lien?: string | null
          lu?: boolean
          message?: string | null
          metadata?: Json | null
          module?: string | null
          notification_id?: string
          priorite?: string | null
          role_cible?: string | null
          titre: string
          type_notification?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date_notification?: string
          document_id?: string | null
          document_reference?: string | null
          document_type?: string | null
          lien?: string | null
          lu?: boolean
          message?: string | null
          metadata?: Json | null
          module?: string | null
          notification_id?: string
          priorite?: string | null
          role_cible?: string | null
          titre?: string
          type_notification?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      paiement_annulations_audit: {
        Row: {
          annule_le: string
          annule_par: string | null
          created_at: string
          facture_id: string | null
          id: string
          montant_annule: number
          notes: string | null
          paiement_id: string
          raison: string
        }
        Insert: {
          annule_le?: string
          annule_par?: string | null
          created_at?: string
          facture_id?: string | null
          id?: string
          montant_annule?: number
          notes?: string | null
          paiement_id: string
          raison?: string
        }
        Update: {
          annule_le?: string
          annule_par?: string | null
          created_at?: string
          facture_id?: string | null
          id?: string
          montant_annule?: number
          notes?: string | null
          paiement_id?: string
          raison?: string
        }
        Relationships: []
      }
      paiements: {
        Row: {
          banque: string | null
          client_nom: string | null
          commentaire_validation: string | null
          created_at: string
          cree_par: string | null
          date_paiement: string
          exercice_id: string | null
          facture_id: string | null
          idempotency_key: string | null
          mode_paiement: string
          montant: number
          motif_rejet: string | null
          notes: string | null
          num_transaction: string | null
          observations: string | null
          paiement_id: string
          reference: string
          reference_paiement: string | null
          rejete_le: string | null
          rejete_par: string | null
          statut: string
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }
        Insert: {
          banque?: string | null
          client_nom?: string | null
          commentaire_validation?: string | null
          created_at?: string
          cree_par?: string | null
          date_paiement?: string
          exercice_id?: string | null
          facture_id?: string | null
          idempotency_key?: string | null
          mode_paiement?: string
          montant?: number
          motif_rejet?: string | null
          notes?: string | null
          num_transaction?: string | null
          observations?: string | null
          paiement_id?: string
          reference?: string
          reference_paiement?: string | null
          rejete_le?: string | null
          rejete_par?: string | null
          statut?: string
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Update: {
          banque?: string | null
          client_nom?: string | null
          commentaire_validation?: string | null
          created_at?: string
          cree_par?: string | null
          date_paiement?: string
          exercice_id?: string | null
          facture_id?: string | null
          idempotency_key?: string | null
          mode_paiement?: string
          montant?: number
          motif_rejet?: string | null
          notes?: string | null
          num_transaction?: string | null
          observations?: string | null
          paiement_id?: string
          reference?: string
          reference_paiement?: string | null
          rejete_le?: string | null
          rejete_par?: string | null
          statut?: string
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["facture_id"]
          },
        ]
      }
      parametres_entreprise: {
        Row: {
          categorie: string | null
          cle: string
          created_at: string
          description: string | null
          parametre_id: string
          updated_at: string
          valeur: string | null
        }
        Insert: {
          categorie?: string | null
          cle: string
          created_at?: string
          description?: string | null
          parametre_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Update: {
          categorie?: string | null
          cle?: string
          created_at?: string
          description?: string | null
          parametre_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Relationships: []
      }
      parametres_paie: {
        Row: {
          cle: string
          created_at: string
          description: string | null
          parametre_id: string
          updated_at: string
          valeur: string | null
        }
        Insert: {
          cle: string
          created_at?: string
          description?: string | null
          parametre_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Update: {
          cle?: string
          created_at?: string
          description?: string | null
          parametre_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Relationships: []
      }
      parametres_systeme: {
        Row: {
          categorie: string | null
          cle: string
          created_at: string
          description: string | null
          parametre_id: string
          updated_at: string
          valeur: string | null
        }
        Insert: {
          categorie?: string | null
          cle: string
          created_at?: string
          description?: string | null
          parametre_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Update: {
          categorie?: string | null
          cle?: string
          created_at?: string
          description?: string | null
          parametre_id?: string
          updated_at?: string
          valeur?: string | null
        }
        Relationships: []
      }
      perf_query_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          metadata: Json
          query_key: string | null
          route: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          metadata?: Json
          query_key?: string | null
          route?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          metadata?: Json
          query_key?: string | null
          route?: string | null
          status?: string | null
        }
        Relationships: []
      }
      perf_web_vitals: {
        Row: {
          created_at: string
          id: string
          metric: string
          navigation_type: string | null
          rating: string
          route: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          navigation_type?: string | null
          rating: string
          route?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          navigation_type?: string | null
          rating?: string
          route?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: []
      }
      plan_comptable: {
        Row: {
          actif: boolean
          classe: number | null
          compte_id: string
          created_at: string
          libelle: string
          numero: string
          parent_numero: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          classe?: number | null
          compte_id?: string
          created_at?: string
          libelle: string
          numero: string
          parent_numero?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          classe?: number | null
          compte_id?: string
          created_at?: string
          libelle?: string
          numero?: string
          parent_numero?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      preparateurs: {
        Row: {
          actif: boolean
          created_at: string
          email: string | null
          nom_complet: string
          preparateur_id: string
          role: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email?: string | null
          nom_complet: string
          preparateur_id?: string
          role?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string | null
          nom_complet?: string
          preparateur_id?: string
          role?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      preparateurs_colisage: {
        Row: {
          actif: boolean
          created_at: string
          depot_id: string | null
          nom: string
          observations: string | null
          poste: string | null
          preparateur_id: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          depot_id?: string | null
          nom: string
          observations?: string | null
          poste?: string | null
          preparateur_id?: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          depot_id?: string | null
          nom?: string
          observations?: string | null
          poste?: string | null
          preparateur_id?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preparateurs_colisage_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
        ]
      }
      produits: {
        Row: {
          actif: boolean
          auteur: string | null
          categorie: string | null
          categorie_id: string | null
          cover_path: string | null
          cover_thumb_path: string | null
          cover_updated_at: string | null
          created_at: string
          editeur: string | null
          isbn: string | null
          matiere: string | null
          niveau: string | null
          niveau_ordre: number | null
          pin_order: number | null
          prix_achat: number
          prix_vente: number
          produit_id: string
          reference: string | null
          seuil_alerte: number | null
          stock: number | null
          titre: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          auteur?: string | null
          categorie?: string | null
          categorie_id?: string | null
          cover_path?: string | null
          cover_thumb_path?: string | null
          cover_updated_at?: string | null
          created_at?: string
          editeur?: string | null
          isbn?: string | null
          matiere?: string | null
          niveau?: string | null
          niveau_ordre?: number | null
          pin_order?: number | null
          prix_achat?: number
          prix_vente?: number
          produit_id?: string
          reference?: string | null
          seuil_alerte?: number | null
          stock?: number | null
          titre: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          auteur?: string | null
          categorie?: string | null
          categorie_id?: string | null
          cover_path?: string | null
          cover_thumb_path?: string | null
          cover_updated_at?: string | null
          created_at?: string
          editeur?: string | null
          isbn?: string | null
          matiere?: string | null
          niveau?: string | null
          niveau_ordre?: number | null
          pin_order?: number | null
          prix_achat?: number
          prix_vente?: number
          produit_id?: string
          reference?: string | null
          seuil_alerte?: number | null
          stock?: number | null
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          actif: boolean
          avatar_url: string | null
          created_at: string
          departement: string | null
          departement_id: string | null
          depot_principal_id: string | null
          derniere_connexion: string | null
          email: string | null
          fonction: string | null
          id: string
          locked_at: string | null
          locked_reason: string | null
          matricule: string | null
          must_change_password: boolean
          nom: string | null
          nom_complet: string | null
          password_compromised_at: string | null
          phone_normalized: string | null
          prenom: string | null
          route_restrictions: string[]
          service_id: string | null
          statut: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          avatar_url?: string | null
          created_at?: string
          departement?: string | null
          departement_id?: string | null
          depot_principal_id?: string | null
          derniere_connexion?: string | null
          email?: string | null
          fonction?: string | null
          id: string
          locked_at?: string | null
          locked_reason?: string | null
          matricule?: string | null
          must_change_password?: boolean
          nom?: string | null
          nom_complet?: string | null
          password_compromised_at?: string | null
          phone_normalized?: string | null
          prenom?: string | null
          route_restrictions?: string[]
          service_id?: string | null
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          avatar_url?: string | null
          created_at?: string
          departement?: string | null
          departement_id?: string | null
          depot_principal_id?: string | null
          derniere_connexion?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          locked_at?: string | null
          locked_reason?: string | null
          matricule?: string | null
          must_change_password?: boolean
          nom?: string | null
          nom_complet?: string | null
          password_compromised_at?: string | null
          phone_normalized?: string | null
          prenom?: string | null
          route_restrictions?: string[]
          service_id?: string | null
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["departement_id"]
          },
          {
            foreignKeyName: "profiles_depot_principal_id_fkey"
            columns: ["depot_principal_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
          {
            foreignKeyName: "profiles_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["service_id"]
          },
        ]
      }
      proforma_lignes: {
        Row: {
          created_at: string
          designation: string | null
          ligne_id: string
          prix_unitaire: number | null
          produit_id: string | null
          proforma_id: string
          quantite: number | null
          reference_produit: string | null
          total_ligne: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          ligne_id?: string
          prix_unitaire?: number | null
          produit_id?: string | null
          proforma_id: string
          quantite?: number | null
          reference_produit?: string | null
          total_ligne?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          ligne_id?: string
          prix_unitaire?: number | null
          produit_id?: string | null
          proforma_id?: string
          quantite?: number | null
          reference_produit?: string | null
          total_ligne?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proforma_lignes_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["proforma_id"]
          },
        ]
      }
      proformas: {
        Row: {
          client_id: string | null
          client_nom: string | null
          commande_id: string | null
          created_at: string
          date_proforma: string | null
          date_validite: string | null
          montant_total: number | null
          notes: string | null
          proforma_id: string
          reference: string | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          date_proforma?: string | null
          date_validite?: string | null
          montant_total?: number | null
          notes?: string | null
          proforma_id?: string
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          date_proforma?: string | null
          date_validite?: string | null
          montant_total?: number | null
          notes?: string | null
          proforma_id?: string
          reference?: string | null
          statut?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proformas_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
        ]
      }
      rbac_audit_log: {
        Row: {
          action: string
          apres: Json | null
          avant: Json | null
          created_at: string
          details: Json
          id: string
          ip: string | null
          role_code: string | null
          role_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          apres?: Json | null
          avant?: Json | null
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          role_code?: string | null
          role_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          apres?: Json | null
          avant?: Json | null
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          role_code?: string | null
          role_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rbac_permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          libelle: string
          module: string
          sous_module: string | null
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          libelle: string
          module: string
          sous_module?: string | null
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          libelle?: string
          module?: string
          sous_module?: string | null
        }
        Relationships: []
      }
      rbac_role_permissions: {
        Row: {
          accorde: boolean
          created_at: string
          permission_code: string
          role_id: string
        }
        Insert: {
          accorde?: boolean
          created_at?: string
          permission_code: string
          role_id: string
        }
        Update: {
          accorde?: boolean
          created_at?: string
          permission_code?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "rbac_permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rbac_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      rbac_roles: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          description: string | null
          hierite_de: string | null
          id: string
          libelle: string
          role_id: string
          systeme: boolean
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          description?: string | null
          hierite_de?: string | null
          id?: string
          libelle: string
          role_id?: string
          systeme?: boolean
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          description?: string | null
          hierite_de?: string | null
          id?: string
          libelle?: string
          role_id?: string
          systeme?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_roles_hierite_de_fkey"
            columns: ["hierite_de"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      rbac_user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          rbac_role_id: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          rbac_role_id?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          rbac_role_id?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_user_roles_rbac_role_id_fkey"
            columns: ["rbac_role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["role_id"]
          },
        ]
      }
      rbac2_audit: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          id: number
          ip: unknown
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: number
          ip?: unknown
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          id?: number
          ip?: unknown
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      rbac2_domains: {
        Row: {
          code: string
          created_at: string
          icon: string | null
          label: string
          sort: number
        }
        Insert: {
          code: string
          created_at?: string
          icon?: string | null
          label: string
          sort?: number
        }
        Update: {
          code?: string
          created_at?: string
          icon?: string | null
          label?: string
          sort?: number
        }
        Relationships: []
      }
      rbac2_modules: {
        Row: {
          code: string
          created_at: string
          domain_code: string
          icon: string | null
          label: string
          sort: number
        }
        Insert: {
          code: string
          created_at?: string
          domain_code: string
          icon?: string | null
          label: string
          sort?: number
        }
        Update: {
          code?: string
          created_at?: string
          domain_code?: string
          icon?: string | null
          label?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "rbac2_modules_domain_code_fkey"
            columns: ["domain_code"]
            isOneToOne: false
            referencedRelation: "rbac2_domains"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac2_perm_deps: {
        Row: {
          perm_code: string
          requires_code: string
        }
        Insert: {
          perm_code: string
          requires_code: string
        }
        Update: {
          perm_code?: string
          requires_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac2_perm_deps_perm_code_fkey"
            columns: ["perm_code"]
            isOneToOne: false
            referencedRelation: "rbac2_permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rbac2_perm_deps_requires_code_fkey"
            columns: ["requires_code"]
            isOneToOne: false
            referencedRelation: "rbac2_permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac2_permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          label: string
          resource_code: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          label: string
          resource_code: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          label?: string
          resource_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac2_permissions_resource_code_fkey"
            columns: ["resource_code"]
            isOneToOne: false
            referencedRelation: "rbac2_resources"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac2_resources: {
        Row: {
          code: string
          created_at: string
          kind: string
          label: string
          module_code: string
          route: string | null
          rpc: string | null
          sort: number
        }
        Insert: {
          code: string
          created_at?: string
          kind?: string
          label: string
          module_code: string
          route?: string | null
          rpc?: string | null
          sort?: number
        }
        Update: {
          code?: string
          created_at?: string
          kind?: string
          label?: string
          module_code?: string
          route?: string | null
          rpc?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "rbac2_resources_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "rbac2_modules"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac2_role_parents: {
        Row: {
          created_at: string
          parent_code: string
          role_code: string
        }
        Insert: {
          created_at?: string
          parent_code: string
          role_code: string
        }
        Update: {
          created_at?: string
          parent_code?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac2_role_parents_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "rbac2_roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rbac2_role_parents_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "rbac2_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac2_role_perms: {
        Row: {
          created_at: string
          granted: boolean
          perm_code: string
          role_code: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          perm_code: string
          role_code: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          perm_code?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac2_role_perms_perm_code_fkey"
            columns: ["perm_code"]
            isOneToOne: false
            referencedRelation: "rbac2_permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rbac2_role_perms_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "rbac2_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac2_roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_system: boolean
          label: string
          sort: number
          statut: string
          updated_at: string
          valide_at: string | null
          valide_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_system?: boolean
          label: string
          sort?: number
          statut?: string
          updated_at?: string
          valide_at?: string | null
          valide_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_system?: boolean
          label?: string
          sort?: number
          statut?: string
          updated_at?: string
          valide_at?: string | null
          valide_by?: string | null
        }
        Relationships: []
      }
      rbac2_user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_code: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_code: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac2_user_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "rbac2_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac3_actions: {
        Row: {
          code: string
          created_at: string
          label: string
          ordre: number
        }
        Insert: {
          code: string
          created_at?: string
          label: string
          ordre?: number
        }
        Update: {
          code?: string
          created_at?: string
          label?: string
          ordre?: number
        }
        Relationships: []
      }
      rbac3_audit: {
        Row: {
          acteur_email: string | null
          acteur_id: string | null
          action: string
          ancienne_valeur: Json | null
          cible_id: string | null
          cible_type: string
          created_at: string
          id: string
          nouvelle_valeur: Json | null
          perm_code: string | null
          role_code: string | null
        }
        Insert: {
          acteur_email?: string | null
          acteur_id?: string | null
          action: string
          ancienne_valeur?: Json | null
          cible_id?: string | null
          cible_type: string
          created_at?: string
          id?: string
          nouvelle_valeur?: Json | null
          perm_code?: string | null
          role_code?: string | null
        }
        Update: {
          acteur_email?: string | null
          acteur_id?: string | null
          action?: string
          ancienne_valeur?: Json | null
          cible_id?: string | null
          cible_type?: string
          created_at?: string
          id?: string
          nouvelle_valeur?: Json | null
          perm_code?: string | null
          role_code?: string | null
        }
        Relationships: []
      }
      rbac3_modules: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          groupe: string
          label: string
          ordre: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          groupe?: string
          label: string
          ordre?: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          groupe?: string
          label?: string
          ordre?: number
          updated_at?: string
        }
        Relationships: []
      }
      rbac3_permissions: {
        Row: {
          action_code: string
          code: string
          created_at: string
          label: string
          module_code: string
          sensible: boolean
        }
        Insert: {
          action_code: string
          code: string
          created_at?: string
          label: string
          module_code: string
          sensible?: boolean
        }
        Update: {
          action_code?: string
          code?: string
          created_at?: string
          label?: string
          module_code?: string
          sensible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rbac3_permissions_action_code_fkey"
            columns: ["action_code"]
            isOneToOne: false
            referencedRelation: "rbac3_actions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rbac3_permissions_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "rbac3_modules"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac3_role_permissions: {
        Row: {
          created_at: string
          perm_code: string
          role_code: string
        }
        Insert: {
          created_at?: string
          perm_code: string
          role_code: string
        }
        Update: {
          created_at?: string
          perm_code?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac3_role_permissions_perm_code_fkey"
            columns: ["perm_code"]
            isOneToOne: false
            referencedRelation: "rbac3_permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rbac3_role_permissions_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "rbac3_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      rbac3_roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          label: string
          ordre: number
          portee_globale: boolean
          statut: string
          systeme: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          label: string
          ordre?: number
          portee_globale?: boolean
          statut?: string
          systeme?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          label?: string
          ordre?: number
          portee_globale?: boolean
          statut?: string
          systeme?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      rbac3_user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          role_code: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          role_code: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac3_user_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "rbac3_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      retour_lignes: {
        Row: {
          commentaire_reception: string | null
          created_at: string
          designation: string | null
          etat_produit: string
          etat_reception: string | null
          ligne_id: string
          montant_brut: number
          motif: string | null
          prix_unitaire: number | null
          produit_id: string | null
          quantite: number | null
          quantite_demandee: number | null
          quantite_recue: number | null
          reference_produit: string | null
          remise_montant: number
          remise_pct: number
          retour_id: string
          total_ligne: number | null
          updated_at: string
        }
        Insert: {
          commentaire_reception?: string | null
          created_at?: string
          designation?: string | null
          etat_produit?: string
          etat_reception?: string | null
          ligne_id?: string
          montant_brut?: number
          motif?: string | null
          prix_unitaire?: number | null
          produit_id?: string | null
          quantite?: number | null
          quantite_demandee?: number | null
          quantite_recue?: number | null
          reference_produit?: string | null
          remise_montant?: number
          remise_pct?: number
          retour_id: string
          total_ligne?: number | null
          updated_at?: string
        }
        Update: {
          commentaire_reception?: string | null
          created_at?: string
          designation?: string | null
          etat_produit?: string
          etat_reception?: string | null
          ligne_id?: string
          montant_brut?: number
          motif?: string | null
          prix_unitaire?: number | null
          produit_id?: string | null
          quantite?: number | null
          quantite_demandee?: number | null
          quantite_recue?: number | null
          reference_produit?: string | null
          remise_montant?: number
          remise_pct?: number
          retour_id?: string
          total_ligne?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retour_lignes_retour_id_fkey"
            columns: ["retour_id"]
            isOneToOne: false
            referencedRelation: "bons_retour"
            referencedColumns: ["bon_retour_id"]
          },
          {
            foreignKeyName: "retour_lignes_retour_id_fkey"
            columns: ["retour_id"]
            isOneToOne: false
            referencedRelation: "retours"
            referencedColumns: ["retour_id"]
          },
        ]
      }
      retours: {
        Row: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          commande_id: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_retour: string | null
          depot_id: string | null
          etablissement: string | null
          exercice_id: string | null
          facture_id: string | null
          livraison_id: string | null
          montant: number | null
          motif: string | null
          motif_refus_compta: string | null
          motif_refus_magasin: string | null
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          receptionne_at: string | null
          receptionne_par: string | null
          receptionne_par_nom: string | null
          reference: string | null
          representant_nom: string | null
          retour_id: string
          statut: string | null
          telephone: string | null
          total_quantite: number
          type_retour: string
          updated_at: string
          valide_compta_at: string | null
          valide_compta_par: string | null
          valide_compta_par_nom: string | null
          version_no: number
          ville: string | null
          workflow_approval_id: string | null
        }
        Insert: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_retour?: string | null
          depot_id?: string | null
          etablissement?: string | null
          exercice_id?: string | null
          facture_id?: string | null
          livraison_id?: string | null
          montant?: number | null
          motif?: string | null
          motif_refus_compta?: string | null
          motif_refus_magasin?: string | null
          nb_produits?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          receptionne_at?: string | null
          receptionne_par?: string | null
          receptionne_par_nom?: string | null
          reference?: string | null
          representant_nom?: string | null
          retour_id?: string
          statut?: string | null
          telephone?: string | null
          total_quantite?: number
          type_retour?: string
          updated_at?: string
          valide_compta_at?: string | null
          valide_compta_par?: string | null
          valide_compta_par_nom?: string | null
          version_no?: number
          ville?: string | null
          workflow_approval_id?: string | null
        }
        Update: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nom?: string | null
          date_retour?: string | null
          depot_id?: string | null
          etablissement?: string | null
          exercice_id?: string | null
          facture_id?: string | null
          livraison_id?: string | null
          montant?: number | null
          motif?: string | null
          motif_refus_compta?: string | null
          motif_refus_magasin?: string | null
          nb_produits?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          receptionne_at?: string | null
          receptionne_par?: string | null
          receptionne_par_nom?: string | null
          reference?: string | null
          representant_nom?: string | null
          retour_id?: string
          statut?: string | null
          telephone?: string | null
          total_quantite?: number
          type_retour?: string
          updated_at?: string
          valide_compta_at?: string | null
          valide_compta_par?: string | null
          valide_compta_par_nom?: string | null
          version_no?: number
          ville?: string | null
          workflow_approval_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retours_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
        ]
      }
      rubriques_paie: {
        Row: {
          actif: boolean
          code: string | null
          created_at: string
          formule: string | null
          libelle: string
          rubrique_id: string
          taux: number | null
          type: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code?: string | null
          created_at?: string
          formule?: string | null
          libelle: string
          rubrique_id?: string
          taux?: number | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string | null
          created_at?: string
          formule?: string | null
          libelle?: string
          rubrique_id?: string
          taux?: number | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          city: string | null
          country: string | null
          created_at: string
          criticite: string
          id: string
          ip_address: string | null
          message: string
          metadata: Json | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          city?: string | null
          country?: string | null
          created_at?: string
          criticite?: string
          id?: string
          ip_address?: string | null
          message: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          criticite?: string
          id?: string
          ip_address?: string | null
          message?: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          departement_id: string | null
          libelle: string
          responsable: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          departement_id?: string | null
          libelle: string
          responsable?: string | null
          service_id?: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          departement_id?: string | null
          libelle?: string
          responsable?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_departement_id_fkey"
            columns: ["departement_id"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["departement_id"]
          },
        ]
      }
      signature_keys: {
        Row: {
          algorithm: string
          created_at: string
          is_active: boolean
          key_id: string
          public_key: string
          retired_at: string | null
          secret_name: string
        }
        Insert: {
          algorithm?: string
          created_at?: string
          is_active?: boolean
          key_id?: string
          public_key: string
          retired_at?: string | null
          secret_name: string
        }
        Update: {
          algorithm?: string
          created_at?: string
          is_active?: boolean
          key_id?: string
          public_key?: string
          retired_at?: string | null
          secret_name?: string
        }
        Relationships: []
      }
      soldes_ouverture_clients: {
        Row: {
          client_id: string
          created_at: string
          exercice_id: string
          id: string
          montant: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          exercice_id: string
          id?: string
          montant?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          exercice_id?: string
          id?: string
          montant?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soldes_ouverture_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "soldes_ouverture_clients_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "soldes_ouverture_clients_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices_comptables"
            referencedColumns: ["exercice_id"]
          },
        ]
      }
      soldes_ouverture_fournisseurs: {
        Row: {
          created_at: string
          exercice_id: string
          fournisseur_id: string
          id: string
          montant: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          exercice_id: string
          fournisseur_id: string
          id?: string
          montant?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          exercice_id?: string
          fournisseur_id?: string
          id?: string
          montant?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soldes_ouverture_fournisseurs_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "soldes_ouverture_fournisseurs_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices_comptables"
            referencedColumns: ["exercice_id"]
          },
          {
            foreignKeyName: "soldes_ouverture_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["fournisseur_id"]
          },
        ]
      }
      specimen_lignes: {
        Row: {
          created_at: string
          designation: string
          ligne_id: string
          produit_id: string | null
          quantite: number
          reference_produit: string | null
          specimen_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string
          ligne_id?: string
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          specimen_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string
          ligne_id?: string
          produit_id?: string | null
          quantite?: number
          reference_produit?: string | null
          specimen_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specimen_lignes_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: false
            referencedRelation: "specimens"
            referencedColumns: ["specimen_id"]
          },
        ]
      }
      specimens: {
        Row: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          created_at: string
          created_by: string | null
          date_envoi: string | null
          depot_id: string | null
          designation: string | null
          donneur_nom: string | null
          etablissement: string | null
          exercice_id: string | null
          gestionnaire_id: string | null
          gestionnaire_nom: string | null
          motif: string | null
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          produit_id: string | null
          quantite: number | null
          reference: string | null
          representant_nom: string | null
          specimen_id: string
          statut: string | null
          telephone: string | null
          total_quantite: number
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          created_at?: string
          created_by?: string | null
          date_envoi?: string | null
          depot_id?: string | null
          designation?: string | null
          donneur_nom?: string | null
          etablissement?: string | null
          exercice_id?: string | null
          gestionnaire_id?: string | null
          gestionnaire_nom?: string | null
          motif?: string | null
          nb_produits?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          produit_id?: string | null
          quantite?: number | null
          reference?: string | null
          representant_nom?: string | null
          specimen_id?: string
          statut?: string | null
          telephone?: string | null
          total_quantite?: number
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          client_id?: string | null
          client_nom?: string | null
          created_at?: string
          created_by?: string | null
          date_envoi?: string | null
          depot_id?: string | null
          designation?: string | null
          donneur_nom?: string | null
          etablissement?: string | null
          exercice_id?: string | null
          gestionnaire_id?: string | null
          gestionnaire_nom?: string | null
          motif?: string | null
          nb_produits?: number
          notes?: string | null
          numero?: string | null
          observations?: string | null
          produit_id?: string | null
          quantite?: number | null
          reference?: string | null
          representant_nom?: string | null
          specimen_id?: string
          statut?: string | null
          telephone?: string | null
          total_quantite?: number
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      stock_mouvements: {
        Row: {
          created_at: string
          depot_id: string | null
          document_id: string | null
          document_reference: string | null
          document_table: string | null
          motif: string | null
          mouvement_id: string
          observation: string | null
          origine: string | null
          produit_id: string
          quantite: number
          quantite_entree: number
          quantite_sortie: number
          stock_resultant: number
          type: string
          user_id: string | null
          user_nom: string | null
        }
        Insert: {
          created_at?: string
          depot_id?: string | null
          document_id?: string | null
          document_reference?: string | null
          document_table?: string | null
          motif?: string | null
          mouvement_id?: string
          observation?: string | null
          origine?: string | null
          produit_id: string
          quantite?: number
          quantite_entree?: number
          quantite_sortie?: number
          stock_resultant?: number
          type: string
          user_id?: string | null
          user_nom?: string | null
        }
        Update: {
          created_at?: string
          depot_id?: string | null
          document_id?: string | null
          document_reference?: string | null
          document_table?: string | null
          motif?: string | null
          mouvement_id?: string
          observation?: string | null
          origine?: string | null
          produit_id?: string
          quantite?: number
          quantite_entree?: number
          quantite_sortie?: number
          stock_resultant?: number
          type?: string
          user_id?: string | null
          user_nom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_mouvements_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
        ]
      }
      stocks_depots: {
        Row: {
          depot_id: string
          id: string
          produit_id: string
          quantite: number
          seuil_alerte: number
          updated_at: string
        }
        Insert: {
          depot_id: string
          id?: string
          produit_id: string
          quantite?: number
          seuil_alerte?: number
          updated_at?: string
        }
        Update: {
          depot_id?: string
          id?: string
          produit_id?: string
          quantite?: number
          seuil_alerte?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocks_depots_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
          {
            foreignKeyName: "stocks_depots_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["produit_id"]
          },
          {
            foreignKeyName: "stocks_depots_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "v_produits"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      tournees: {
        Row: {
          chauffeur_nom: string | null
          cout_autres: number | null
          cout_carburant: number | null
          cout_expeditions: number | null
          cout_livraison: number | null
          cout_manutentions: number | null
          cout_peages: number | null
          cout_repas: number | null
          cout_total: number | null
          created_at: string
          date_tournee: string | null
          depot_depart_id: string | null
          distance_km: number | null
          ecriture_id: string | null
          heure_depart: string | null
          livreur_id: string | null
          mode_reglement: string | null
          nb_cartons: number | null
          nb_clients: number | null
          nb_colis: number | null
          nb_livraisons: number | null
          notes: string | null
          reference: string | null
          responsable_nom: string | null
          statut: string | null
          tournee_id: string
          type_tournee: string | null
          updated_at: string
          validation_at: string | null
          validation_by: string | null
          validation_commentaire: string | null
          validation_statut: string | null
          vehicule_id: string | null
        }
        Insert: {
          chauffeur_nom?: string | null
          cout_autres?: number | null
          cout_carburant?: number | null
          cout_expeditions?: number | null
          cout_livraison?: number | null
          cout_manutentions?: number | null
          cout_peages?: number | null
          cout_repas?: number | null
          cout_total?: number | null
          created_at?: string
          date_tournee?: string | null
          depot_depart_id?: string | null
          distance_km?: number | null
          ecriture_id?: string | null
          heure_depart?: string | null
          livreur_id?: string | null
          mode_reglement?: string | null
          nb_cartons?: number | null
          nb_clients?: number | null
          nb_colis?: number | null
          nb_livraisons?: number | null
          notes?: string | null
          reference?: string | null
          responsable_nom?: string | null
          statut?: string | null
          tournee_id?: string
          type_tournee?: string | null
          updated_at?: string
          validation_at?: string | null
          validation_by?: string | null
          validation_commentaire?: string | null
          validation_statut?: string | null
          vehicule_id?: string | null
        }
        Update: {
          chauffeur_nom?: string | null
          cout_autres?: number | null
          cout_carburant?: number | null
          cout_expeditions?: number | null
          cout_livraison?: number | null
          cout_manutentions?: number | null
          cout_peages?: number | null
          cout_repas?: number | null
          cout_total?: number | null
          created_at?: string
          date_tournee?: string | null
          depot_depart_id?: string | null
          distance_km?: number | null
          ecriture_id?: string | null
          heure_depart?: string | null
          livreur_id?: string | null
          mode_reglement?: string | null
          nb_cartons?: number | null
          nb_clients?: number | null
          nb_colis?: number | null
          nb_livraisons?: number | null
          notes?: string | null
          reference?: string | null
          responsable_nom?: string | null
          statut?: string | null
          tournee_id?: string
          type_tournee?: string | null
          updated_at?: string
          validation_at?: string | null
          validation_by?: string | null
          validation_commentaire?: string | null
          validation_statut?: string | null
          vehicule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournees_depot_depart_id_fkey"
            columns: ["depot_depart_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
          {
            foreignKeyName: "tournees_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules"
            referencedColumns: ["vehicule_id"]
          },
        ]
      }
      transactions: {
        Row: {
          categorie: string
          commande_id: string | null
          created_at: string
          created_by: string | null
          date_transaction: string
          exercice_id: string | null
          libelle: string
          mode_paiement: string
          montant: number
          notes: string | null
          reference: string
          statut: string
          transaction_id: string
          type: string
          updated_at: string
        }
        Insert: {
          categorie?: string
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          date_transaction?: string
          exercice_id?: string | null
          libelle: string
          mode_paiement?: string
          montant?: number
          notes?: string | null
          reference?: string
          statut?: string
          transaction_id?: string
          type?: string
          updated_at?: string
        }
        Update: {
          categorie?: string
          commande_id?: string | null
          created_at?: string
          created_by?: string | null
          date_transaction?: string
          exercice_id?: string | null
          libelle?: string
          mode_paiement?: string
          montant?: number
          notes?: string | null
          reference?: string
          statut?: string
          transaction_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["commande_id"]
          },
        ]
      }
      transfert_lignes: {
        Row: {
          created_at: string
          designation: string | null
          ligne_id: string
          produit_id: string | null
          quantite: number | null
          quantite_recue: number
          transfert_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          ligne_id?: string
          produit_id?: string | null
          quantite?: number | null
          quantite_recue?: number
          transfert_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          ligne_id?: string
          produit_id?: string | null
          quantite?: number | null
          quantite_recue?: number
          transfert_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfert_lignes_transfert_id_fkey"
            columns: ["transfert_id"]
            isOneToOne: false
            referencedRelation: "transferts"
            referencedColumns: ["transfert_id"]
          },
        ]
      }
      transferts: {
        Row: {
          created_at: string
          created_by: string | null
          date_creation: string | null
          date_expedition: string | null
          date_reception: string | null
          date_transfert: string | null
          depot_destination_id: string | null
          depot_source_id: string | null
          motif: string | null
          notes: string | null
          numero: string | null
          reference: string | null
          statut: string | null
          transfert_id: string
          transporteur: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_creation?: string | null
          date_expedition?: string | null
          date_reception?: string | null
          date_transfert?: string | null
          depot_destination_id?: string | null
          depot_source_id?: string | null
          motif?: string | null
          notes?: string | null
          numero?: string | null
          reference?: string | null
          statut?: string | null
          transfert_id?: string
          transporteur?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_creation?: string | null
          date_expedition?: string | null
          date_reception?: string | null
          date_transfert?: string | null
          depot_destination_id?: string | null
          depot_source_id?: string | null
          motif?: string | null
          notes?: string | null
          numero?: string | null
          reference?: string | null
          statut?: string | null
          transfert_id?: string
          transporteur?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferts_depot_destination_id_fkey"
            columns: ["depot_destination_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
          {
            foreignKeyName: "transferts_depot_source_id_fkey"
            columns: ["depot_source_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
        ]
      }
      transporteurs: {
        Row: {
          actif: boolean
          contact: string | null
          created_at: string
          nom: string
          telephone: string | null
          transporteur_id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          contact?: string | null
          created_at?: string
          nom: string
          telephone?: string | null
          transporteur_id?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          contact?: string | null
          created_at?: string
          nom?: string
          telephone?: string | null
          transporteur_id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_action_stats: {
        Row: {
          action_key: string
          created_at: string
          hidden: boolean
          href: string | null
          icon: string | null
          id: string
          label: string | null
          last_used_at: string | null
          module: string | null
          pinned: boolean
          sort_order: number
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          action_key: string
          created_at?: string
          hidden?: boolean
          href?: string | null
          icon?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          module?: string | null
          pinned?: boolean
          sort_order?: number
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          action_key?: string
          created_at?: string
          hidden?: boolean
          href?: string | null
          icon?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          module?: string | null
          pinned?: boolean
          sort_order?: number
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_depots: {
        Row: {
          created_at: string
          depot_id: string
          principal: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          depot_id: string
          principal?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          depot_id?: string
          principal?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_depots_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicules: {
        Row: {
          actif: boolean
          capacite: number | null
          created_at: string
          date_expiration_assurance: string | null
          date_expiration_visite_technique: string | null
          date_prochain_entretien: string | null
          immatriculation: string | null
          marque: string | null
          modele: string | null
          statut: string
          type: string | null
          updated_at: string
          vehicule_id: string
        }
        Insert: {
          actif?: boolean
          capacite?: number | null
          created_at?: string
          date_expiration_assurance?: string | null
          date_expiration_visite_technique?: string | null
          date_prochain_entretien?: string | null
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          statut?: string
          type?: string | null
          updated_at?: string
          vehicule_id?: string
        }
        Update: {
          actif?: boolean
          capacite?: number | null
          created_at?: string
          date_expiration_assurance?: string | null
          date_expiration_visite_technique?: string | null
          date_prochain_entretien?: string | null
          immatriculation?: string | null
          marque?: string | null
          modele?: string | null
          statut?: string
          type?: string | null
          updated_at?: string
          vehicule_id?: string
        }
        Relationships: []
      }
      workflow_approvals: {
        Row: {
          approbateur_id: string | null
          approbateur_nom: string | null
          commentaire: string | null
          created_at: string
          decided_at: string | null
          decision_details: Json | null
          demandeur_id: string | null
          demandeur_nom: string | null
          entity_id: string | null
          entity_type: string
          historique: Json
          id: string
          metadata: Json
          module: string | null
          motif_refus: string | null
          niveau_urgence: string
          pieces_jointes: Json
          reference: string | null
          simulation_financiere: Json | null
          sla_deadline: string | null
          statut: string
          updated_at: string
          version_no: number
          workflow_code: string
        }
        Insert: {
          approbateur_id?: string | null
          approbateur_nom?: string | null
          commentaire?: string | null
          created_at?: string
          decided_at?: string | null
          decision_details?: Json | null
          demandeur_id?: string | null
          demandeur_nom?: string | null
          entity_id?: string | null
          entity_type: string
          historique?: Json
          id?: string
          metadata?: Json
          module?: string | null
          motif_refus?: string | null
          niveau_urgence?: string
          pieces_jointes?: Json
          reference?: string | null
          simulation_financiere?: Json | null
          sla_deadline?: string | null
          statut?: string
          updated_at?: string
          version_no?: number
          workflow_code: string
        }
        Update: {
          approbateur_id?: string | null
          approbateur_nom?: string | null
          commentaire?: string | null
          created_at?: string
          decided_at?: string | null
          decision_details?: Json | null
          demandeur_id?: string | null
          demandeur_nom?: string | null
          entity_id?: string | null
          entity_type?: string
          historique?: Json
          id?: string
          metadata?: Json
          module?: string | null
          motif_refus?: string | null
          niveau_urgence?: string
          pieces_jointes?: Json
          reference?: string | null
          simulation_financiere?: Json | null
          sla_deadline?: string | null
          statut?: string
          updated_at?: string
          version_no?: number
          workflow_code?: string
        }
        Relationships: []
      }
      workflows_definitions: {
        Row: {
          actif: boolean
          code: string
          config: Json
          created_at: string
          description: string | null
          id: string
          libelle: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          libelle: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          libelle?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      audit_events: {
        Row: {
          action: string | null
          browser: string | null
          browser_version: string | null
          changes: Json | null
          city: string | null
          correlation_id: string | null
          country: string | null
          country_code: string | null
          criticite: string | null
          details: Json | null
          device: string | null
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          http_method: string | null
          id: string | null
          ip_address: string | null
          module: string | null
          new_values: Json | null
          occurred_at: string | null
          old_values: Json | null
          os: string | null
          record_id: string | null
          record_ref: string | null
          screen_resolution: string | null
          session_id: string | null
          status: string | null
          status_code: number | null
          table_name: string | null
          timezone: string | null
          url: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          browser?: string | null
          browser_version?: string | null
          changes?: never
          city?: string | null
          correlation_id?: string | null
          country?: string | null
          country_code?: string | null
          criticite?: string | null
          details?: Json | null
          device?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          http_method?: string | null
          id?: string | null
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          occurred_at?: string | null
          old_values?: Json | null
          os?: string | null
          record_id?: string | null
          record_ref?: never
          screen_resolution?: string | null
          session_id?: string | null
          status?: string | null
          status_code?: number | null
          table_name?: string | null
          timezone?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          browser?: string | null
          browser_version?: string | null
          changes?: never
          city?: string | null
          correlation_id?: string | null
          country?: string | null
          country_code?: string | null
          criticite?: string | null
          details?: Json | null
          device?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          http_method?: string | null
          id?: string | null
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          occurred_at?: string | null
          old_values?: Json | null
          os?: string | null
          record_id?: string | null
          record_ref?: never
          screen_resolution?: string | null
          session_id?: string | null
          status?: string | null
          status_code?: number | null
          table_name?: string | null
          timezone?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bons_retour: {
        Row: {
          bon_retour_id: string | null
          client_id: string | null
          client_nom: string | null
          created_at: string | null
          date_retour: string | null
          exercice_id: string | null
          montant: number | null
          motif: string | null
          nb_produits: number | null
          notes: string | null
          numero: string | null
          reference: string | null
          statut: string | null
          total_quantite: number | null
          updated_at: string | null
        }
        Insert: {
          bon_retour_id?: string | null
          client_id?: string | null
          client_nom?: string | null
          created_at?: string | null
          date_retour?: string | null
          exercice_id?: string | null
          montant?: number | null
          motif?: string | null
          nb_produits?: number | null
          notes?: string | null
          numero?: string | null
          reference?: string | null
          statut?: string | null
          total_quantite?: number | null
          updated_at?: string | null
        }
        Update: {
          bon_retour_id?: string | null
          client_id?: string | null
          client_nom?: string | null
          created_at?: string | null
          date_retour?: string | null
          exercice_id?: string | null
          montant?: number | null
          motif?: string | null
          nb_produits?: number | null
          notes?: string | null
          numero?: string | null
          reference?: string | null
          statut?: string | null
          total_quantite?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      exercices: {
        Row: {
          cloture_le: string | null
          code: string | null
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          exercice_id: string | null
          is_actif: boolean | null
          libelle: string | null
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          cloture_le?: string | null
          code?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          exercice_id?: string | null
          is_actif?: boolean | null
          libelle?: string | null
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          cloture_le?: string | null
          code?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          exercice_id?: string | null
          is_actif?: boolean | null
          libelle?: string | null
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      paie_parametres: {
        Row: {
          cle: string | null
          created_at: string | null
          description: string | null
          parametre_id: string | null
          updated_at: string | null
          valeur: string | null
        }
        Insert: {
          cle?: string | null
          created_at?: string | null
          description?: string | null
          parametre_id?: string | null
          updated_at?: string | null
          valeur?: string | null
        }
        Update: {
          cle?: string | null
          created_at?: string | null
          description?: string | null
          parametre_id?: string | null
          updated_at?: string | null
          valeur?: string | null
        }
        Relationships: []
      }
      paie_rubriques: {
        Row: {
          actif: boolean | null
          code: string | null
          created_at: string | null
          formule: string | null
          libelle: string | null
          rubrique_id: string | null
          taux: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          code?: string | null
          created_at?: string | null
          formule?: string | null
          libelle?: string | null
          rubrique_id?: string | null
          taux?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          code?: string | null
          created_at?: string | null
          formule?: string | null
          libelle?: string | null
          rubrique_id?: string | null
          taux?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      parametres: {
        Row: {
          categorie: string | null
          cle: string | null
          created_at: string | null
          description: string | null
          parametre_id: string | null
          updated_at: string | null
          valeur: string | null
        }
        Insert: {
          categorie?: string | null
          cle?: string | null
          created_at?: string | null
          description?: string | null
          parametre_id?: string | null
          updated_at?: string | null
          valeur?: string | null
        }
        Update: {
          categorie?: string | null
          cle?: string | null
          created_at?: string | null
          description?: string | null
          parametre_id?: string | null
          updated_at?: string | null
          valeur?: string | null
        }
        Relationships: []
      }
      rbac3_user_permissions: {
        Row: {
          permission_code: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rbac3_role_permissions_perm_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "rbac3_permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      v_approbations_en_attente_count: {
        Row: {
          critiques: number | null
          sla_depasses: number | null
          total: number | null
        }
        Relationships: []
      }
      v_colisage_responsables: {
        Row: {
          actif: boolean | null
          date_affectation: string | null
          depot_id: string | null
          depot_nom: string | null
          employe_id: string | null
          matricule: string | null
          nom_complet: string | null
          poste: string | null
          responsable_id: string | null
          telephone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colisage_responsables_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["depot_id"]
          },
          {
            foreignKeyName: "colisage_responsables_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: true
            referencedRelation: "employes"
            referencedColumns: ["employe_id"]
          },
        ]
      }
      v_produits: {
        Row: {
          actif: boolean | null
          auteur: string | null
          categorie: string | null
          categorie_id: string | null
          cover_path: string | null
          cover_thumb_path: string | null
          cover_updated_at: string | null
          created_at: string | null
          editeur: string | null
          isbn: string | null
          matiere: string | null
          niveau: string | null
          niveau_ordre: number | null
          pin_order: number | null
          prix_achat: number | null
          prix_vente: number | null
          produit_id: string | null
          reference: string | null
          seuil_alerte: number | null
          stock: number | null
          titre: string | null
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          auteur?: string | null
          categorie?: string | null
          categorie_id?: string | null
          cover_path?: string | null
          cover_thumb_path?: string | null
          cover_updated_at?: string | null
          created_at?: string | null
          editeur?: string | null
          isbn?: string | null
          matiere?: string | null
          niveau?: string | null
          niveau_ordre?: number | null
          pin_order?: number | null
          prix_achat?: number | null
          prix_vente?: number | null
          produit_id?: string | null
          reference?: string | null
          seuil_alerte?: number | null
          stock?: never
          titre?: string | null
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          auteur?: string | null
          categorie?: string | null
          categorie_id?: string | null
          cover_path?: string | null
          cover_thumb_path?: string | null
          cover_updated_at?: string | null
          created_at?: string | null
          editeur?: string | null
          isbn?: string | null
          matiere?: string | null
          niveau?: string | null
          niveau_ordre?: number | null
          pin_order?: number | null
          prix_achat?: number | null
          prix_vente?: number | null
          produit_id?: string | null
          reference?: string | null
          seuil_alerte?: number | null
          stock?: never
          titre?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_rpc_errors_recent: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error: string | null
          id: string | null
          metadata: Json | null
          query_key: string | null
          route: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string | null
          metadata?: Json | null
          query_key?: string | null
          route?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string | null
          metadata?: Json | null
          query_key?: string | null
          route?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _calc_urgence_sla: {
        Args: { p_module: string; p_montant: number; p_type_operation?: string }
        Returns: {
          deadline: string
          urgence: string
        }[]
      }
      _compte_mode_paiement: {
        Args: { _mode: string }
        Returns: {
          compte: string
          journal: string
        }[]
      }
      _current_user_display_name: { Args: never; Returns: string }
      _delete_ecriture_piece: { Args: { _piece: string }; Returns: undefined }
      _journal_id: { Args: { _code: string }; Returns: string }
      _next_ref: {
        Args: { _col: string; _prefix: string; _table: unknown }
        Returns: string
      }
      _notifier_role: {
        Args: {
          _document_id: string
          _document_reference: string
          _document_type: string
          _lien: string
          _message: string
          _module: string
          _role_code: string
          _titre: string
        }
        Returns: undefined
      }
      _recalc_solde_client_internal: {
        Args: { _client_id: string }
        Returns: number
      }
      _resolve_exercice_id: { Args: { _d: string }; Returns: string }
      _retour_audit: {
        Args: { _action: string; _details?: Json; _retour_id: string }
        Returns: undefined
      }
      _retour_recalc_totaux: {
        Args: { p_retour_id: string }
        Returns: undefined
      }
      affecter_colis_tournee: {
        Args: { _colis_ids: string[]; _tournee_id: string }
        Returns: Json
      }
      ajuster_stock_depot: {
        Args: {
          _depot_id: string
          _motif?: string
          _nouvelle_quantite: number
          _produit_id: string
        }
        Returns: undefined
      }
      ajuster_stock_depot_v3: {
        Args: {
          _depot_id: string
          _motif?: string
          _nouvelle_quantite: number
          _produit_id: string
        }
        Returns: undefined
      }
      annuler_colisage: {
        Args: { _bl_id: string; _motif: string }
        Returns: undefined
      }
      annuler_commande: {
        Args: { _commande_id: string; _motif?: string }
        Returns: undefined
      }
      annuler_incident: { Args: { _incident_id: string }; Returns: undefined }
      annuler_inventaire: {
        Args: { _inventaire_id: string }
        Returns: undefined
      }
      annuler_paiement: {
        Args: { _notes?: string; _paiement_id: string; _raison: string }
        Returns: {
          banque: string | null
          client_nom: string | null
          commentaire_validation: string | null
          created_at: string
          cree_par: string | null
          date_paiement: string
          exercice_id: string | null
          facture_id: string | null
          idempotency_key: string | null
          mode_paiement: string
          montant: number
          motif_rejet: string | null
          notes: string | null
          num_transaction: string | null
          observations: string | null
          paiement_id: string
          reference: string
          reference_paiement: string | null
          rejete_le: string | null
          rejete_par: string | null
          statut: string
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "paiements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      annuler_retour: {
        Args: { _motif?: string; _retour_id: string }
        Returns: undefined
      }
      annuler_specimen: {
        Args: { _motif?: string; _specimen_id: string }
        Returns: undefined
      }
      annuler_transfert: { Args: { _transfert_id: string }; Returns: undefined }
      annuler_validation_tournee: {
        Args: { _motif?: string; _tournee_id: string }
        Returns: undefined
      }
      approbation_creer: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_module: string
          p_montant?: number
          p_motif?: string
          p_reference: string
          p_sla_heures?: number
          p_urgence?: string
          p_workflow_code: string
        }
        Returns: string
      }
      approbation_decider: {
        Args: {
          p_approbation_id: string
          p_commentaire?: string
          p_decision: string
        }
        Returns: Json
      }
      approbation_decider_lot: {
        Args: { p_commentaire?: string; p_decision: string; p_ids: string[] }
        Returns: Json
      }
      approbation_deleguer: {
        Args: {
          p_approbation_id: string
          p_commentaire?: string
          p_delegataire_id: string
          p_expire_at?: string
        }
        Returns: undefined
      }
      approbation_escalader_sla: { Args: never; Returns: Json }
      approbation_rouvrir: {
        Args: { _approval_id: string; _motif: string }
        Returns: undefined
      }
      assert_permission: { Args: { _perm: string }; Returns: undefined }
      audit_compta_factures_paiements: {
        Args: never
        Returns: {
          detail: string
          facture_id: string
          montant: number
          reference: string
          type: string
        }[]
      }
      audit_compta_soldes_clients: {
        Args: never
        Returns: {
          client_id: string
          ecart: number
          nom: string
          solde_calcule: number
          solde_stocke: number
        }[]
      }
      audit_events_by_module: {
        Args: { p_days?: number }
        Returns: {
          module: string
          total: number
        }[]
      }
      audit_events_daily: {
        Args: { p_days?: number }
        Returns: {
          day: string
          error: number
          info: number
          total: number
          warning: number
        }[]
      }
      audit_events_list: {
        Args: {
          p_action?: string
          p_module?: string
          p_page?: number
          p_page_size?: number
          p_period_days?: number
          p_search?: string
          p_user_email?: string
        }
        Returns: {
          action: string
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: string
          module: string
          user_id: string
        }[]
      }
      audit_events_stats: {
        Args: {
          p_action?: string
          p_module?: string
          p_period_days?: number
          p_search?: string
          p_user_email?: string
        }
        Returns: Json
      }
      audit_finances_anomalies: {
        Args: never
        Returns: {
          detail: string
          montant: number
          type: string
        }[]
      }
      audit_stats_v2: { Args: never; Returns: Json }
      audit_stock_anomalies: {
        Args: never
        Returns: {
          depot_id: string
          detail: string
          produit_id: string
          quantite: number
          type: string
        }[]
      }
      audit_stock_resume: { Args: never; Returns: Json }
      can_access_depot: {
        Args: { _depot_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_service: {
        Args: { _service_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_module: { Args: { _modules: string[] }; Returns: boolean }
      client_historique: {
        Args: { _client_id: string }
        Returns: {
          categorie: string
          commande_id: string
          commande_reference: string
          commande_statut: string
          date_commande: string
          niveau: string
          prix_unitaire: number
          produit_id: string
          produit_titre: string
          quantite: number
          reference_produit: string
          remise_pct: number
          total_ligne: number
        }[]
      }
      clients_facets: { Args: never; Returns: Json }
      cloturer_tournee: { Args: { _tournee_id: string }; Returns: undefined }
      commande_demander_annulation: {
        Args: { p_commande_id: string; p_motif: string }
        Returns: string
      }
      compta_balance: {
        Args: { p_exercice_id?: string; p_from?: string; p_to?: string }
        Returns: {
          credit: number
          debit: number
          libelle: string
          numero_compte: string
          solde: number
        }[]
      }
      confirmer_achat: { Args: { _achat_id: string }; Returns: undefined }
      convertir_commande_en_bl: {
        Args: {
          _adresse_livraison?: string
          _commande_id: string
          _date_livraison?: string
          _decrementer_stock?: boolean
          _nb_colis: number
          _poids_total?: number
          _signataire?: string
          _transporteur?: string
        }
        Returns: {
          bl_id: string
          reference: string
        }[]
      }
      convertir_proforma_en_commande: {
        Args: { _proforma_id: string }
        Returns: string
      }
      creer_colisage: {
        Args: { _bl_id: string; _payload: Json }
        Returns: {
          bl_id: string
          colis_id: string
          commande_id: string | null
          commune: string | null
          contenu: string | null
          created_at: string
          date_colisage: string | null
          date_envoi: string | null
          destinataire: string | null
          gare_depart: string | null
          gare_responsable: string | null
          gare_telephone: string | null
          livreur_nom: string | null
          livreur_telephone: string | null
          mode_acheminement: string | null
          nb_cartons: number | null
          numero_carton: number | null
          observations: string | null
          poids: number | null
          quartier: string | null
          reference: string | null
          responsable_id: string | null
          responsable_nom: string | null
          statut: string
          tournee_id: string | null
          transporteur: string | null
          updated_at: string
          vehicule: string | null
          ville_destination: string | null
          ville_livraison: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "colis"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_colisage_manuel: {
        Args: { _bl_id: string; _cartons: Json; _payload: Json }
        Returns: {
          bl_id: string
          colis_id: string
          commande_id: string | null
          commune: string | null
          contenu: string | null
          created_at: string
          date_colisage: string | null
          date_envoi: string | null
          destinataire: string | null
          gare_depart: string | null
          gare_responsable: string | null
          gare_telephone: string | null
          livreur_nom: string | null
          livreur_telephone: string | null
          mode_acheminement: string | null
          nb_cartons: number | null
          numero_carton: number | null
          observations: string | null
          poids: number | null
          quartier: string | null
          reference: string | null
          responsable_id: string | null
          responsable_nom: string | null
          statut: string
          tournee_id: string | null
          transporteur: string | null
          updated_at: string
          vehicule: string | null
          ville_destination: string | null
          ville_livraison: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "colis"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_commande: {
        Args: { _payload: Json }
        Returns: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          commande_id: string
          commentaire_validation: string | null
          commercial_id: string | null
          commercial_nom: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_commande: string
          depot_id: string | null
          etablissement: string | null
          exercice_id: string | null
          idempotency_key: string | null
          montant_total: number
          montant_ttc: number
          montant_tva: number
          motif_rejet: string | null
          nb_produits: number
          net_a_payer: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          rejete_le: string | null
          rejete_par: string | null
          remise: number
          remise_globale_montant: number
          remise_globale_pct: number
          representant_nom: string | null
          statut: string
          taux_tva: number
          telephone: string | null
          total_ht_brut: number
          total_ht_net: number
          total_quantite: number
          total_remises_lignes: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          ville: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "commandes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_incident_stock: {
        Args: { _payload: Json }
        Returns: {
          created_at: string
          created_by: string | null
          date_incident: string | null
          depot_id: string | null
          description: string | null
          exercice_id: string | null
          gravite: string | null
          incident_id: string
          motif: string | null
          nb_produits: number
          numero: string | null
          observations: string | null
          produit_id: string | null
          reference: string | null
          responsable_id: string | null
          responsable_nom: string | null
          statut: string | null
          total_quantite: number
          type_incident: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "incidents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_inventaire_global: {
        Args: { _payload: Json }
        Returns: {
          categorie_id: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_inventaire: string | null
          depot_id: string | null
          ecart_total: number | null
          exercice_id: string | null
          inventaire_id: string
          nb_ecarts: number
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          regularized_at: string | null
          statut: string | null
          type_inventaire: string
          updated_at: string
          valeur_totale: number
          validated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inventaires"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_inventaire_physique: {
        Args: { _payload: Json }
        Returns: {
          categorie_id: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_inventaire: string | null
          depot_id: string | null
          ecart_total: number | null
          exercice_id: string | null
          inventaire_id: string
          nb_ecarts: number
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          regularized_at: string | null
          statut: string | null
          type_inventaire: string
          updated_at: string
          valeur_totale: number
          validated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inventaires"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_inventaire_theorique: {
        Args: { _payload: Json }
        Returns: {
          categorie_id: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_inventaire: string | null
          depot_id: string | null
          ecart_total: number | null
          exercice_id: string | null
          inventaire_id: string
          nb_ecarts: number
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          regularized_at: string | null
          statut: string | null
          type_inventaire: string
          updated_at: string
          valeur_totale: number
          validated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inventaires"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_retour: {
        Args: { _payload: Json }
        Returns: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          commande_id: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_retour: string | null
          depot_id: string | null
          etablissement: string | null
          exercice_id: string | null
          facture_id: string | null
          livraison_id: string | null
          montant: number | null
          motif: string | null
          motif_refus_compta: string | null
          motif_refus_magasin: string | null
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          receptionne_at: string | null
          receptionne_par: string | null
          receptionne_par_nom: string | null
          reference: string | null
          representant_nom: string | null
          retour_id: string
          statut: string | null
          telephone: string | null
          total_quantite: number
          type_retour: string
          updated_at: string
          valide_compta_at: string | null
          valide_compta_par: string | null
          valide_compta_par_nom: string | null
          version_no: number
          ville: string | null
          workflow_approval_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "retours"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      creer_specimen: {
        Args: { _payload: Json }
        Returns: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          created_at: string
          created_by: string | null
          date_envoi: string | null
          depot_id: string | null
          designation: string | null
          donneur_nom: string | null
          etablissement: string | null
          exercice_id: string | null
          gestionnaire_id: string | null
          gestionnaire_nom: string | null
          motif: string | null
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          produit_id: string | null
          quantite: number | null
          reference: string | null
          representant_nom: string | null
          specimen_id: string
          statut: string | null
          telephone: string | null
          total_quantite: number
          updated_at: string
          ville: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "specimens"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      crm_dashboard: { Args: { _from?: string; _to?: string }; Returns: Json }
      dashboard_client_stats: {
        Args: never
        Returns: {
          actifs: number
          solde_total: number
          total: number
        }[]
      }
      dashboard_overview_full: {
        Args: { _exercice_id: string; _periode_jours?: number }
        Returns: Json
      }
      dashboard_widgets_all: { Args: never; Returns: Json }
      definir_depot_principal: {
        Args: { _depot_id: string }
        Returns: undefined
      }
      depot_in_scope: { Args: { _depot_id: string }; Returns: boolean }
      deverrouiller_colisage: {
        Args: { _bl_id: string; _motif: string }
        Returns: undefined
      }
      enregistrer_approvisionnement: {
        Args: { _payload: Json }
        Returns: {
          achat_id: string
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_achat: string
          depot_id: string | null
          exercice_id: string | null
          fournisseur_id: string | null
          fournisseur_nom: string | null
          idempotency_key: string | null
          libelle: string
          montant: number
          notes: string | null
          reference: string
          reference_fournisseur: string | null
          statut: string
          total_quantite: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "achats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enregistrer_paiement: {
        Args: { _payload: Json }
        Returns: {
          banque: string | null
          client_nom: string | null
          commentaire_validation: string | null
          created_at: string
          cree_par: string | null
          date_paiement: string
          exercice_id: string | null
          facture_id: string | null
          idempotency_key: string | null
          mode_paiement: string
          montant: number
          motif_rejet: string | null
          notes: string | null
          num_transaction: string | null
          observations: string | null
          paiement_id: string
          reference: string
          reference_paiement: string | null
          rejete_le: string | null
          rejete_par: string | null
          statut: string
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "paiements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      executer_cloture_exercice: {
        Args: { _activer_suivant?: boolean; _exercice_id: string }
        Returns: Json
      }
      executer_transfert: {
        Args: { _transfert_id: string }
        Returns: undefined
      }
      exercice_actif_id: { Args: never; Returns: string }
      exercices_comparatif: {
        Args: { _exercice_ids: string[] }
        Returns: {
          achats: number
          ca: number
          encaisse: number
          exercice_id: string
          libelle: string
          montant_paye: number
          nb_commandes: number
          nb_factures: number
        }[]
      }
      export_config_snapshot: { Args: never; Returns: Json }
      factures_impayees_client: {
        Args: { _client_id: string }
        Returns: {
          date_facture: string
          facture_id: string
          montant_paye: number
          montant_total: number
          reference: string
          solde: number
          statut: string
        }[]
      }
      factures_list_paginated: {
        Args: {
          _date_au?: string
          _date_du?: string
          _exercice_id?: string
          _page?: number
          _page_size?: number
          _q?: string
          _statut?: string
        }
        Returns: {
          items: Json
          total: number
        }[]
      }
      finaliser_tournee: { Args: { _tournee_id: string }; Returns: Json }
      finaliser_tournee_interne: {
        Args: { _tournee_id: string }
        Returns: Json
      }
      generate_client_reference: { Args: never; Returns: string }
      generate_ecriture_achat: { Args: { _achat_id: string }; Returns: string }
      generate_ecriture_facture: {
        Args: { _facture_id: string }
        Returns: string
      }
      generate_ecriture_paiement: {
        Args: { _paiement_id: string }
        Returns: string
      }
      generate_ecriture_retour: {
        Args: { _retour_id: string }
        Returns: string
      }
      generer_proforma_commande: {
        Args: { _commande_id: string }
        Returns: Json
      }
      get_carton_public: { Args: { _colis_id: string }; Returns: Json }
      get_derniers_prix_achat: {
        Args: { _produit_ids: string[] }
        Returns: {
          achat_id: string
          date_achat: string
          prix_unitaire: number
          produit_id: string
          reference: string
        }[]
      }
      get_lignes_retournables: {
        Args: { _facture_id: string }
        Returns: {
          designation: string
          prix_unitaire: number
          produit_id: string
          qte_deja_retournee: number
          qte_disponible: number
          qte_vendue: number
          reference_produit: string
          remise_pct: number
          total_ligne: number
        }[]
      }
      get_next_backup_run: { Args: never; Returns: string }
      get_slo_metrics: { Args: never; Returns: Json }
      global_search: { Args: { _q: string }; Returns: Json }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_code: string; _user_id: string }
        Returns: boolean
      }
      has_permission_v2: {
        Args: { _perm_code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_compat: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      inventaire_demander_validation: {
        Args: { _inventaire_id: string }
        Returns: string
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_finance: { Args: { _uid: string }; Returns: boolean }
      is_global_scope: { Args: { _user_id: string }; Returns: boolean }
      is_hr: { Args: { _uid: string }; Returns: boolean }
      is_sales: { Args: { _uid: string }; Returns: boolean }
      is_stock: { Args: { _uid: string }; Returns: boolean }
      list_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          permission_code: string
        }[]
      }
      list_user_permissions_v2: {
        Args: { _user_id: string }
        Returns: {
          permission_code: string
        }[]
      }
      livsuivi_avancer: {
        Args: {
          _commentaire?: string
          _etape: string
          _livraison_id: string
          _meta?: Json
        }
        Returns: {
          cloturee: boolean
          commande_id: string
          commentaire_reception: string | null
          created_at: string
          derniere_maj: string
          gare_depot: string | null
          gare_destination: string | null
          heure_arrivee: string | null
          heure_depart: string | null
          heure_livraison: string | null
          id: string
          livreur_nom: string | null
          nb_cartons: number | null
          ordre_passage: number | null
          photo_preuve_url: string | null
          point_livraison: string | null
          receptionnaire_nom: string | null
          receptionnaire_telephone: string | null
          retour_motif: string | null
          signature_url: string | null
          statut: string
          tournee_id: string | null
          type_livraison: string
          updated_at: string
          vehicule: string | null
          ville_destination: string | null
        }
        SetofOptions: {
          from: "*"
          to: "livsuivi_commandes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      livsuivi_avancer_masse: {
        Args: {
          _etape: string
          _filtre_gare?: string
          _meta?: Json
          _tournee_id: string
        }
        Returns: number
      }
      livsuivi_confirmer_reception: {
        Args: {
          _commentaire?: string
          _id: string
          _photo_url?: string
          _receptionnaire_nom?: string
          _receptionnaire_tel?: string
          _signature_url?: string
        }
        Returns: {
          cloturee: boolean
          commande_id: string
          commentaire_reception: string | null
          created_at: string
          derniere_maj: string
          gare_depot: string | null
          gare_destination: string | null
          heure_arrivee: string | null
          heure_depart: string | null
          heure_livraison: string | null
          id: string
          livreur_nom: string | null
          nb_cartons: number | null
          ordre_passage: number | null
          photo_preuve_url: string | null
          point_livraison: string | null
          receptionnaire_nom: string | null
          receptionnaire_telephone: string | null
          retour_motif: string | null
          signature_url: string | null
          statut: string
          tournee_id: string | null
          type_livraison: string
          updated_at: string
          vehicule: string | null
          ville_destination: string | null
        }
        SetofOptions: {
          from: "*"
          to: "livsuivi_commandes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_browser?: string
          p_browser_version?: string
          p_city?: string
          p_correlation_id?: string
          p_country?: string
          p_country_code?: string
          p_criticite?: string
          p_device?: string
          p_duration_ms?: number
          p_error_message?: string
          p_http_method?: string
          p_ip?: string
          p_metadata?: Json
          p_module?: string
          p_new_values?: Json
          p_old_values?: Json
          p_os?: string
          p_record_id?: string
          p_record_ref?: string
          p_screen_resolution?: string
          p_session_id?: string
          p_status?: string
          p_status_code?: number
          p_table_name?: string
          p_timezone?: string
          p_url?: string
          p_user_agent?: string
          p_user_email?: string
        }
        Returns: string
      }
      log_permission_denied: {
        Args: { _context?: Json; _perm: string }
        Returns: undefined
      }
      log_user_login: {
        Args: { _email?: string; _ip?: string; _ua?: string }
        Returns: undefined
      }
      modifier_approvisionnement: {
        Args: { _achat_id: string; _payload: Json }
        Returns: {
          achat_id: string
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_achat: string
          depot_id: string | null
          exercice_id: string | null
          fournisseur_id: string | null
          fournisseur_nom: string | null
          idempotency_key: string | null
          libelle: string
          montant: number
          notes: string | null
          reference: string
          reference_fournisseur: string | null
          statut: string
          total_quantite: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "achats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      modifier_colis_lignes: {
        Args: { _colis_id: string; _lignes: Json; _motif: string }
        Returns: undefined
      }
      modifier_commande: {
        Args: { _commande_id: string; _payload: Json }
        Returns: {
          adresse: string | null
          client_id: string | null
          client_nom: string | null
          commande_id: string
          commentaire_validation: string | null
          commercial_id: string | null
          commercial_nom: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_commande: string
          depot_id: string | null
          etablissement: string | null
          exercice_id: string | null
          idempotency_key: string | null
          montant_total: number
          montant_ttc: number
          montant_tva: number
          motif_rejet: string | null
          nb_produits: number
          net_a_payer: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          rejete_le: string | null
          rejete_par: string | null
          remise: number
          remise_globale_montant: number
          remise_globale_pct: number
          representant_nom: string | null
          statut: string
          taux_tva: number
          telephone: string | null
          total_ht_brut: number
          total_ht_net: number
          total_quantite: number
          total_remises_lignes: number
          updated_at: string
          valide_le: string | null
          valide_par: string | null
          ville: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "commandes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      norm_key: { Args: { _v: string }; Returns: string }
      norm_txt: { Args: { _v: string }; Returns: string }
      normalize_phone: { Args: { phone: string }; Returns: string }
      payer_achat: { Args: { _achat_id: string }; Returns: undefined }
      preview_cloture_exercice: {
        Args: { _exercice_id: string }
        Returns: Json
      }
      purge_audit_logs_expired: { Args: never; Returns: number }
      purger_anciennes_sauvegardes: {
        Args: { _retention?: number; _type?: string }
        Returns: number
      }
      rapport_agregat: {
        Args: { _dim?: string; _filtres?: Json }
        Returns: Json
      }
      rapport_clients_produit: {
        Args: { _filtres?: Json; _limit?: number; _produit_id: string }
        Returns: Json
      }
      rapport_evolution: {
        Args: { _filtres?: Json; _granularite?: string }
        Returns: Json
      }
      rapport_flop_produits: { Args: { _filtres?: Json }; Returns: Json }
      rapport_kpi: { Args: { _filtres?: Json }; Returns: Json }
      rapport_lignes_filtrees: {
        Args: { _filtres?: Json }
        Returns: {
          ca: number
          categorie: string
          client_id: string
          commande_id: string
          date_facture: string
          facture_id: string
          niveau: string
          produit_id: string
          quantite: number
          remise: number
          representant: string
          type_client: string
          ville: string
        }[]
      }
      rapport_produits: {
        Args: {
          _filtres?: Json
          _limit?: number
          _offset?: number
          _sens?: string
          _tri?: string
        }
        Returns: Json
      }
      rapport_top_produits: {
        Args: { _filtres?: Json; _limit?: number }
        Returns: Json
      }
      rbac_bulk_set_permissions: {
        Args: { _accorde: boolean; _codes: string[]; _role_id: string }
        Returns: undefined
      }
      rbac_role_ancestors: {
        Args: { _role_id: string }
        Returns: {
          role_id: string
        }[]
      }
      rbac_set_role_permission: {
        Args: { _accorde: boolean; _code: string; _role_id: string }
        Returns: undefined
      }
      rbac2_audit_search: {
        Args: {
          _action?: string
          _actor?: string
          _from?: string
          _limit?: number
          _target_type?: string
          _to?: string
        }
        Returns: {
          action: string
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          id: number
          ip: unknown
          target_id: string
          target_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rbac2_audit"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rbac2_deps_transitive: {
        Args: { _perm_code: string }
        Returns: {
          perm_code: string
        }[]
      }
      rbac2_diagnose: { Args: never; Returns: Json }
      rbac2_list_rpcs: {
        Args: never
        Returns: {
          is_security_definer: boolean
          name: string
        }[]
      }
      rbac2_sync_catalog: {
        Args: { _apply?: boolean; _inventory: Json }
        Returns: Json
      }
      rbac3_admin_guard: { Args: never; Returns: undefined }
      rbac3_assert: { Args: { _perm: string }; Returns: undefined }
      rbac3_audit_list: {
        Args: { _limit?: number }
        Returns: {
          acteur_email: string
          action: string
          cible_id: string
          cible_type: string
          created_at: string
          id: string
          nouvelle_valeur: Json
          perm_code: string
          role_code: string
        }[]
      }
      rbac3_can: {
        Args: { _perm: string; _user_id?: string }
        Returns: boolean
      }
      rbac3_depots_autorises: {
        Args: { _user_id?: string }
        Returns: {
          depot_id: string
        }[]
      }
      rbac3_is_global: { Args: { _user_id?: string }; Returns: boolean }
      rbac3_log: {
        Args: {
          _action: string
          _cible_id: string
          _cible_type: string
          _new?: Json
          _old?: Json
          _perm_code?: string
          _role_code?: string
        }
        Returns: undefined
      }
      rbac3_perm_bulk_set: {
        Args: { _granted: boolean; _perm_codes: string[]; _role_code: string }
        Returns: number
      }
      rbac3_perm_set: {
        Args: { _granted: boolean; _perm_code: string; _role_code: string }
        Returns: undefined
      }
      rbac3_permissions_of: {
        Args: { _user_id?: string }
        Returns: {
          perm_code: string
        }[]
      }
      rbac3_role_copy_perms: {
        Args: { _source: string; _target: string }
        Returns: number
      }
      rbac3_role_delete: { Args: { _code: string }; Returns: undefined }
      rbac3_role_upsert: {
        Args: {
          _code: string
          _description?: string
          _label: string
          _portee_globale?: boolean
          _statut?: string
        }
        Returns: string
      }
      rbac3_scope_departement: {
        Args: { _departement_id: string; _user_id?: string }
        Returns: boolean
      }
      rbac3_scope_depot: {
        Args: { _depot_id: string; _user_id?: string }
        Returns: boolean
      }
      rbac3_scope_service: {
        Args: { _service_id: string; _user_id?: string }
        Returns: boolean
      }
      rbac3_user_depot_set: {
        Args: { _depot_id: string; _next: boolean; _user_id: string }
        Returns: undefined
      }
      rbac3_user_depots_list: {
        Args: never
        Returns: {
          depot_id: string
          principal: boolean
          user_id: string
        }[]
      }
      rbac3_user_role_set: {
        Args: { _granted: boolean; _role_code: string; _user_id: string }
        Returns: undefined
      }
      recalculer_sla_approbations: {
        Args: never
        Returns: {
          mis_a_jour: number
          notifies: number
        }[]
      }
      recalculer_solde_client: { Args: { _client_id: string }; Returns: number }
      recalculer_soldes_global_clients: { Args: never; Returns: number }
      receptionner_achat: { Args: { _achat_id: string }; Returns: undefined }
      receptionner_transfert: {
        Args: { _transfert_id: string }
        Returns: undefined
      }
      refuser_tournee_couts: {
        Args: { _motif: string; _tournee_id: string }
        Returns: undefined
      }
      regulariser_inventaire: {
        Args: { _inventaire_id: string }
        Returns: undefined
      }
      rejeter_paiement: {
        Args: { _motif: string; _paiement_id: string }
        Returns: {
          banque: string | null
          client_nom: string | null
          commentaire_validation: string | null
          created_at: string
          cree_par: string | null
          date_paiement: string
          exercice_id: string | null
          facture_id: string | null
          idempotency_key: string | null
          mode_paiement: string
          montant: number
          motif_rejet: string | null
          notes: string | null
          num_transaction: string | null
          observations: string | null
          paiement_id: string
          reference: string
          reference_paiement: string | null
          rejete_le: string | null
          rejete_par: string | null
          statut: string
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "paiements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      renumber_employes_matricules: {
        Args: { _prefix?: string }
        Returns: number
      }
      report_bl_orphelins: {
        Args: never
        Returns: {
          bl_id: string
          motif: string
          reference: string
        }[]
      }
      report_client_duplicates: {
        Args: never
        Returns: {
          nb: number
          nom: string
          telephone: string
        }[]
      }
      report_stock_ecarts: {
        Args: never
        Returns: {
          designation: string
          ecart: number
          produit_id: string
        }[]
      }
      restore_employe: { Args: { _employe_id: string }; Returns: undefined }
      retour_creer_demande: { Args: { _payload: Json }; Returns: string }
      retour_forcer_cloture: {
        Args: { _motif: string; _retour_id: string }
        Returns: undefined
      }
      retour_receptionner: {
        Args: { _lignes: Json; _retour_id: string; _version: number }
        Returns: undefined
      }
      retour_refuser_compta: {
        Args: { _motif: string; _retour_id: string; _version: number }
        Returns: undefined
      }
      retour_refuser_magasin: {
        Args: { _motif: string; _retour_id: string; _version: number }
        Returns: undefined
      }
      retour_simulation_financiere: {
        Args: { _retour_id: string }
        Returns: Json
      }
      retour_valider_compta: {
        Args: {
          _commentaire?: string
          _montants: Json
          _option: string
          _retour_id: string
          _version: number
        }
        Returns: undefined
      }
      search_clients_crm: {
        Args: { _filters?: Json; _limit?: number; _offset?: number }
        Returns: Json
      }
      security_admin_overview: { Args: never; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_employe: { Args: { _employe_id: string }; Returns: undefined }
      soumettre_commande: { Args: { _commande_id: string }; Returns: undefined }
      supprimer_achat: {
        Args: { _achat_id: string; _motif?: string }
        Returns: undefined
      }
      supprimer_client: {
        Args: { _client_id: string; _motif?: string }
        Returns: Json
      }
      supprimer_colisage: {
        Args: { _bl_id: string; _motif: string }
        Returns: Json
      }
      supprimer_commande_definitif:
        | { Args: { _commande_id: string; _motif?: string }; Returns: Json }
        | {
            Args: { _commande_id: string; _force?: boolean; _motif?: string }
            Returns: Json
          }
      supprimer_employe: {
        Args: { _employe_id: string; _motif?: string }
        Returns: Json
      }
      supprimer_facture_definitif: {
        Args: { _facture_id: string; _motif?: string }
        Returns: Json
      }
      supprimer_fournisseur: {
        Args: { _fournisseur_id: string; _motif?: string }
        Returns: undefined
      }
      supprimer_livraison_suivi: {
        Args: { _id: string; _motif?: string }
        Returns: Json
      }
      supprimer_paiement_definitif: {
        Args: { _motif: string; _paiement_id: string }
        Returns: Json
      }
      supprimer_produit: {
        Args: { _motif?: string; _produit_id: string }
        Returns: Json
      }
      supprimer_proforma_definitif: {
        Args: { _motif?: string; _proforma_id: string }
        Returns: Json
      }
      supprimer_retour_definitif: {
        Args: { _retour_id: string }
        Returns: undefined
      }
      supprimer_tournee: {
        Args: { _motif?: string; _tournee_id: string }
        Returns: Json
      }
      sync_rbac_matrix: { Args: never; Returns: Json }
      track_user_action: {
        Args: {
          _action_key: string
          _href?: string
          _icon?: string
          _label?: string
          _module?: string
        }
        Returns: undefined
      }
      user_departement_id: { Args: { _user_id: string }; Returns: string }
      user_depot_ids: { Args: { _user_id: string }; Returns: string[] }
      user_service_id: { Args: { _user_id: string }; Returns: string }
      valider_commande: {
        Args: { _commande_id: string }
        Returns: {
          bl_reference: string
          facture_reference: string
        }[]
      }
      valider_decaissement_tournee: {
        Args: {
          _commentaire?: string
          _mode_reglement?: string
          _tournee_id: string
        }
        Returns: undefined
      }
      valider_inventaire_physique: {
        Args: { _inventaire_id: string; _lignes: Json }
        Returns: {
          categorie_id: string | null
          created_at: string
          created_by: string | null
          created_by_nom: string | null
          date_inventaire: string | null
          depot_id: string | null
          ecart_total: number | null
          exercice_id: string | null
          inventaire_id: string
          nb_ecarts: number
          nb_produits: number
          notes: string | null
          numero: string | null
          observations: string | null
          reference: string | null
          regularized_at: string | null
          statut: string | null
          type_inventaire: string
          updated_at: string
          valeur_totale: number
          validated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inventaires"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      valider_paiement: {
        Args: { _commentaire?: string; _paiement_id: string }
        Returns: {
          banque: string | null
          client_nom: string | null
          commentaire_validation: string | null
          created_at: string
          cree_par: string | null
          date_paiement: string
          exercice_id: string | null
          facture_id: string | null
          idempotency_key: string | null
          mode_paiement: string
          montant: number
          motif_rejet: string | null
          notes: string | null
          num_transaction: string | null
          observations: string | null
          paiement_id: string
          reference: string
          reference_paiement: string | null
          rejete_le: string | null
          rejete_par: string | null
          statut: string
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "paiements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "directeur_general"
        | "comptable"
        | "directeur_commercial"
        | "gestionnaire_stock"
        | "responsable_magasinier"
        | "secretariat"
        | "assistante"
        | "service_logistique"
        | "assistante_comptable"
      backup_scope_type: "GLOBAL" | "PROJECT"
      backup_trigger_type: "AUTOMATIC" | "MANUAL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "directeur_general",
        "comptable",
        "directeur_commercial",
        "gestionnaire_stock",
        "responsable_magasinier",
        "secretariat",
        "assistante",
        "service_logistique",
        "assistante_comptable",
      ],
      backup_scope_type: ["GLOBAL", "PROJECT"],
      backup_trigger_type: ["AUTOMATIC", "MANUAL"],
    },
  },
} as const

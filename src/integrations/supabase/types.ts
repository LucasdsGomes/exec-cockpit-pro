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
      actual_entries: {
        Row: {
          amount: number
          business_unit: string | null
          category_mapped: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          id: string
          managerial_account: string
          reference_period: string
        }
        Insert: {
          amount: number
          business_unit?: string | null
          category_mapped?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          managerial_account: string
          reference_period: string
        }
        Update: {
          amount?: number
          business_unit?: string | null
          category_mapped?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          managerial_account?: string
          reference_period?: string
        }
        Relationships: [
          {
            foreignKeyName: "actual_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          active: boolean
          company_id: string
          comparator: string
          created_at: string
          id: string
          metric: string
          rule_name: string
          severity: string
          threshold: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          comparator: string
          created_at?: string
          id?: string
          metric: string
          rule_name: string
          severity?: string
          threshold: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          comparator?: string
          created_at?: string
          id?: string
          metric?: string
          rule_name?: string
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_projection_daily: {
        Row: {
          caixa: number | null
          caixa_liquido: number | null
          capital_de_giro: number | null
          company_id: string
          contas_receber: number | null
          created_at: string
          divida_liquida: number | null
          emprestimos: number | null
          estoques: number | null
          fornecedores: number | null
          id: string
          imobilizado: number | null
          obrigacoes_trabalhistas: number | null
          obrigacoes_tributarias: number | null
          outros_ativos: number | null
          outros_passivos: number | null
          patrimonio_liquido: number | null
          projection_date: string
          resultado_acumulado: number | null
          snapshot_date: string
        }
        Insert: {
          caixa?: number | null
          caixa_liquido?: number | null
          capital_de_giro?: number | null
          company_id: string
          contas_receber?: number | null
          created_at?: string
          divida_liquida?: number | null
          emprestimos?: number | null
          estoques?: number | null
          fornecedores?: number | null
          id?: string
          imobilizado?: number | null
          obrigacoes_trabalhistas?: number | null
          obrigacoes_tributarias?: number | null
          outros_ativos?: number | null
          outros_passivos?: number | null
          patrimonio_liquido?: number | null
          projection_date: string
          resultado_acumulado?: number | null
          snapshot_date?: string
        }
        Update: {
          caixa?: number | null
          caixa_liquido?: number | null
          capital_de_giro?: number | null
          company_id?: string
          contas_receber?: number | null
          created_at?: string
          divida_liquida?: number | null
          emprestimos?: number | null
          estoques?: number | null
          fornecedores?: number | null
          id?: string
          imobilizado?: number | null
          obrigacoes_trabalhistas?: number | null
          obrigacoes_tributarias?: number | null
          outros_ativos?: number | null
          outros_passivos?: number | null
          patrimonio_liquido?: number | null
          projection_date?: string
          resultado_acumulado?: number | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_projection_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_projection_rules: {
        Row: {
          active: boolean
          balance_group: string
          balance_subgroup: string | null
          company_id: string
          created_at: string
          id: string
          match_pattern: string
          match_type: string
          rule_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          balance_group: string
          balance_subgroup?: string | null
          company_id: string
          created_at?: string
          id?: string
          match_pattern: string
          match_type: string
          rule_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          balance_group?: string
          balance_subgroup?: string | null
          company_id?: string
          created_at?: string
          id?: string
          match_pattern?: string
          match_type?: string
          rule_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_projection_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          active: boolean
          agency: string | null
          bank_name: string | null
          company_id: string
          created_at: string
          currency: string
          id: string
          name: string
          source_record_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          bank_name?: string | null
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          bank_name?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_balances_snapshots: {
        Row: {
          balance: number
          bank_account_id: string
          blocked: number
          company_id: string
          created_at: string
          id: string
          snapshot_date: string
          source: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          balance?: number
          bank_account_id: string
          blocked?: number
          company_id: string
          created_at?: string
          id?: string
          snapshot_date: string
          source?: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          bank_account_id?: string
          blocked?: number
          company_id?: string
          created_at?: string
          id?: string
          snapshot_date?: string
          source?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_balances_snapshots_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_balances_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_movements: {
        Row: {
          amount: number
          bank_account_id: string
          company_id: string
          created_at: string
          description: string | null
          direction: Database["public"]["Enums"]["entry_direction"]
          document_number: string | null
          financial_entry_id: string | null
          id: string
          movement_date: string
          reconciled: boolean
          source_record_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          company_id: string
          created_at?: string
          description?: string | null
          direction: Database["public"]["Enums"]["entry_direction"]
          document_number?: string | null
          financial_entry_id?: string | null
          id?: string
          movement_date: string
          reconciled?: boolean
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["entry_direction"]
          document_number?: string | null
          financial_entry_id?: string | null
          id?: string
          movement_date?: string
          reconciled?: boolean
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_movements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_entries: {
        Row: {
          amount: number
          business_unit: string | null
          category_mapped: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          id: string
          managerial_account: string
          notes: string | null
          reference_period: string
          scenario: Database["public"]["Enums"]["budget_scenario"]
          updated_at: string
        }
        Insert: {
          amount: number
          business_unit?: string | null
          category_mapped?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          managerial_account: string
          notes?: string | null
          reference_period: string
          scenario?: Database["public"]["Enums"]["budget_scenario"]
          updated_at?: string
        }
        Update: {
          amount?: number
          business_unit?: string | null
          category_mapped?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          managerial_account?: string
          notes?: string | null
          reference_period?: string
          scenario?: Database["public"]["Enums"]["budget_scenario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_vs_actual_snapshots: {
        Row: {
          actual_amount: number
          budget_amount: number
          category_mapped: string | null
          company_id: string
          created_at: string
          id: string
          managerial_account: string
          reference_period: string
          snapshot_date: string
          variance_abs: number
          variance_pct: number | null
        }
        Insert: {
          actual_amount?: number
          budget_amount?: number
          category_mapped?: string | null
          company_id: string
          created_at?: string
          id?: string
          managerial_account: string
          reference_period: string
          snapshot_date?: string
          variance_abs?: number
          variance_pct?: number | null
        }
        Update: {
          actual_amount?: number
          budget_amount?: number
          category_mapped?: string | null
          company_id?: string
          created_at?: string
          id?: string
          managerial_account?: string
          reference_period?: string
          snapshot_date?: string
          variance_abs?: number
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_vs_actual_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_mapping_rules: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          dfc_group: string
          dfc_subgroup: string | null
          display_order: number
          flow_type: Database["public"]["Enums"]["flow_type"]
          id: string
          match_pattern: string
          match_type: string
          rule_name: string
          sign_multiplier: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          dfc_group: string
          dfc_subgroup?: string | null
          display_order?: number
          flow_type: Database["public"]["Enums"]["flow_type"]
          id?: string
          match_pattern: string
          match_type: string
          rule_name: string
          sign_multiplier?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          dfc_group?: string
          dfc_subgroup?: string | null
          display_order?: number
          flow_type?: Database["public"]["Enums"]["flow_type"]
          id?: string
          match_pattern?: string
          match_type?: string
          rule_name?: string
          sign_multiplier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_mapping_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          description: string
          id: string
          parent_code: string | null
          source_record_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          parent_code?: string | null
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          parent_code?: string | null
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      category_mapping: {
        Row: {
          active: boolean
          affects_balance: boolean
          affects_cash: boolean
          affects_dre: boolean
          company_id: string
          created_at: string
          dfc_category: string | null
          dfc_subcategory: string | null
          dre_category: string | null
          dre_subcategory: string | null
          flow_type: Database["public"]["Enums"]["flow_type"] | null
          id: string
          managerial_group_1: string | null
          managerial_group_2: string | null
          managerial_group_3: string | null
          notes: string | null
          omie_category_code: string
          omie_category_description: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          affects_balance?: boolean
          affects_cash?: boolean
          affects_dre?: boolean
          company_id: string
          created_at?: string
          dfc_category?: string | null
          dfc_subcategory?: string | null
          dre_category?: string | null
          dre_subcategory?: string | null
          flow_type?: Database["public"]["Enums"]["flow_type"] | null
          id?: string
          managerial_group_1?: string | null
          managerial_group_2?: string | null
          managerial_group_3?: string | null
          notes?: string | null
          omie_category_code: string
          omie_category_description?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          affects_balance?: boolean
          affects_cash?: boolean
          affects_dre?: boolean
          company_id?: string
          created_at?: string
          dfc_category?: string | null
          dfc_subcategory?: string | null
          dre_category?: string | null
          dre_subcategory?: string | null
          flow_type?: Database["public"]["Enums"]["flow_type"] | null
          id?: string
          managerial_group_1?: string | null
          managerial_group_2?: string | null
          managerial_group_3?: string | null
          notes?: string | null
          omie_category_code?: string
          omie_category_description?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_mapping_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts_mapping: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          managerial_account: string
          managerial_group_1: string | null
          managerial_group_2: string | null
          managerial_group_3: string | null
          notes: string | null
          omie_account_code: string
          omie_account_description: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          managerial_account: string
          managerial_group_1?: string | null
          managerial_group_2?: string | null
          managerial_group_3?: string | null
          notes?: string | null
          omie_account_code: string
          omie_account_description?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          managerial_account?: string
          managerial_group_1?: string | null
          managerial_group_2?: string | null
          managerial_group_3?: string | null
          notes?: string | null
          omie_account_code?: string
          omie_account_description?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_mapping_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_commitments: {
        Row: {
          amount: number
          amount_signed: number
          company_id: string
          confidence_pct: number
          created_at: string
          customer_id: string | null
          description: string | null
          direction: Database["public"]["Enums"]["entry_direction"]
          document_number: string | null
          expected_date: string | null
          id: string
          imported_batch_id: string | null
          issue_date: string | null
          kind: Database["public"]["Enums"]["commitment_kind"]
          linked_financial_entry_id: string | null
          metadata: Json
          party_name: string | null
          source_endpoint: string
          source_record_id: string
          source_system: string
          status: Database["public"]["Enums"]["commitment_status"]
          supplier_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_signed?: number
          company_id: string
          confidence_pct?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["entry_direction"]
          document_number?: string | null
          expected_date?: string | null
          id?: string
          imported_batch_id?: string | null
          issue_date?: string | null
          kind: Database["public"]["Enums"]["commitment_kind"]
          linked_financial_entry_id?: string | null
          metadata?: Json
          party_name?: string | null
          source_endpoint: string
          source_record_id: string
          source_system?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          supplier_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_signed?: number
          company_id?: string
          confidence_pct?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["entry_direction"]
          document_number?: string | null
          expected_date?: string | null
          id?: string
          imported_batch_id?: string | null
          issue_date?: string | null
          kind?: Database["public"]["Enums"]["commitment_kind"]
          linked_financial_entry_id?: string | null
          metadata?: Json
          party_name?: string | null
          source_endpoint?: string
          source_record_id?: string
          source_system?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          supplier_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          cnpj: string | null
          created_at: string
          id: string
          legal_name: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_center_assign_rules: {
        Row: {
          active: boolean
          company_id: string
          cost_center_id: string
          created_at: string
          id: string
          match_pattern: string
          match_type: string
          priority: number
          rule_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          cost_center_id: string
          created_at?: string
          id?: string
          match_pattern: string
          match_type: string
          priority?: number
          rule_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          cost_center_id?: string
          created_at?: string
          id?: string
          match_pattern?: string
          match_type?: string
          priority?: number
          rule_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_center_assign_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_center_assign_rules_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_center_mapping: {
        Row: {
          active: boolean
          business_unit: string | null
          company_id: string
          created_at: string
          department: string | null
          id: string
          managerial_cost_center: string
          omie_cost_center_code: string
          omie_cost_center_description: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_unit?: string | null
          company_id: string
          created_at?: string
          department?: string | null
          id?: string
          managerial_cost_center: string
          omie_cost_center_code: string
          omie_cost_center_description?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_unit?: string | null
          company_id?: string
          created_at?: string
          department?: string | null
          id?: string
          managerial_cost_center?: string
          omie_cost_center_code?: string
          omie_cost_center_description?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_center_mapping_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean
          business_unit: string | null
          code: string
          company_id: string
          created_at: string
          department: string | null
          description: string
          id: string
          source_record_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_unit?: string | null
          code: string
          company_id: string
          created_at?: string
          department?: string | null
          description: string
          id?: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_unit?: string | null
          code?: string
          company_id?: string
          created_at?: string
          department?: string | null
          description?: string
          id?: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          source_record_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_kpi_snapshots: {
        Row: {
          caixa_final: number | null
          ciclo_financeiro: number | null
          company_id: string
          contas_pagar_proximas: number | null
          contas_receber_proximas: number | null
          created_at: string
          ebitda: number | null
          geracao_caixa: number | null
          id: string
          margem_bruta: number | null
          metadata: Json | null
          pmp: number | null
          pmr: number | null
          projecao_caixa_30d: number | null
          receita_liquida: number | null
          resultado_liquido: number | null
          snapshot_date: string
        }
        Insert: {
          caixa_final?: number | null
          ciclo_financeiro?: number | null
          company_id: string
          contas_pagar_proximas?: number | null
          contas_receber_proximas?: number | null
          created_at?: string
          ebitda?: number | null
          geracao_caixa?: number | null
          id?: string
          margem_bruta?: number | null
          metadata?: Json | null
          pmp?: number | null
          pmr?: number | null
          projecao_caixa_30d?: number | null
          receita_liquida?: number | null
          resultado_liquido?: number | null
          snapshot_date: string
        }
        Update: {
          caixa_final?: number | null
          ciclo_financeiro?: number | null
          company_id?: string
          contas_pagar_proximas?: number | null
          contas_receber_proximas?: number | null
          created_at?: string
          ebitda?: number | null
          geracao_caixa?: number | null
          id?: string
          margem_bruta?: number | null
          metadata?: Json | null
          pmp?: number | null
          pmr?: number | null
          projecao_caixa_30d?: number | null
          receita_liquida?: number | null
          resultado_liquido?: number | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_kpi_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dfc_forecast_base: {
        Row: {
          amount: number
          amount_signed: number
          bank_account_id: string | null
          category_mapped: string | null
          company_id: string
          confidence_pct: number | null
          created_at: string
          dfc_group: string
          dfc_subgroup: string | null
          flow_type: Database["public"]["Enums"]["flow_type"]
          forecast_date: string
          id: string
          source_entry_id: string | null
        }
        Insert: {
          amount: number
          amount_signed: number
          bank_account_id?: string | null
          category_mapped?: string | null
          company_id: string
          confidence_pct?: number | null
          created_at?: string
          dfc_group: string
          dfc_subgroup?: string | null
          flow_type: Database["public"]["Enums"]["flow_type"]
          forecast_date: string
          id?: string
          source_entry_id?: string | null
        }
        Update: {
          amount?: number
          amount_signed?: number
          bank_account_id?: string | null
          category_mapped?: string | null
          company_id?: string
          confidence_pct?: number | null
          created_at?: string
          dfc_group?: string
          dfc_subgroup?: string | null
          flow_type?: Database["public"]["Enums"]["flow_type"]
          forecast_date?: string
          id?: string
          source_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dfc_forecast_base_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_forecast_base_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_forecast_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_forecast_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_forecast_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      dfc_realized_base: {
        Row: {
          amount: number
          amount_signed: number
          bank_account_id: string | null
          cash_date: string
          category_mapped: string | null
          company_id: string
          created_at: string
          dfc_group: string
          dfc_subgroup: string | null
          flow_type: Database["public"]["Enums"]["flow_type"]
          id: string
          source_entry_id: string | null
        }
        Insert: {
          amount: number
          amount_signed: number
          bank_account_id?: string | null
          cash_date: string
          category_mapped?: string | null
          company_id: string
          created_at?: string
          dfc_group: string
          dfc_subgroup?: string | null
          flow_type: Database["public"]["Enums"]["flow_type"]
          id?: string
          source_entry_id?: string | null
        }
        Update: {
          amount?: number
          amount_signed?: number
          bank_account_id?: string | null
          cash_date?: string
          category_mapped?: string | null
          company_id?: string
          created_at?: string
          dfc_group?: string
          dfc_subgroup?: string | null
          flow_type?: Database["public"]["Enums"]["flow_type"]
          id?: string
          source_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dfc_realized_base_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_realized_base_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_realized_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_realized_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dfc_realized_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_base: {
        Row: {
          amount: number
          amount_signed: number
          business_unit: string | null
          category_mapped: string | null
          company_id: string
          competence_date: string
          cost_center_id: string | null
          created_at: string
          customer_id: string | null
          department: string | null
          dre_group: string
          dre_subgroup: string | null
          id: string
          reference_date: string
          source_entry_id: string | null
          supplier_id: string | null
        }
        Insert: {
          amount: number
          amount_signed: number
          business_unit?: string | null
          category_mapped?: string | null
          company_id: string
          competence_date: string
          cost_center_id?: string | null
          created_at?: string
          customer_id?: string | null
          department?: string | null
          dre_group: string
          dre_subgroup?: string | null
          id?: string
          reference_date: string
          source_entry_id?: string | null
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          amount_signed?: number
          business_unit?: string | null
          category_mapped?: string | null
          company_id?: string
          competence_date?: string
          cost_center_id?: string | null
          created_at?: string
          customer_id?: string | null
          department?: string | null
          dre_group?: string
          dre_subgroup?: string | null
          id?: string
          reference_date?: string
          source_entry_id?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_base_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_base_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_base_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_base_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_base_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_mapping_rules: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          display_order: number
          dre_group: string
          dre_subgroup: string | null
          id: string
          match_pattern: string
          match_type: string
          rule_name: string
          sign_multiplier: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          display_order?: number
          dre_group: string
          dre_subgroup?: string | null
          id?: string
          match_pattern: string
          match_type: string
          rule_name: string
          sign_multiplier?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          display_order?: number
          dre_group?: string
          dre_subgroup?: string | null
          id?: string
          match_pattern?: string
          match_type?: string
          rule_name?: string
          sign_multiplier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_mapping_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cycle_metrics: {
        Row: {
          ciclo_financeiro: number | null
          ciclo_operacional: number | null
          company_id: string
          created_at: string
          id: string
          necessidade_capital_giro: number | null
          pme: number | null
          pmp: number | null
          pmr: number | null
          reference_period: string
        }
        Insert: {
          ciclo_financeiro?: number | null
          ciclo_operacional?: number | null
          company_id: string
          created_at?: string
          id?: string
          necessidade_capital_giro?: number | null
          pme?: number | null
          pmp?: number | null
          pmr?: number | null
          reference_period: string
        }
        Update: {
          ciclo_financeiro?: number | null
          ciclo_operacional?: number | null
          company_id?: string
          created_at?: string
          id?: string
          necessidade_capital_giro?: number | null
          pme?: number | null
          pmp?: number | null
          pmr?: number | null
          reference_period?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_cycle_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          affects_balance: boolean
          affects_cash: boolean
          affects_dre: boolean
          amount: number
          amount_signed: number
          bank_account_id: string | null
          cash_date: string | null
          category_mapped: string | null
          category_raw: string | null
          company_id: string
          competence_date: string
          cost_center_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          description: string | null
          dfc_group: string | null
          dfc_subgroup: string | null
          direction: Database["public"]["Enums"]["entry_direction"]
          document_number: string | null
          dre_group: string | null
          dre_subgroup: string | null
          due_date: string | null
          flow_type: Database["public"]["Enums"]["flow_type"] | null
          id: string
          imported_batch_id: string | null
          is_classified: boolean
          metadata: Json | null
          reference_date: string | null
          source_endpoint: string | null
          source_record_id: string | null
          source_system: string
          status: Database["public"]["Enums"]["entry_status"]
          supplier_id: string | null
          supplier_name: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          affects_balance?: boolean
          affects_cash?: boolean
          affects_dre?: boolean
          amount: number
          amount_signed: number
          bank_account_id?: string | null
          cash_date?: string | null
          category_mapped?: string | null
          category_raw?: string | null
          company_id: string
          competence_date: string
          cost_center_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          dfc_group?: string | null
          dfc_subgroup?: string | null
          direction: Database["public"]["Enums"]["entry_direction"]
          document_number?: string | null
          dre_group?: string | null
          dre_subgroup?: string | null
          due_date?: string | null
          flow_type?: Database["public"]["Enums"]["flow_type"] | null
          id?: string
          imported_batch_id?: string | null
          is_classified?: boolean
          metadata?: Json | null
          reference_date?: string | null
          source_endpoint?: string | null
          source_record_id?: string | null
          source_system?: string
          status?: Database["public"]["Enums"]["entry_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          affects_balance?: boolean
          affects_cash?: boolean
          affects_dre?: boolean
          amount?: number
          amount_signed?: number
          bank_account_id?: string | null
          cash_date?: string | null
          category_mapped?: string | null
          category_raw?: string | null
          company_id?: string
          competence_date?: string
          cost_center_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          dfc_group?: string | null
          dfc_subgroup?: string | null
          direction?: Database["public"]["Enums"]["entry_direction"]
          document_number?: string | null
          dre_group?: string | null
          dre_subgroup?: string | null
          due_date?: string | null
          flow_type?: Database["public"]["Enums"]["flow_type"] | null
          id?: string
          imported_batch_id?: string | null
          is_classified?: boolean
          metadata?: Json | null
          reference_date?: string | null
          source_endpoint?: string | null
          source_record_id?: string | null
          source_system?: string
          status?: Database["public"]["Enums"]["entry_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_imported_batch_id_fkey"
            columns: ["imported_batch_id"]
            isOneToOne: false
            referencedRelation: "omie_raw_sync_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          amount_cofins: number
          amount_csll: number
          amount_discount: number
          amount_gross: number
          amount_icms: number
          amount_inss: number
          amount_irrf: number
          amount_iss: number
          amount_net: number
          amount_pis: number
          amount_taxes: number
          cfop: string | null
          chave_acesso: string | null
          company_id: string
          competence_date: string
          created_at: string
          customer_id: string | null
          description: string | null
          doc_type: Database["public"]["Enums"]["fiscal_doc_type"]
          id: string
          imported_batch_id: string | null
          issue_date: string
          linked_financial_entry_id: string | null
          metadata: Json
          numero: string | null
          party_document: string | null
          party_name: string | null
          serie: string | null
          source_endpoint: string
          source_record_id: string | null
          source_system: string
          status: Database["public"]["Enums"]["fiscal_doc_status"]
          supplier_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          amount_cofins?: number
          amount_csll?: number
          amount_discount?: number
          amount_gross?: number
          amount_icms?: number
          amount_inss?: number
          amount_irrf?: number
          amount_iss?: number
          amount_net?: number
          amount_pis?: number
          amount_taxes?: number
          cfop?: string | null
          chave_acesso?: string | null
          company_id: string
          competence_date: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          doc_type: Database["public"]["Enums"]["fiscal_doc_type"]
          id?: string
          imported_batch_id?: string | null
          issue_date: string
          linked_financial_entry_id?: string | null
          metadata?: Json
          numero?: string | null
          party_document?: string | null
          party_name?: string | null
          serie?: string | null
          source_endpoint: string
          source_record_id?: string | null
          source_system?: string
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          supplier_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_cofins?: number
          amount_csll?: number
          amount_discount?: number
          amount_gross?: number
          amount_icms?: number
          amount_inss?: number
          amount_irrf?: number
          amount_iss?: number
          amount_net?: number
          amount_pis?: number
          amount_taxes?: number
          cfop?: string | null
          chave_acesso?: string | null
          company_id?: string
          competence_date?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          doc_type?: Database["public"]["Enums"]["fiscal_doc_type"]
          id?: string
          imported_batch_id?: string | null
          issue_date?: string
          linked_financial_entry_id?: string | null
          metadata?: Json
          numero?: string | null
          party_document?: string | null
          party_name?: string | null
          serie?: string | null
          source_endpoint?: string
          source_record_id?: string | null
          source_system?: string
          status?: Database["public"]["Enums"]["fiscal_doc_status"]
          supplier_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      initial_balances: {
        Row: {
          account_label: string | null
          amount: number
          balance_type: string
          bank_account_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          reference_date: string
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          amount: number
          balance_type: string
          bank_account_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_date: string
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          amount?: number
          balance_type?: string
          bank_account_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initial_balances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initial_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_entries: {
        Row: {
          active: boolean
          amount: number
          amount_signed: number
          approved_at: string | null
          approved_by: string | null
          cash_date: string | null
          category_mapped: string | null
          company_id: string
          competence_date: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          description: string
          dfc_group: string | null
          dre_group: string | null
          entry_kind: string
          flow_type: Database["public"]["Enums"]["flow_type"] | null
          id: string
          reason: string
          reference_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          amount_signed: number
          approved_at?: string | null
          approved_by?: string | null
          cash_date?: string | null
          category_mapped?: string | null
          company_id: string
          competence_date?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          description: string
          dfc_group?: string | null
          dre_group?: string | null
          entry_kind: string
          flow_type?: Database["public"]["Enums"]["flow_type"] | null
          id?: string
          reason: string
          reference_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          amount_signed?: number
          approved_at?: string | null
          approved_by?: string | null
          cash_date?: string | null
          category_mapped?: string | null
          company_id?: string
          competence_date?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          dfc_group?: string | null
          dre_group?: string | null
          entry_kind?: string
          flow_type?: Database["public"]["Enums"]["flow_type"] | null
          id?: string
          reason?: string
          reference_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_parameters: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          param_key: string
          param_text: string | null
          param_value: number | null
          reference_period: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          param_key: string
          param_text?: string | null
          param_value?: number | null
          reference_period?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          param_key?: string
          param_text?: string | null
          param_value?: number | null
          reference_period?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_parameters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      omie_credentials: {
        Row: {
          active: boolean
          app_key_ref: string
          app_secret_ref: string
          base_url: string
          company_id: string
          created_at: string
          environment: string
          id: string
          last_status: Database["public"]["Enums"]["sync_status"] | null
          last_sync_at: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          app_key_ref: string
          app_secret_ref: string
          base_url?: string
          company_id: string
          created_at?: string
          environment?: string
          id?: string
          last_status?: Database["public"]["Enums"]["sync_status"] | null
          last_sync_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          app_key_ref?: string
          app_secret_ref?: string
          base_url?: string
          company_id?: string
          created_at?: string
          environment?: string
          id?: string
          last_status?: Database["public"]["Enums"]["sync_status"] | null
          last_sync_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "omie_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      omie_raw_payloads: {
        Row: {
          batch_id: string | null
          company_id: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
          source_endpoint: string
          source_record_id: string | null
        }
        Insert: {
          batch_id?: string | null
          company_id: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          source_endpoint: string
          source_record_id?: string | null
        }
        Update: {
          batch_id?: string | null
          company_id?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          source_endpoint?: string
          source_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omie_raw_payloads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "omie_raw_sync_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omie_raw_payloads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      omie_raw_sync_batches: {
        Row: {
          company_id: string
          error_records: number | null
          finished_at: string | null
          id: string
          metadata: Json | null
          processed_records: number | null
          source_endpoint: string
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
          total_records: number | null
          triggered_by: string | null
        }
        Insert: {
          company_id: string
          error_records?: number | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          processed_records?: number | null
          source_endpoint: string
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          total_records?: number | null
          triggered_by?: string | null
        }
        Update: {
          company_id?: string
          error_records?: number | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          processed_records?: number | null
          source_endpoint?: string
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          total_records?: number | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omie_raw_sync_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      omie_sync_errors: {
        Row: {
          batch_id: string | null
          company_id: string
          created_at: string
          error_code: string | null
          error_message: string
          id: string
          payload: Json | null
          resolved: boolean
          resolved_at: string | null
          source_endpoint: string
          source_record_id: string | null
        }
        Insert: {
          batch_id?: string | null
          company_id: string
          created_at?: string
          error_code?: string | null
          error_message: string
          id?: string
          payload?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          source_endpoint: string
          source_record_id?: string | null
        }
        Update: {
          batch_id?: string | null
          company_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string
          id?: string
          payload?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          source_endpoint?: string
          source_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omie_sync_errors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "omie_raw_sync_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omie_sync_errors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      omie_sync_logs: {
        Row: {
          batch_id: string | null
          company_id: string
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          source_endpoint: string | null
        }
        Insert: {
          batch_id?: string | null
          company_id: string
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message: string
          source_endpoint?: string | null
        }
        Update: {
          batch_id?: string | null
          company_id?: string
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          source_endpoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omie_sync_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "omie_raw_sync_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omie_sync_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_entries: {
        Row: {
          amount: number
          cash_date: string | null
          category_mapped: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          document_number: string | null
          due_date: string
          financial_entry_id: string | null
          id: string
          notes: string | null
          paid_amount: number | null
          source_record_id: string | null
          status: Database["public"]["Enums"]["entry_status"]
          supplier_id: string | null
          supplier_name: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cash_date?: string | null
          category_mapped?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          document_number?: string | null
          due_date: string
          financial_entry_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_date?: string | null
          category_mapped?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          document_number?: string | null
          due_date?: string
          financial_entry_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_entries_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_entries_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_entries_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_entries: {
        Row: {
          amount: number
          cash_date: string | null
          category_mapped: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          document_number: string | null
          due_date: string
          financial_entry_id: string | null
          id: string
          notes: string | null
          received_amount: number | null
          source_record_id: string | null
          status: Database["public"]["Enums"]["entry_status"]
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cash_date?: string | null
          category_mapped?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          document_number?: string | null
          due_date: string
          financial_entry_id?: string | null
          id?: string
          notes?: string | null
          received_amount?: number | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_date?: string | null
          category_mapped?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          document_number?: string | null
          due_date?: string
          financial_entry_id?: string | null
          id?: string
          notes?: string | null
          received_amount?: number | null
          source_record_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivable_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_entries_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_entries_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_entries_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "v_unclassified_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          source_record_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          source_record_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_preferences: {
        Row: {
          company_id: string
          created_at: string
          daily_sync_enabled: boolean
          daily_sync_hour: number
          id: string
          incremental_mode: boolean
          last_full_sync_at: string | null
          last_incremental_sync_at: string | null
          log_retention_days: number
          lookback_days: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          daily_sync_enabled?: boolean
          daily_sync_hour?: number
          id?: string
          incremental_mode?: boolean
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          log_retention_days?: number
          lookback_days?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          daily_sync_enabled?: boolean
          daily_sync_hour?: number
          id?: string
          incremental_mode?: boolean
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          log_retention_days?: number
          lookback_days?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      working_capital_metrics: {
        Row: {
          company_id: string
          created_at: string
          current_assets: number | null
          current_liabilities: number | null
          id: string
          net_cash: number | null
          net_debt: number | null
          reference_period: string
          working_capital: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          current_assets?: number | null
          current_liabilities?: number | null
          id?: string
          net_cash?: number | null
          net_debt?: number | null
          reference_period: string
          working_capital?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          current_assets?: number | null
          current_liabilities?: number | null
          id?: string
          net_cash?: number | null
          net_debt?: number | null
          reference_period?: string
          working_capital?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "working_capital_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cash_forecast_extended: {
        Row: {
          amount: number | null
          amount_signed: number | null
          bank_account_id: string | null
          category_mapped: string | null
          company_id: string | null
          confidence_pct: number | null
          description: string | null
          dfc_group: string | null
          dfc_subgroup: string | null
          direction: Database["public"]["Enums"]["entry_direction"] | null
          document_number: string | null
          forecast_date: string | null
          source_id: string | null
          source_kind: string | null
          weighted_amount_signed: number | null
        }
        Relationships: []
      }
      dre_competencia: {
        Row: {
          amount: number | null
          amount_signed: number | null
          category_mapped: string | null
          company_id: string | null
          competence_date: string | null
          cost_center_id: string | null
          customer_id: string | null
          dre_group: string | null
          dre_subgroup: string | null
          source_id: string | null
          source_kind: string | null
          supplier_id: string | null
        }
        Relationships: []
      }
      v_budget_vs_actual: {
        Row: {
          actual_amount: number | null
          budget_amount: number | null
          category_mapped: string | null
          company_id: string | null
          managerial_account: string | null
          reference_period: string | null
          variance_abs: number | null
          variance_pct: number | null
        }
        Relationships: []
      }
      v_dfc_forecast_daily: {
        Row: {
          amount_total: number | null
          company_id: string | null
          dfc_group: string | null
          dfc_subgroup: string | null
          flow_type: Database["public"]["Enums"]["flow_type"] | null
          forecast_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dfc_forecast_base_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dfc_realized_daily: {
        Row: {
          amount_total: number | null
          cash_date: string | null
          company_id: string | null
          dfc_group: string | null
          dfc_subgroup: string | null
          flow_type: Database["public"]["Enums"]["flow_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "dfc_realized_base_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dre_monthly: {
        Row: {
          amount_total: number | null
          category_mapped: string | null
          company_id: string | null
          dre_group: string | null
          dre_subgroup: string | null
          entry_count: number | null
          reference_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_base_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_unclassified_entries: {
        Row: {
          amount_signed: number | null
          category_raw: string | null
          company_id: string | null
          competence_date: string | null
          created_at: string | null
          customer_name: string | null
          description: string | null
          id: string | null
          supplier_name: string | null
        }
        Insert: {
          amount_signed?: number | null
          category_raw?: string | null
          company_id?: string | null
          competence_date?: string | null
          created_at?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string | null
          supplier_name?: string | null
        }
        Update: {
          amount_signed?: number | null
          category_raw?: string | null
          company_id?: string | null
          competence_date?: string | null
          created_at?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string | null
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_unclassified_queue: {
        Row: {
          amount_signed: number | null
          cash_date: string | null
          category_raw: string | null
          company_id: string | null
          competence_date: string | null
          created_at: string | null
          customer_name: string | null
          description: string | null
          direction: Database["public"]["Enums"]["entry_direction"] | null
          due_date: string | null
          id: string | null
          source_endpoint: string | null
          source_record_id: string | null
          supplier_name: string | null
        }
        Insert: {
          amount_signed?: number | null
          cash_date?: string | null
          category_raw?: string | null
          company_id?: string | null
          competence_date?: string | null
          created_at?: string | null
          customer_name?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["entry_direction"] | null
          due_date?: string | null
          id?: string | null
          source_endpoint?: string | null
          source_record_id?: string | null
          supplier_name?: string | null
        }
        Update: {
          amount_signed?: number | null
          cash_date?: string | null
          category_raw?: string | null
          company_id?: string | null
          competence_date?: string | null
          created_at?: string | null
          customer_name?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["entry_direction"] | null
          due_date?: string | null
          id?: string | null
          source_endpoint?: string | null
          source_record_id?: string | null
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_cost_center_rules: { Args: { _company: string }; Returns: Json }
      backfill_company_refs: { Args: { _company: string }; Returns: Json }
      can_edit_company: { Args: { _company_id: string }; Returns: boolean }
      classify_financial_entry: {
        Args: { _entry_id: string }
        Returns: boolean
      }
      compute_balance_projection: {
        Args: { _company: string; _date: string }
        Returns: string
      }
      compute_dre_competencia: {
        Args: { _company: string; _from: string; _to: string }
        Returns: {
          amount_signed: number
          dre_group: string
          dre_subgroup: string
        }[]
      }
      compute_financial_cycle: {
        Args: { _company: string; _period: string }
        Returns: {
          ciclo_financeiro: number
          ciclo_operacional: number
          ncg: number
          pme: number
          pmp: number
          pmr: number
        }[]
      }
      current_user_companies: { Args: never; Returns: string[] }
      has_any_role: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: { _company_id: string }; Returns: boolean }
      list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobname: string
          last_run: string
          last_status: string
          schedule: string
        }[]
      }
      mirror_payables_receivables: {
        Args: { _company: string }
        Returns: number
      }
      propagate_entry_refs: { Args: { _company: string }; Returns: Json }
      reclassify_company: {
        Args: { _company: string; _only_unclassified?: boolean }
        Returns: number
      }
      reconcile_bank_movements: { Args: { _company: string }; Returns: Json }
      reprocess_raw_payloads: { Args: { _company: string }; Returns: Json }
      run_daily_pipeline_all: { Args: never; Returns: Json }
      run_full_pipeline: {
        Args: { _company: string; _date?: string }
        Returns: Json
      }
      seed_initial_balances_from_bank_accounts: {
        Args: { _company: string; _reference_date?: string }
        Returns: Json
      }
      snapshot_kpis: {
        Args: { _company: string; _date: string }
        Returns: string
      }
      system_health: { Args: { _company: string }; Returns: Json }
      upsert_bank_movement: {
        Args: {
          _amount: number
          _bank_account: string
          _company: string
          _description: string
          _direction: string
          _document: string
          _movement_date: string
          _source_record_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "finance" | "controller" | "viewer"
      budget_scenario: "orcado" | "realizado" | "reprojetado"
      commitment_kind: "pedido_venda" | "ordem_compra"
      commitment_status: "aberto" | "parcial" | "faturado" | "cancelado"
      entry_direction: "entrada" | "saida"
      entry_status: "previsto" | "realizado" | "cancelado" | "parcial"
      fiscal_doc_status:
        | "autorizada"
        | "cancelada"
        | "denegada"
        | "inutilizada"
        | "rascunho"
      fiscal_doc_type:
        | "nfe_emitida"
        | "nfe_recebida"
        | "nfse_emitida"
        | "nfse_recebida"
      flow_type: "operacional" | "investimento" | "financiamento"
      sync_status: "pending" | "running" | "success" | "error" | "partial"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "finance", "controller", "viewer"],
      budget_scenario: ["orcado", "realizado", "reprojetado"],
      commitment_kind: ["pedido_venda", "ordem_compra"],
      commitment_status: ["aberto", "parcial", "faturado", "cancelado"],
      entry_direction: ["entrada", "saida"],
      entry_status: ["previsto", "realizado", "cancelado", "parcial"],
      fiscal_doc_status: [
        "autorizada",
        "cancelada",
        "denegada",
        "inutilizada",
        "rascunho",
      ],
      fiscal_doc_type: [
        "nfe_emitida",
        "nfe_recebida",
        "nfse_emitida",
        "nfse_recebida",
      ],
      flow_type: ["operacional", "investimento", "financiamento"],
      sync_status: ["pending", "running", "success", "error", "partial"],
    },
  },
} as const

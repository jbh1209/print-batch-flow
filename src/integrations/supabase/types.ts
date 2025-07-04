export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      active_job_assignments: {
        Row: {
          department_id: string
          id: string
          job_id: string
          job_table_name: string
          stage_id: string | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          department_id: string
          id?: string
          job_id: string
          job_table_name: string
          stage_id?: string | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          department_id?: string
          id?: string
          job_id?: string
          job_table_name?: string
          stage_id?: string | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_job_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_job_assignments_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          product_type: string
          setting_type: string
          sla_target_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_type: string
          setting_type: string
          sla_target_days: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_type?: string
          setting_type?: string
          sla_target_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      barcode_scan_log: {
        Row: {
          action_taken: string | null
          barcode_data: string
          created_at: string | null
          id: string
          job_id: string | null
          job_table_name: string | null
          scan_result: string
          stage_id: string | null
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          barcode_data: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          job_table_name?: string | null
          scan_result: string
          stage_id?: string | null
          user_id: string
        }
        Update: {
          action_taken?: string | null
          barcode_data?: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          job_table_name?: string | null
          scan_result?: string
          stage_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      batch_job_references: {
        Row: {
          batch_id: string
          batch_job_id: string | null
          batch_job_table: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          production_job_id: string
          status: string
        }
        Insert: {
          batch_id: string
          batch_job_id?: string | null
          batch_job_table: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          production_job_id: string
          status?: string
        }
        Update: {
          batch_id?: string
          batch_job_id?: string | null
          batch_job_table?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          production_job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_job_references_production_job_id_fkey"
            columns: ["production_job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          back_pdf_url: string | null
          created_at: string
          created_by: string
          date_created: string
          due_date: string
          front_pdf_url: string | null
          id: string
          lamination_type: Database["public"]["Enums"]["lamination_type"]
          name: string
          needs_overview_pdf: boolean | null
          overview_pdf_url: string | null
          paper_type: string | null
          paper_weight: string | null
          printer_type: string | null
          sheet_size: string | null
          sheets_required: number
          sla_target_days: number | null
          status: Database["public"]["Enums"]["batch_status"]
          updated_at: string
        }
        Insert: {
          back_pdf_url?: string | null
          created_at?: string
          created_by: string
          date_created?: string
          due_date: string
          front_pdf_url?: string | null
          id?: string
          lamination_type: Database["public"]["Enums"]["lamination_type"]
          name: string
          needs_overview_pdf?: boolean | null
          overview_pdf_url?: string | null
          paper_type?: string | null
          paper_weight?: string | null
          printer_type?: string | null
          sheet_size?: string | null
          sheets_required: number
          sla_target_days?: number | null
          status?: Database["public"]["Enums"]["batch_status"]
          updated_at?: string
        }
        Update: {
          back_pdf_url?: string | null
          created_at?: string
          created_by?: string
          date_created?: string
          due_date?: string
          front_pdf_url?: string | null
          id?: string
          lamination_type?: Database["public"]["Enums"]["lamination_type"]
          name?: string
          needs_overview_pdf?: boolean | null
          overview_pdf_url?: string | null
          paper_type?: string | null
          paper_weight?: string | null
          printer_type?: string | null
          sheet_size?: string | null
          sheets_required?: number
          sla_target_days?: number | null
          status?: Database["public"]["Enums"]["batch_status"]
          updated_at?: string
        }
        Relationships: []
      }
      box_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      business_card_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string
          double_sided: boolean
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          double_sided?: boolean
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          double_sided?: boolean
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          status?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_business_card_jobs_batch"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sla_target_days: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sla_target_days?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sla_target_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      category_production_stages: {
        Row: {
          applies_to_parts: Json | null
          category_id: string
          created_at: string
          estimated_duration_hours: number | null
          id: string
          is_conditional: boolean | null
          is_required: boolean
          part_mapping: Json | null
          part_rule_type: string | null
          production_stage_id: string
          skip_when_inactive: boolean | null
          stage_order: number
          updated_at: string
        }
        Insert: {
          applies_to_parts?: Json | null
          category_id: string
          created_at?: string
          estimated_duration_hours?: number | null
          id?: string
          is_conditional?: boolean | null
          is_required?: boolean
          part_mapping?: Json | null
          part_rule_type?: string | null
          production_stage_id: string
          skip_when_inactive?: boolean | null
          stage_order: number
          updated_at?: string
        }
        Update: {
          applies_to_parts?: Json | null
          category_id?: string
          created_at?: string
          estimated_duration_hours?: number | null
          id?: string
          is_conditional?: boolean | null
          is_required?: boolean
          part_mapping?: Json | null
          part_rule_type?: string | null
          production_stage_id?: string
          skip_when_inactive?: boolean | null
          stage_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_production_stages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_production_stages_production_stage_id_fkey"
            columns: ["production_stage_id"]
            isOneToOne: false
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cover_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          allows_concurrent_jobs: boolean | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          max_concurrent_jobs: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          allows_concurrent_jobs?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_concurrent_jobs?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          allows_concurrent_jobs?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_concurrent_jobs?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      flyer_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flyer_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      job_print_specifications: {
        Row: {
          created_at: string
          id: string
          job_id: string
          job_table_name: string
          printer_id: string | null
          specification_category: string
          specification_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          job_table_name: string
          printer_id?: string | null
          specification_category: string
          specification_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          job_table_name?: string
          printer_id?: string | null
          specification_category?: string
          specification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_print_specifications_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_print_specifications_specification_id_fkey"
            columns: ["specification_id"]
            isOneToOne: false
            referencedRelation: "print_specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_priority_overrides: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          job_id: string
          job_table_name: string
          priority_order: number
          reason: string | null
          set_by: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          job_id: string
          job_table_name: string
          priority_order: number
          reason?: string | null
          set_by: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          job_id?: string
          job_table_name?: string
          priority_order?: number
          reason?: string | null
          set_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_priority_overrides_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stage_instances: {
        Row: {
          category_id: string | null
          client_email: string | null
          client_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_rework: boolean | null
          job_id: string
          job_order_in_stage: number
          job_table_name: string
          notes: string | null
          part_name: string | null
          part_order: number | null
          part_type: string | null
          previous_stage_id: string | null
          printer_id: string | null
          production_stage_id: string
          proof_approved_manually_at: string | null
          proof_emailed_at: string | null
          proof_pdf_url: string | null
          qr_scan_data: Json | null
          rework_count: number | null
          rework_reason: string | null
          stage_order: number
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          client_email?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_rework?: boolean | null
          job_id: string
          job_order_in_stage?: number
          job_table_name: string
          notes?: string | null
          part_name?: string | null
          part_order?: number | null
          part_type?: string | null
          previous_stage_id?: string | null
          printer_id?: string | null
          production_stage_id: string
          proof_approved_manually_at?: string | null
          proof_emailed_at?: string | null
          proof_pdf_url?: string | null
          qr_scan_data?: Json | null
          rework_count?: number | null
          rework_reason?: string | null
          stage_order: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          client_email?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_rework?: boolean | null
          job_id?: string
          job_order_in_stage?: number
          job_table_name?: string
          notes?: string | null
          part_name?: string | null
          part_order?: number | null
          part_type?: string | null
          previous_stage_id?: string | null
          printer_id?: string | null
          production_stage_id?: string
          proof_approved_manually_at?: string | null
          proof_emailed_at?: string | null
          proof_pdf_url?: string | null
          qr_scan_data?: Json | null
          rework_count?: number | null
          rework_reason?: string | null
          stage_order?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_stage_instances_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_instances_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_instances_production_stage_id_fkey"
            columns: ["production_stage_id"]
            isOneToOne: false
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      postcard_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "postcard_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      poster_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poster_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      print_specifications: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          name: string
          properties: Json | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          name: string
          properties?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
          properties?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      printers: {
        Row: {
          capabilities: Json | null
          created_at: string
          id: string
          location: string | null
          max_paper_size: string | null
          name: string
          notes: string | null
          status: string
          supported_paper_types: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string
          id?: string
          location?: string | null
          max_paper_size?: string | null
          name: string
          notes?: string | null
          status?: string
          supported_paper_types?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json | null
          created_at?: string
          id?: string
          location?: string | null
          max_paper_size?: string | null
          name?: string
          notes?: string | null
          status?: string
          supported_paper_types?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_field_options: {
        Row: {
          created_at: string
          display_name: string
          id: string
          option_value: string
          product_field_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          option_value: string
          product_field_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          option_value?: string
          product_field_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_field_options_product_field_id_fkey"
            columns: ["product_field_id"]
            isOneToOne: false
            referencedRelation: "product_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fields: {
        Row: {
          created_at: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean
          product_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_name: string
          field_type: string
          id?: string
          is_required?: boolean
          product_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean
          product_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_fields_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_page_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          fields: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          fields: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          fields?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_pages: {
        Row: {
          batch_id: string | null
          created_at: string
          custom_fields: Json
          due_date: string
          file_name: string | null
          id: string
          job_number: string
          name: string
          pdf_url: string | null
          quantity: number
          status: Database["public"]["Enums"]["page_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          custom_fields?: Json
          due_date: string
          file_name?: string | null
          id?: string
          job_number: string
          name: string
          pdf_url?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["page_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          custom_fields?: Json
          due_date?: string
          file_name?: string | null
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["page_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pages_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "product_page_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specification_compatibility: {
        Row: {
          created_at: string
          id: string
          is_compatible: boolean
          is_default: boolean
          product_type: string
          specification_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_compatible?: boolean
          is_default?: boolean
          product_type: string
          specification_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_compatible?: boolean
          is_default?: boolean
          product_type?: string
          specification_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specification_compatibility_specification_id_fkey"
            columns: ["specification_id"]
            isOneToOne: false
            referencedRelation: "print_specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          color: string
          created_at: string
          icon_name: string
          id: string
          job_prefix: string
          name: string
          slug: string
          table_name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon_name?: string
          id?: string
          job_prefix: string
          name: string
          slug: string
          table_name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon_name?: string
          id?: string
          job_prefix?: string
          name?: string
          slug?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_category: string | null
          batch_ready: boolean | null
          category: string | null
          category_id: string | null
          created_at: string | null
          customer: string | null
          date: string | null
          due_date: string | null
          expedite_reason: string | null
          expedited_at: string | null
          expedited_by: string | null
          has_custom_workflow: boolean | null
          highlighted: boolean | null
          id: string
          is_batch_master: boolean | null
          is_expedited: boolean | null
          location: string | null
          manual_due_date: string | null
          manual_sla_days: number | null
          qr_code_data: string | null
          qr_code_url: string | null
          qt_no: string | null
          qty: number | null
          reference: string | null
          rep: string | null
          so_no: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          user_name: string | null
          wo_no: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_category?: string | null
          batch_ready?: boolean | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          customer?: string | null
          date?: string | null
          due_date?: string | null
          expedite_reason?: string | null
          expedited_at?: string | null
          expedited_by?: string | null
          has_custom_workflow?: boolean | null
          highlighted?: boolean | null
          id?: string
          is_batch_master?: boolean | null
          is_expedited?: boolean | null
          location?: string | null
          manual_due_date?: string | null
          manual_sla_days?: number | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qt_no?: string | null
          qty?: number | null
          reference?: string | null
          rep?: string | null
          so_no?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          user_name?: string | null
          wo_no: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_category?: string | null
          batch_ready?: boolean | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          customer?: string | null
          date?: string | null
          due_date?: string | null
          expedite_reason?: string | null
          expedited_at?: string | null
          expedited_by?: string | null
          has_custom_workflow?: boolean | null
          highlighted?: boolean | null
          id?: string
          is_batch_master?: boolean | null
          is_expedited?: boolean | null
          location?: string | null
          manual_due_date?: string | null
          manual_sla_days?: number | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qt_no?: string | null
          qty?: number | null
          reference?: string | null
          rep?: string | null
          so_no?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          user_name?: string | null
          wo_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stages: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_batch_stage: boolean | null
          is_conditional: boolean | null
          is_multi_part: boolean
          master_queue_id: string | null
          name: string
          order_index: number
          part_definitions: Json | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_batch_stage?: boolean | null
          is_conditional?: boolean | null
          is_multi_part?: boolean
          master_queue_id?: string | null
          name: string
          order_index?: number
          part_definitions?: Json | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_batch_stage?: boolean | null
          is_conditional?: boolean | null
          is_multi_part?: boolean
          master_queue_id?: string | null
          name?: string
          order_index?: number
          part_definitions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stages_master_queue_id_fkey"
            columns: ["master_queue_id"]
            isOneToOne: false
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      proof_links: {
        Row: {
          client_notes: string | null
          client_response: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_used: boolean
          job_id: string
          job_table_name: string
          responded_at: string | null
          stage_instance_id: string
          token: string
          updated_at: string
        }
        Insert: {
          client_notes?: string | null
          client_response?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          is_used?: boolean
          job_id: string
          job_table_name?: string
          responded_at?: string | null
          stage_instance_id: string
          token: string
          updated_at?: string
        }
        Update: {
          client_notes?: string | null
          client_response?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_used?: boolean
          job_id?: string
          job_table_name?: string
          responded_at?: string | null
          stage_instance_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_proof_links_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "job_stage_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sleeve_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string | null
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          single_sided: boolean
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string | null
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          single_sided?: boolean
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string | null
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          single_sided?: boolean
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sleeve_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_jobs: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_id: string | null
          batch_ready: boolean | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_id?: string | null
          batch_ready?: boolean | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          pdf_url?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticker_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_memberships: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_stage_permissions: {
        Row: {
          assigned_by: string | null
          can_edit: boolean
          can_manage: boolean
          can_view: boolean
          can_work: boolean
          created_at: string
          id: string
          production_stage_id: string
          updated_at: string
          user_group_id: string
        }
        Insert: {
          assigned_by?: string | null
          can_edit?: boolean
          can_manage?: boolean
          can_view?: boolean
          can_work?: boolean
          created_at?: string
          id?: string
          production_stage_id: string
          updated_at?: string
          user_group_id: string
        }
        Update: {
          assigned_by?: string | null
          can_edit?: boolean
          can_manage?: boolean
          can_view?: boolean
          can_work?: boolean
          created_at?: string
          id?: string
          production_stage_id?: string
          updated_at?: string
          user_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_stage_permissions_production_stage_id_fkey"
            columns: ["production_stage_id"]
            isOneToOne: false
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_stage_permissions_user_group_id_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permissions?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_batch_allocation_for_job: {
        Args: { p_job_id: string; p_job_table_name?: string }
        Returns: boolean
      }
      add_admin_role: {
        Args: { admin_user_id: string }
        Returns: boolean
      }
      advance_job_stage: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_current_stage_id: string
          p_completed_by?: string
          p_notes?: string
        }
        Returns: boolean
      }
      advance_job_stage_with_parts: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_current_stage_id: string
          p_part_assignments?: Json
          p_completed_by?: string
          p_notes?: string
        }
        Returns: boolean
      }
      advance_job_to_batch_allocation: {
        Args: {
          p_job_id: string
          p_job_table_name?: string
          p_completed_by?: string
        }
        Returns: boolean
      }
      any_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_user_start_new_job: {
        Args: { p_user_id: string; p_department_id: string }
        Returns: boolean
      }
      check_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_user_admin_status: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      check_user_is_admin: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      create_batch_master_job: {
        Args: {
          p_batch_id: string
          p_constituent_job_ids: string[]
          p_created_by?: string
        }
        Returns: string
      }
      expedite_job_factory_wide: {
        Args: {
          p_job_id: string
          p_expedite_reason: string
          p_expedited_by?: string
        }
        Returns: boolean
      }
      get_admin_status: {
        Args: { check_user_id?: string }
        Returns: {
          user_is_admin: boolean
          any_admin_exists: boolean
        }[]
      }
      get_admin_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_users: number
          admin_users: number
          regular_users: number
          users_without_profiles: number
          recent_signups: number
        }[]
      }
      get_all_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
        }[]
      }
      get_all_users_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
        }[]
      }
      get_all_users_with_complete_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
          full_name: string
          avatar_url: string
          role: string
          created_at: string
          last_sign_in_at: string
          email_confirmed_at: string
        }[]
      }
      get_all_users_with_roles: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
          full_name: string
          avatar_url: string
          role: string
          created_at: string
          last_sign_in_at: string
        }[]
      }
      get_category_usage_stats: {
        Args: { p_category_id: string }
        Returns: {
          production_jobs_count: number
          job_stage_instances_count: number
          category_production_stages_count: number
          can_delete: boolean
          blocking_reason: string
        }[]
      }
      get_compatible_specifications: {
        Args: { p_product_type: string; p_category: string }
        Returns: {
          id: string
          name: string
          display_name: string
          description: string
          properties: Json
          is_default: boolean
        }[]
      }
      get_department_job_queue: {
        Args: { p_department_id: string }
        Returns: {
          job_id: string
          job_table_name: string
          wo_no: string
          customer: string
          due_date: string
          status: string
          priority_order: number
          has_priority_override: boolean
          current_stage: string
          is_blocked: boolean
        }[]
      }
      get_job_rework_history: {
        Args: { p_job_id: string; p_job_table_name: string }
        Returns: {
          stage_name: string
          rework_count: number
          last_rework_reason: string
          total_reworks: number
        }[]
      }
      get_job_specifications: {
        Args: { p_job_id: string; p_job_table_name: string }
        Returns: {
          category: string
          specification_id: string
          name: string
          display_name: string
          properties: Json
          printer_id: string
          printer_name: string
        }[]
      }
      get_next_active_stage: {
        Args: { p_job_id: string; p_job_table_name: string }
        Returns: string
      }
      get_printing_stages_for_parts: {
        Args: Record<PropertyKey, never>
        Returns: {
          stage_id: string
          stage_name: string
          stage_color: string
          part_types: string[]
        }[]
      }
      get_user_accessible_jobs: {
        Args: {
          p_user_id?: string
          p_permission_type?: string
          p_status_filter?: string
          p_stage_filter?: string
        }
        Returns: {
          job_id: string
          wo_no: string
          customer: string
          status: string
          due_date: string
          reference: string
          category_id: string
          category_name: string
          category_color: string
          current_stage_id: string
          current_stage_name: string
          current_stage_color: string
          current_stage_status: string
          user_can_view: boolean
          user_can_edit: boolean
          user_can_work: boolean
          user_can_manage: boolean
          workflow_progress: number
          total_stages: number
          completed_stages: number
          display_stage_name: string
          qty: number
          started_by: string
          started_by_name: string
          proof_emailed_at: string
        }[]
      }
      get_user_accessible_jobs_with_batch_allocation: {
        Args: {
          p_user_id?: string
          p_permission_type?: string
          p_status_filter?: string
          p_stage_filter?: string
        }
        Returns: {
          job_id: string
          wo_no: string
          customer: string
          status: string
          due_date: string
          reference: string
          category_id: string
          category_name: string
          category_color: string
          current_stage_id: string
          current_stage_name: string
          current_stage_color: string
          current_stage_status: string
          user_can_view: boolean
          user_can_edit: boolean
          user_can_work: boolean
          user_can_manage: boolean
          workflow_progress: number
          total_stages: number
          completed_stages: number
          display_stage_name: string
          qty: number
          started_by: string
          started_by_name: string
          proof_emailed_at: string
          is_conditional_stage: boolean
          stage_should_show: boolean
          batch_ready: boolean
          is_batch_master: boolean
        }[]
      }
      get_user_accessible_jobs_with_conditional_stages: {
        Args: {
          p_user_id?: string
          p_permission_type?: string
          p_status_filter?: string
          p_stage_filter?: string
        }
        Returns: {
          job_id: string
          wo_no: string
          customer: string
          status: string
          due_date: string
          reference: string
          category_id: string
          category_name: string
          category_color: string
          current_stage_id: string
          current_stage_name: string
          current_stage_color: string
          current_stage_status: string
          user_can_view: boolean
          user_can_edit: boolean
          user_can_work: boolean
          user_can_manage: boolean
          workflow_progress: number
          total_stages: number
          completed_stages: number
          display_stage_name: string
          qty: number
          started_by: string
          started_by_name: string
          proof_emailed_at: string
          is_conditional_stage: boolean
          stage_should_show: boolean
          batch_ready: boolean
        }[]
      }
      get_user_accessible_stages: {
        Args: { p_user_id?: string }
        Returns: {
          stage_id: string
          stage_name: string
          stage_color: string
          can_view: boolean
          can_edit: boolean
          can_work: boolean
          can_manage: boolean
        }[]
      }
      get_user_accessible_stages_with_master_queue: {
        Args: { p_user_id?: string }
        Returns: {
          stage_id: string
          stage_name: string
          stage_color: string
          can_view: boolean
          can_edit: boolean
          can_work: boolean
          can_manage: boolean
          master_queue_id: string
          master_queue_name: string
        }[]
      }
      get_user_departments: {
        Args: { p_user_id?: string }
        Returns: {
          department_id: string
          department_name: string
          department_color: string
          allows_concurrent_jobs: boolean
          max_concurrent_jobs: number
        }[]
      }
      get_user_role_safe: {
        Args: { user_id_param: string }
        Returns: string
      }
      initialize_custom_job_stages: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_stage_ids: string[]
          p_stage_orders: number[]
        }
        Returns: boolean
      }
      initialize_job_stages: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_category_id: string
        }
        Returns: boolean
      }
      initialize_job_stages_auto: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_category_id: string
        }
        Returns: boolean
      }
      initialize_job_stages_with_part_assignments: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_category_id: string
          p_part_assignments: Json
        }
        Returns: boolean
      }
      initialize_job_stages_with_parts: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_category_id: string
        }
        Returns: boolean
      }
      inject_batch_allocation_stage_for_existing_jobs: {
        Args: Record<PropertyKey, never>
        Returns: {
          fixed_job_id: string
          wo_no: string
          category_name: string
          stages_added: number
        }[]
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_admin_secure_fixed: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_admin_simple: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_public_holiday: {
        Args: { check_date: string }
        Returns: boolean
      }
      is_user_admin: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      mark_job_ready_for_batching: {
        Args: { p_job_id: string; p_job_table_name: string; p_user_id?: string }
        Returns: boolean
      }
      reassign_jobs_to_category: {
        Args: {
          p_from_category_id: string
          p_to_category_id: string
          p_user_id?: string
        }
        Returns: {
          jobs_reassigned: number
          stages_updated: number
          success: boolean
          error_message: string
        }[]
      }
      remove_job_expedite_status: {
        Args: { p_job_id: string; p_removed_by?: string }
        Returns: boolean
      }
      repair_jobs_missing_stages: {
        Args: Record<PropertyKey, never>
        Returns: {
          repaired_job_id: string
          job_wo_no: string
          category_name: string
          stages_created: number
        }[]
      }
      reset_custom_workflow_stages_to_pending: {
        Args: Record<PropertyKey, never>
        Returns: {
          reset_job_id: string
          wo_no: string
          stages_reset: number
        }[]
      }
      revoke_user_role: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      rework_job_stage: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_current_stage_id: string
          p_target_stage_id: string
          p_rework_reason?: string
          p_reworked_by?: string
        }
        Returns: boolean
      }
      safe_delete_category: {
        Args: { p_category_id: string; p_user_id?: string }
        Returns: {
          success: boolean
          message: string
          deleted_stages: number
        }[]
      }
      set_user_role: {
        Args: { target_user_id: string; new_role: string }
        Returns: boolean
      }
      set_user_role_admin: {
        Args: { _target_user_id: string; _new_role: string }
        Returns: boolean
      }
      sync_profiles_with_auth: {
        Args: Record<PropertyKey, never>
        Returns: {
          synced_count: number
          fixed_count: number
        }[]
      }
      update_user_profile_admin: {
        Args: { _user_id: string; _full_name: string }
        Returns: boolean
      }
    }
    Enums: {
      batch_status:
        | "pending"
        | "processing"
        | "completed"
        | "cancelled"
        | "sent_to_print"
      lamination_type: "gloss" | "matt" | "soft_touch" | "none"
      page_status:
        | "queued"
        | "batched"
        | "completed"
        | "cancelled"
        | "sent_to_print"
      paper_type: "Matt" | "Gloss"
      printer_type: "HP 12000" | "HP 7900"
      production_status:
        | "Pre-Press"
        | "Printing"
        | "Finishing"
        | "Packaging"
        | "Shipped"
        | "Completed"
      sheet_size: "455x640mm" | "530x750mm" | "320x455mm"
      size_enum: "A6" | "A5" | "A4" | "DL" | "A3"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      batch_status: [
        "pending",
        "processing",
        "completed",
        "cancelled",
        "sent_to_print",
      ],
      lamination_type: ["gloss", "matt", "soft_touch", "none"],
      page_status: [
        "queued",
        "batched",
        "completed",
        "cancelled",
        "sent_to_print",
      ],
      paper_type: ["Matt", "Gloss"],
      printer_type: ["HP 12000", "HP 7900"],
      production_status: [
        "Pre-Press",
        "Printing",
        "Finishing",
        "Packaging",
        "Shipped",
        "Completed",
      ],
      sheet_size: ["455x640mm", "530x750mm", "320x455mm"],
      size_enum: ["A6", "A5", "A4", "DL", "A3"],
    },
  },
} as const

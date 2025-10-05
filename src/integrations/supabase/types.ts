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
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
      batch_allocation_logs: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          id: string
          job_id: string
          wo_no: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          id?: string
          job_id: string
          wo_no?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          id?: string
          job_id?: string
          wo_no?: string | null
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
          {
            foreignKeyName: "batch_job_references_production_job_id_fkey"
            columns: ["production_job_id"]
            isOneToOne: false
            referencedRelation: "v_jobs_ready_for_production"
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
          requires_part_assignment: boolean
          sla_target_days: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          requires_part_assignment?: boolean
          sla_target_days?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          requires_part_assignment?: boolean
          sla_target_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      category_production_stages: {
        Row: {
          category_id: string
          created_at: string
          estimated_duration_hours: number | null
          id: string
          is_conditional: boolean | null
          is_required: boolean
          production_stage_id: string
          skip_when_inactive: boolean | null
          stage_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          estimated_duration_hours?: number | null
          id?: string
          is_conditional?: boolean | null
          is_required?: boolean
          production_stage_id: string
          skip_when_inactive?: boolean | null
          stage_order: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          estimated_duration_hours?: number | null
          id?: string
          is_conditional?: boolean | null
          is_required?: boolean
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
      daily_workload: {
        Row: {
          capacity_utilization: number | null
          date: string
          id: string
          total_estimated_hours: number
          total_jobs: number
          updated_at: string
        }
        Insert: {
          capacity_utilization?: number | null
          date: string
          id?: string
          total_estimated_hours?: number
          total_jobs?: number
          updated_at?: string
        }
        Update: {
          capacity_utilization?: number | null
          date?: string
          id?: string
          total_estimated_hours?: number
          total_jobs?: number
          updated_at?: string
        }
        Relationships: []
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
      due_date_recalculation_queue: {
        Row: {
          created_at: string
          id: string
          job_id: string
          job_table_name: string
          processed: boolean | null
          processed_at: string | null
          trigger_reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          job_table_name?: string
          processed?: boolean | null
          processed_at?: string | null
          trigger_reason: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          job_table_name?: string
          processed?: boolean | null
          processed_at?: string | null
          trigger_reason?: string
        }
        Relationships: []
      }
      excel_import_mappings: {
        Row: {
          address_extraction_pattern: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          delivery_method_specification_id: string | null
          excel_text: string
          id: string
          is_collection_mapping: boolean | null
          is_verified: boolean
          mapping_type: Database["public"]["Enums"]["mapping_type"] | null
          paper_type_specification_id: string | null
          paper_weight_specification_id: string | null
          print_specification_id: string | null
          production_stage_id: string | null
          stage_specification_id: string | null
          updated_at: string
        }
        Insert: {
          address_extraction_pattern?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          delivery_method_specification_id?: string | null
          excel_text: string
          id?: string
          is_collection_mapping?: boolean | null
          is_verified?: boolean
          mapping_type?: Database["public"]["Enums"]["mapping_type"] | null
          paper_type_specification_id?: string | null
          paper_weight_specification_id?: string | null
          print_specification_id?: string | null
          production_stage_id?: string | null
          stage_specification_id?: string | null
          updated_at?: string
        }
        Update: {
          address_extraction_pattern?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          delivery_method_specification_id?: string | null
          excel_text?: string
          id?: string
          is_collection_mapping?: boolean | null
          is_verified?: boolean
          mapping_type?: Database["public"]["Enums"]["mapping_type"] | null
          paper_type_specification_id?: string | null
          paper_weight_specification_id?: string | null
          print_specification_id?: string | null
          production_stage_id?: string | null
          stage_specification_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excel_import_mappings_delivery_method_specification_id_fkey"
            columns: ["delivery_method_specification_id"]
            isOneToOne: false
            referencedRelation: "print_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excel_import_mappings_paper_type_specification_id_fkey"
            columns: ["paper_type_specification_id"]
            isOneToOne: false
            referencedRelation: "print_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excel_import_mappings_paper_weight_specification_id_fkey"
            columns: ["paper_weight_specification_id"]
            isOneToOne: false
            referencedRelation: "print_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excel_import_mappings_print_specification_id_fkey"
            columns: ["print_specification_id"]
            isOneToOne: false
            referencedRelation: "print_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excel_import_mappings_production_stage_id_fkey"
            columns: ["production_stage_id"]
            isOneToOne: false
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excel_import_mappings_stage_specification_id_fkey"
            columns: ["stage_specification_id"]
            isOneToOne: false
            referencedRelation: "stage_specifications"
            referencedColumns: ["id"]
          },
        ]
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
      hp12000_paper_sizes: {
        Row: {
          created_at: string
          dimensions: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimensions: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimensions?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          actual_duration_minutes: number | null
          category_id: string | null
          client_email: string | null
          client_name: string | null
          completed_at: string | null
          completed_by: string | null
          completion_percentage: number | null
          configuration_completeness_score: number | null
          created_at: string
          dependency_group: string | null
          estimated_duration_minutes: number | null
          held_at: string | null
          held_by: string | null
          hold_reason: string | null
          hp12000_paper_size_id: string | null
          id: string
          is_rework: boolean | null
          is_split_job: boolean | null
          job_id: string
          job_order_in_stage: number
          job_table_name: string
          notes: string | null
          part_assignment: string | null
          part_name: string | null
          part_type: string | null
          previous_stage_id: string | null
          printer_id: string | null
          production_stage_id: string
          proof_approved_manually_at: string | null
          proof_emailed_at: string | null
          proof_pdf_url: string | null
          qr_scan_data: Json | null
          quantity: number | null
          queue_position: number | null
          remaining_minutes: number | null
          rework_count: number | null
          rework_reason: string | null
          schedule_status: string | null
          scheduled_by_user_id: string | null
          scheduled_end_at: string | null
          scheduled_minutes: number | null
          scheduled_start_at: string | null
          scheduling_method: string | null
          setup_time_minutes: number | null
          split_job_part: number | null
          split_job_total_parts: number | null
          stage_order: number
          stage_specification_id: string | null
          started_at: string | null
          started_by: string | null
          status: string
          unique_stage_key: string | null
          updated_at: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          category_id?: string | null
          client_email?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_percentage?: number | null
          configuration_completeness_score?: number | null
          created_at?: string
          dependency_group?: string | null
          estimated_duration_minutes?: number | null
          held_at?: string | null
          held_by?: string | null
          hold_reason?: string | null
          hp12000_paper_size_id?: string | null
          id?: string
          is_rework?: boolean | null
          is_split_job?: boolean | null
          job_id: string
          job_order_in_stage?: number
          job_table_name: string
          notes?: string | null
          part_assignment?: string | null
          part_name?: string | null
          part_type?: string | null
          previous_stage_id?: string | null
          printer_id?: string | null
          production_stage_id: string
          proof_approved_manually_at?: string | null
          proof_emailed_at?: string | null
          proof_pdf_url?: string | null
          qr_scan_data?: Json | null
          quantity?: number | null
          queue_position?: number | null
          remaining_minutes?: number | null
          rework_count?: number | null
          rework_reason?: string | null
          schedule_status?: string | null
          scheduled_by_user_id?: string | null
          scheduled_end_at?: string | null
          scheduled_minutes?: number | null
          scheduled_start_at?: string | null
          scheduling_method?: string | null
          setup_time_minutes?: number | null
          split_job_part?: number | null
          split_job_total_parts?: number | null
          stage_order: number
          stage_specification_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          unique_stage_key?: string | null
          updated_at?: string
        }
        Update: {
          actual_duration_minutes?: number | null
          category_id?: string | null
          client_email?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_percentage?: number | null
          configuration_completeness_score?: number | null
          created_at?: string
          dependency_group?: string | null
          estimated_duration_minutes?: number | null
          held_at?: string | null
          held_by?: string | null
          hold_reason?: string | null
          hp12000_paper_size_id?: string | null
          id?: string
          is_rework?: boolean | null
          is_split_job?: boolean | null
          job_id?: string
          job_order_in_stage?: number
          job_table_name?: string
          notes?: string | null
          part_assignment?: string | null
          part_name?: string | null
          part_type?: string | null
          previous_stage_id?: string | null
          printer_id?: string | null
          production_stage_id?: string
          proof_approved_manually_at?: string | null
          proof_emailed_at?: string | null
          proof_pdf_url?: string | null
          qr_scan_data?: Json | null
          quantity?: number | null
          queue_position?: number | null
          remaining_minutes?: number | null
          rework_count?: number | null
          rework_reason?: string | null
          schedule_status?: string | null
          scheduled_by_user_id?: string | null
          scheduled_end_at?: string | null
          scheduled_minutes?: number | null
          scheduled_start_at?: string | null
          scheduling_method?: string | null
          setup_time_minutes?: number | null
          split_job_part?: number | null
          split_job_total_parts?: number | null
          stage_order?: number
          stage_specification_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          unique_stage_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_jobs_ready_for_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_instances_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_instances_hp12000_paper_size_id_fkey"
            columns: ["hp12000_paper_size_id"]
            isOneToOne: false
            referencedRelation: "hp12000_paper_sizes"
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
          {
            foreignKeyName: "job_stage_instances_stage_specification_id_fkey"
            columns: ["stage_specification_id"]
            isOneToOne: false
            referencedRelation: "stage_specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_availability: {
        Row: {
          capacity_hours: number
          created_at: string
          date: string
          downtime_end: string | null
          downtime_start: string | null
          id: string
          machine_name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity_hours?: number
          created_at?: string
          date: string
          downtime_end?: string | null
          downtime_start?: string | null
          id?: string
          machine_name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity_hours?: number
          created_at?: string
          date?: string
          downtime_end?: string | null
          downtime_start?: string | null
          id?: string
          machine_name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          contact: string | null
          created_at: string | null
          customer: string | null
          date: string | null
          delivery_specifications: Json | null
          due_date: string | null
          due_date_buffer_days: number | null
          due_date_locked: boolean | null
          due_date_warning_level: string | null
          expedite_reason: string | null
          expedited_at: string | null
          expedited_by: string | null
          finishing_specifications: Json | null
          has_custom_workflow: boolean | null
          highlighted: boolean | null
          id: string
          internal_completion_date: string | null
          is_batch_master: boolean | null
          is_expedited: boolean | null
          last_due_date_check: string | null
          location: string | null
          manual_due_date: string | null
          manual_sla_days: number | null
          operation_quantities: Json | null
          original_committed_due_date: string | null
          paper_specifications: Json | null
          prepress_specifications: Json | null
          printing_specifications: Json | null
          proof_approved_at: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          qt_no: string | null
          qty: number | null
          reference: string | null
          rep: string | null
          size: string | null
          so_no: string | null
          specification: string | null
          status: string | null
          tentative_due_date: string | null
          updated_at: string | null
          user_id: string
          user_name: string | null
          wo_no: string
          workflow_last_modified_at: string | null
          workflow_validation_status: string | null
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_category?: string | null
          batch_ready?: boolean | null
          category?: string | null
          category_id?: string | null
          contact?: string | null
          created_at?: string | null
          customer?: string | null
          date?: string | null
          delivery_specifications?: Json | null
          due_date?: string | null
          due_date_buffer_days?: number | null
          due_date_locked?: boolean | null
          due_date_warning_level?: string | null
          expedite_reason?: string | null
          expedited_at?: string | null
          expedited_by?: string | null
          finishing_specifications?: Json | null
          has_custom_workflow?: boolean | null
          highlighted?: boolean | null
          id?: string
          internal_completion_date?: string | null
          is_batch_master?: boolean | null
          is_expedited?: boolean | null
          last_due_date_check?: string | null
          location?: string | null
          manual_due_date?: string | null
          manual_sla_days?: number | null
          operation_quantities?: Json | null
          original_committed_due_date?: string | null
          paper_specifications?: Json | null
          prepress_specifications?: Json | null
          printing_specifications?: Json | null
          proof_approved_at?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qt_no?: string | null
          qty?: number | null
          reference?: string | null
          rep?: string | null
          size?: string | null
          so_no?: string | null
          specification?: string | null
          status?: string | null
          tentative_due_date?: string | null
          updated_at?: string | null
          user_id: string
          user_name?: string | null
          wo_no: string
          workflow_last_modified_at?: string | null
          workflow_validation_status?: string | null
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_category?: string | null
          batch_ready?: boolean | null
          category?: string | null
          category_id?: string | null
          contact?: string | null
          created_at?: string | null
          customer?: string | null
          date?: string | null
          delivery_specifications?: Json | null
          due_date?: string | null
          due_date_buffer_days?: number | null
          due_date_locked?: boolean | null
          due_date_warning_level?: string | null
          expedite_reason?: string | null
          expedited_at?: string | null
          expedited_by?: string | null
          finishing_specifications?: Json | null
          has_custom_workflow?: boolean | null
          highlighted?: boolean | null
          id?: string
          internal_completion_date?: string | null
          is_batch_master?: boolean | null
          is_expedited?: boolean | null
          last_due_date_check?: string | null
          location?: string | null
          manual_due_date?: string | null
          manual_sla_days?: number | null
          operation_quantities?: Json | null
          original_committed_due_date?: string | null
          paper_specifications?: Json | null
          prepress_specifications?: Json | null
          printing_specifications?: Json | null
          proof_approved_at?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qt_no?: string | null
          qty?: number | null
          reference?: string | null
          rep?: string | null
          size?: string | null
          so_no?: string | null
          specification?: string | null
          status?: string | null
          tentative_due_date?: string | null
          updated_at?: string | null
          user_id?: string
          user_name?: string | null
          wo_no?: string
          workflow_last_modified_at?: string | null
          workflow_validation_status?: string | null
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
      production_schedule: {
        Row: {
          available_hours: number | null
          created_at: string
          date: string
          id: string
          is_working_day: boolean
          notes: string | null
          scheduled_hours: number
          total_capacity_hours: number
          updated_at: string
        }
        Insert: {
          available_hours?: number | null
          created_at?: string
          date: string
          id?: string
          is_working_day?: boolean
          notes?: string | null
          scheduled_hours?: number
          total_capacity_hours?: number
          updated_at?: string
        }
        Update: {
          available_hours?: number | null
          created_at?: string
          date?: string
          id?: string
          is_working_day?: boolean
          notes?: string | null
          scheduled_hours?: number
          total_capacity_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      production_stage_queues: {
        Row: {
          active_jobs_count: number
          created_at: string
          id: string
          last_updated: string
          next_available_time: string
          production_stage_id: string
          total_scheduled_minutes: number
        }
        Insert: {
          active_jobs_count?: number
          created_at?: string
          id?: string
          last_updated?: string
          next_available_time?: string
          production_stage_id: string
          total_scheduled_minutes?: number
        }
        Update: {
          active_jobs_count?: number
          created_at?: string
          id?: string
          last_updated?: string
          next_available_time?: string
          production_stage_id?: string
          total_scheduled_minutes?: number
        }
        Relationships: []
      }
      production_stages: {
        Row: {
          allow_gap_filling: boolean | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          ignore_excel_quantity: boolean | null
          is_active: boolean
          make_ready_time_minutes: number | null
          name: string
          order_index: number
          running_speed_per_hour: number | null
          speed_unit: string | null
          stage_group_id: string | null
          supports_multi_specifications: boolean | null
          supports_parts: boolean
          updated_at: string
        }
        Insert: {
          allow_gap_filling?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ignore_excel_quantity?: boolean | null
          is_active?: boolean
          make_ready_time_minutes?: number | null
          name: string
          order_index?: number
          running_speed_per_hour?: number | null
          speed_unit?: string | null
          stage_group_id?: string | null
          supports_multi_specifications?: boolean | null
          supports_parts?: boolean
          updated_at?: string
        }
        Update: {
          allow_gap_filling?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ignore_excel_quantity?: boolean | null
          is_active?: boolean
          make_ready_time_minutes?: number | null
          name?: string
          order_index?: number
          running_speed_per_hour?: number | null
          speed_unit?: string | null
          stage_group_id?: string | null
          supports_multi_specifications?: boolean | null
          supports_parts?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stages_stage_group_id_fkey"
            columns: ["stage_group_id"]
            isOneToOne: false
            referencedRelation: "stage_groups"
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
          {
            foreignKeyName: "fk_proof_links_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_job_stage_windows"
            referencedColumns: ["stage_instance_id"]
          },
          {
            foreignKeyName: "fk_proof_links_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_schedule_precedence_violations"
            referencedColumns: ["stage_instance_id"]
          },
          {
            foreignKeyName: "fk_proof_links_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_scheduler_stages_ready"
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
      schedule_gap_fills: {
        Row: {
          created_at: string | null
          days_saved: number
          gap_filled_start: string
          id: string
          job_id: string
          minutes_saved: number
          original_scheduled_start: string
          production_stage_id: string
          scheduler_run_type: string
          stage_instance_id: string
        }
        Insert: {
          created_at?: string | null
          days_saved: number
          gap_filled_start: string
          id?: string
          job_id: string
          minutes_saved: number
          original_scheduled_start: string
          production_stage_id: string
          scheduler_run_type: string
          stage_instance_id: string
        }
        Update: {
          created_at?: string | null
          days_saved?: number
          gap_filled_start?: string
          id?: string
          job_id?: string
          minutes_saved?: number
          original_scheduled_start?: string
          production_stage_id?: string
          scheduler_run_type?: string
          stage_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_gap_fills_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "job_stage_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_gap_fills_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_job_stage_windows"
            referencedColumns: ["stage_instance_id"]
          },
          {
            foreignKeyName: "fk_gap_fills_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_schedule_precedence_violations"
            referencedColumns: ["stage_instance_id"]
          },
          {
            foreignKeyName: "fk_gap_fills_stage_instance"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_scheduler_stages_ready"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_webhook_log: {
        Row: {
          created_at: string
          error_text: string | null
          event: string | null
          http_error: string | null
          http_status: number | null
          id: number
          job_id: string | null
          logged_at: string
          order_no: string | null
          request_body: Json | null
          request_id: number | null
          response_body: string | null
          response_excerpt: string | null
        }
        Insert: {
          created_at?: string
          error_text?: string | null
          event?: string | null
          http_error?: string | null
          http_status?: number | null
          id?: number
          job_id?: string | null
          logged_at?: string
          order_no?: string | null
          request_body?: Json | null
          request_id?: number | null
          response_body?: string | null
          response_excerpt?: string | null
        }
        Update: {
          created_at?: string
          error_text?: string | null
          event?: string | null
          http_error?: string | null
          http_status?: number | null
          id?: number
          job_id?: string | null
          logged_at?: string
          order_no?: string | null
          request_body?: Json | null
          request_id?: number | null
          response_body?: string | null
          response_excerpt?: string | null
        }
        Relationships: []
      }
      scheduling_decision_logs: {
        Row: {
          alternative_slots: Json | null
          assigned_end_time: string | null
          assigned_start_time: string | null
          created_at: string
          decision_factors: Json | null
          decision_reasoning: string | null
          decision_timestamp: string
          decision_type: string
          duration_minutes: number | null
          id: string
          job_id: string
          job_table_name: string
          requested_start_time: string | null
          scheduler_version: string | null
          stage_capacity_info: Json | null
          stage_id: string
        }
        Insert: {
          alternative_slots?: Json | null
          assigned_end_time?: string | null
          assigned_start_time?: string | null
          created_at?: string
          decision_factors?: Json | null
          decision_reasoning?: string | null
          decision_timestamp?: string
          decision_type: string
          duration_minutes?: number | null
          id?: string
          job_id: string
          job_table_name?: string
          requested_start_time?: string | null
          scheduler_version?: string | null
          stage_capacity_info?: Json | null
          stage_id: string
        }
        Update: {
          alternative_slots?: Json | null
          assigned_end_time?: string | null
          assigned_start_time?: string | null
          created_at?: string
          decision_factors?: Json | null
          decision_reasoning?: string | null
          decision_timestamp?: string
          decision_type?: string
          duration_minutes?: number | null
          id?: string
          job_id?: string
          job_table_name?: string
          requested_start_time?: string | null
          scheduler_version?: string | null
          stage_capacity_info?: Json | null
          stage_id?: string
        }
        Relationships: []
      }
      scheduling_integrity_logs: {
        Row: {
          detected_at: string
          id: string
          job_id: string | null
          resolved_at: string | null
          severity: string
          stage_id: string | null
          violation_details: Json | null
          violation_type: string
        }
        Insert: {
          detected_at?: string
          id?: string
          job_id?: string | null
          resolved_at?: string | null
          severity?: string
          stage_id?: string | null
          violation_details?: Json | null
          violation_type: string
        }
        Update: {
          detected_at?: string
          id?: string
          job_id?: string | null
          resolved_at?: string | null
          severity?: string
          stage_id?: string | null
          violation_details?: Json | null
          violation_type?: string
        }
        Relationships: []
      }
      shift_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          is_working_day: boolean
          lunch_break_duration_minutes: number | null
          lunch_break_start_time: string | null
          shift_end_time: string
          shift_start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          is_working_day?: boolean
          lunch_break_duration_minutes?: number | null
          lunch_break_start_time?: string | null
          shift_end_time?: string
          shift_start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          is_working_day?: boolean
          lunch_break_duration_minutes?: number | null
          lunch_break_start_time?: string | null
          shift_end_time?: string
          shift_start_time?: string
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
      stage_capacity_profiles: {
        Row: {
          created_at: string
          daily_capacity_hours: number
          efficiency_factor: number
          id: string
          is_bottleneck: boolean
          max_parallel_jobs: number
          production_stage_id: string
          setup_time_minutes: number
          shift_hours_per_day: number
          updated_at: string
          working_days_per_week: number
        }
        Insert: {
          created_at?: string
          daily_capacity_hours?: number
          efficiency_factor?: number
          id?: string
          is_bottleneck?: boolean
          max_parallel_jobs?: number
          production_stage_id: string
          setup_time_minutes?: number
          shift_hours_per_day?: number
          updated_at?: string
          working_days_per_week?: number
        }
        Update: {
          created_at?: string
          daily_capacity_hours?: number
          efficiency_factor?: number
          id?: string
          is_bottleneck?: boolean
          max_parallel_jobs?: number
          production_stage_id?: string
          setup_time_minutes?: number
          shift_hours_per_day?: number
          updated_at?: string
          working_days_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_stage_capacity_profiles_production_stage_id"
            columns: ["production_stage_id"]
            isOneToOne: true
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_capacity_snapshots: {
        Row: {
          active_jobs_count: number
          available_capacity_minutes: number
          capacity_warnings: Json | null
          created_at: string
          id: string
          pending_jobs_count: number
          scheduled_jobs: Json | null
          snapshot_date: string
          snapshot_timestamp: string
          stage_id: string
          total_capacity_minutes: number
          used_capacity_minutes: number
          utilization_percentage: number
        }
        Insert: {
          active_jobs_count?: number
          available_capacity_minutes?: number
          capacity_warnings?: Json | null
          created_at?: string
          id?: string
          pending_jobs_count?: number
          scheduled_jobs?: Json | null
          snapshot_date: string
          snapshot_timestamp?: string
          stage_id: string
          total_capacity_minutes: number
          used_capacity_minutes?: number
          utilization_percentage?: number
        }
        Update: {
          active_jobs_count?: number
          available_capacity_minutes?: number
          capacity_warnings?: Json | null
          created_at?: string
          id?: string
          pending_jobs_count?: number
          scheduled_jobs?: Json | null
          snapshot_date?: string
          snapshot_timestamp?: string
          stage_id?: string
          total_capacity_minutes?: number
          used_capacity_minutes?: number
          utilization_percentage?: number
        }
        Relationships: []
      }
      stage_groups: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          parallel_processing_enabled: boolean
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parallel_processing_enabled?: boolean
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parallel_processing_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      stage_queue_positions: {
        Row: {
          created_at: string
          duration_minutes: number
          estimated_end_time: string | null
          estimated_start_time: string | null
          id: string
          job_id: string
          job_table_name: string
          production_stage_id: string
          queue_position: number
          stage_instance_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          estimated_end_time?: string | null
          estimated_start_time?: string | null
          id?: string
          job_id: string
          job_table_name?: string
          production_stage_id: string
          queue_position: number
          stage_instance_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          estimated_end_time?: string | null
          estimated_start_time?: string | null
          id?: string
          job_id?: string
          job_table_name?: string
          production_stage_id?: string
          queue_position?: number
          stage_instance_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stage_specifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ignore_excel_quantity: boolean | null
          is_active: boolean
          make_ready_time_minutes: number | null
          name: string
          production_stage_id: string
          properties: Json | null
          running_speed_per_hour: number | null
          speed_unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ignore_excel_quantity?: boolean | null
          is_active?: boolean
          make_ready_time_minutes?: number | null
          name: string
          production_stage_id: string
          properties?: Json | null
          running_speed_per_hour?: number | null
          speed_unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ignore_excel_quantity?: boolean | null
          is_active?: boolean
          make_ready_time_minutes?: number | null
          name?: string
          production_stage_id?: string
          properties?: Json | null
          running_speed_per_hour?: number | null
          speed_unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_specifications_production_stage_id_fkey"
            columns: ["production_stage_id"]
            isOneToOne: false
            referencedRelation: "production_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_sub_tasks: {
        Row: {
          actual_duration_minutes: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          estimated_duration_minutes: number | null
          id: string
          notes: string | null
          quantity: number | null
          stage_instance_id: string
          stage_specification_id: string | null
          started_at: string | null
          started_by: string | null
          status: string
          sub_task_order: number
          updated_at: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          quantity?: number | null
          stage_instance_id: string
          stage_specification_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          sub_task_order?: number
          updated_at?: string
        }
        Update: {
          actual_duration_minutes?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          quantity?: number | null
          stage_instance_id?: string
          stage_specification_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          sub_task_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_sub_tasks_stage_instance_id_fkey"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "job_stage_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_sub_tasks_stage_instance_id_fkey"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_job_stage_windows"
            referencedColumns: ["stage_instance_id"]
          },
          {
            foreignKeyName: "stage_sub_tasks_stage_instance_id_fkey"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_schedule_precedence_violations"
            referencedColumns: ["stage_instance_id"]
          },
          {
            foreignKeyName: "stage_sub_tasks_stage_instance_id_fkey"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "v_scheduler_stages_ready"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_sub_tasks_stage_specification_id_fkey"
            columns: ["stage_specification_id"]
            isOneToOne: false
            referencedRelation: "stage_specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_time_slots: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number
          id: string
          is_completed: boolean
          job_id: string | null
          job_table_name: string | null
          production_stage_id: string
          slot_end_time: string
          slot_start_time: string
          stage_instance_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          duration_minutes: number
          id?: string
          is_completed?: boolean
          job_id?: string | null
          job_table_name?: string | null
          production_stage_id: string
          slot_end_time: string
          slot_start_time: string
          stage_instance_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          is_completed?: boolean
          job_id?: string | null
          job_table_name?: string | null
          production_stage_id?: string
          slot_end_time?: string
          slot_start_time?: string
          stage_instance_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stage_workload_tracking: {
        Row: {
          active_jobs_count: number
          available_hours: number
          calculated_at: string
          committed_hours: number
          date: string
          id: string
          pending_jobs_count: number
          production_stage_id: string
          queue_ends_at: string | null
          queue_length_hours: number
          updated_at: string
        }
        Insert: {
          active_jobs_count?: number
          available_hours?: number
          calculated_at?: string
          committed_hours?: number
          date: string
          id?: string
          pending_jobs_count?: number
          production_stage_id: string
          queue_ends_at?: string | null
          queue_length_hours?: number
          updated_at?: string
        }
        Update: {
          active_jobs_count?: number
          available_hours?: number
          calculated_at?: string
          committed_hours?: number
          date?: string
          id?: string
          pending_jobs_count?: number
          production_stage_id?: string
          queue_ends_at?: string | null
          queue_length_hours?: number
          updated_at?: string
        }
        Relationships: []
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
      v_job_stage_windows: {
        Row: {
          first_slot: string | null
          job_id: string | null
          last_slot: string | null
          prev_end: string | null
          production_stage_id: string | null
          stage_instance_id: string | null
          stage_order: number | null
          wo_no: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_jobs_ready_for_production"
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
      v_jobs_ready_for_production: {
        Row: {
          batch_allocated_at: string | null
          batch_allocated_by: string | null
          batch_category: string | null
          batch_ready: boolean | null
          category: string | null
          category_id: string | null
          contact: string | null
          created_at: string | null
          customer: string | null
          date: string | null
          delivery_specifications: Json | null
          due_date: string | null
          due_date_buffer_days: number | null
          due_date_locked: boolean | null
          due_date_warning_level: string | null
          expedite_reason: string | null
          expedited_at: string | null
          expedited_by: string | null
          finishing_specifications: Json | null
          has_custom_workflow: boolean | null
          highlighted: boolean | null
          id: string | null
          internal_completion_date: string | null
          is_batch_master: boolean | null
          is_expedited: boolean | null
          is_ready_for_production: boolean | null
          last_due_date_check: string | null
          location: string | null
          manual_due_date: string | null
          manual_sla_days: number | null
          operation_quantities: Json | null
          paper_specifications: Json | null
          prepress_specifications: Json | null
          printing_specifications: Json | null
          proof_approved_at: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          qt_no: string | null
          qty: number | null
          reference: string | null
          rep: string | null
          size: string | null
          so_no: string | null
          specification: string | null
          status: string | null
          tentative_due_date: string | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
          wo_no: string | null
        }
        Insert: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_category?: string | null
          batch_ready?: boolean | null
          category?: string | null
          category_id?: string | null
          contact?: string | null
          created_at?: string | null
          customer?: string | null
          date?: string | null
          delivery_specifications?: Json | null
          due_date?: string | null
          due_date_buffer_days?: number | null
          due_date_locked?: boolean | null
          due_date_warning_level?: string | null
          expedite_reason?: string | null
          expedited_at?: string | null
          expedited_by?: string | null
          finishing_specifications?: Json | null
          has_custom_workflow?: boolean | null
          highlighted?: boolean | null
          id?: string | null
          internal_completion_date?: string | null
          is_batch_master?: boolean | null
          is_expedited?: boolean | null
          is_ready_for_production?: never
          last_due_date_check?: string | null
          location?: string | null
          manual_due_date?: string | null
          manual_sla_days?: number | null
          operation_quantities?: Json | null
          paper_specifications?: Json | null
          prepress_specifications?: Json | null
          printing_specifications?: Json | null
          proof_approved_at?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qt_no?: string | null
          qty?: number | null
          reference?: string | null
          rep?: string | null
          size?: string | null
          so_no?: string | null
          specification?: string | null
          status?: string | null
          tentative_due_date?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
          wo_no?: string | null
        }
        Update: {
          batch_allocated_at?: string | null
          batch_allocated_by?: string | null
          batch_category?: string | null
          batch_ready?: boolean | null
          category?: string | null
          category_id?: string | null
          contact?: string | null
          created_at?: string | null
          customer?: string | null
          date?: string | null
          delivery_specifications?: Json | null
          due_date?: string | null
          due_date_buffer_days?: number | null
          due_date_locked?: boolean | null
          due_date_warning_level?: string | null
          expedite_reason?: string | null
          expedited_at?: string | null
          expedited_by?: string | null
          finishing_specifications?: Json | null
          has_custom_workflow?: boolean | null
          highlighted?: boolean | null
          id?: string | null
          internal_completion_date?: string | null
          is_batch_master?: boolean | null
          is_expedited?: boolean | null
          is_ready_for_production?: never
          last_due_date_check?: string | null
          location?: string | null
          manual_due_date?: string | null
          manual_sla_days?: number | null
          operation_quantities?: Json | null
          paper_specifications?: Json | null
          prepress_specifications?: Json | null
          printing_specifications?: Json | null
          proof_approved_at?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qt_no?: string | null
          qty?: number | null
          reference?: string | null
          rep?: string | null
          size?: string | null
          so_no?: string | null
          specification?: string | null
          status?: string | null
          tentative_due_date?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
          wo_no?: string | null
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
      v_schedule_precedence_violations: {
        Row: {
          job_id: string | null
          max_prev_end: string | null
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          stage_instance_id: string | null
          stage_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_jobs_ready_for_production"
            referencedColumns: ["id"]
          },
        ]
      }
      v_scheduler_stages_ready: {
        Row: {
          actual_duration_minutes: number | null
          category_id: string | null
          client_email: string | null
          client_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          dependency_group: string | null
          estimated_duration_minutes: number | null
          id: string | null
          is_rework: boolean | null
          is_split_job: boolean | null
          job_id: string | null
          job_order_in_stage: number | null
          job_table_name: string | null
          notes: string | null
          part_assignment: string | null
          part_name: string | null
          part_type: string | null
          previous_stage_id: string | null
          printer_id: string | null
          production_stage_id: string | null
          proof_approved_manually_at: string | null
          proof_emailed_at: string | null
          proof_pdf_url: string | null
          qr_scan_data: Json | null
          quantity: number | null
          queue_position: number | null
          rework_count: number | null
          rework_reason: string | null
          schedule_status: string | null
          scheduled_by_user_id: string | null
          scheduled_end_at: string | null
          scheduled_minutes: number | null
          scheduled_start_at: string | null
          scheduling_method: string | null
          setup_time_minutes: number | null
          split_job_part: number | null
          split_job_total_parts: number | null
          stage_group: string | null
          stage_name: string | null
          stage_order: number | null
          stage_specification_id: string | null
          started_at: string | null
          started_by: string | null
          status: string | null
          unique_stage_key: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_stage_instances_production_jobs"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_jobs_ready_for_production"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "job_stage_instances_stage_specification_id_fkey"
            columns: ["stage_specification_id"]
            isOneToOne: false
            referencedRelation: "stage_specifications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _prev_stage_end: {
        Args: { p_stage_instance_id: string }
        Returns: string
      }
      _schedule_job_via_edge: {
        Args: { p_event?: string; p_job_id: string }
        Returns: Json
      }
      activate_batch_allocation_for_job: {
        Args: { p_job_id: string; p_job_table_name?: string }
        Returns: boolean
      }
      add_admin_role: {
        Args: { admin_user_id: string }
        Returns: boolean
      }
      add_working_days_to_timestamp: {
        Args: { p_days_to_add: number; p_start_timestamp: string }
        Returns: string
      }
      advance_job_stage: {
        Args: {
          p_actual_duration_minutes?: number
          p_completed_by?: string
          p_current_stage_id: string
          p_job_id: string
          p_job_table_name: string
          p_notes?: string
        }
        Returns: boolean
      }
      advance_job_stage_with_groups: {
        Args: {
          p_completed_by?: string
          p_current_stage_id: string
          p_job_id: string
          p_job_table_name: string
          p_notes?: string
        }
        Returns: boolean
      }
      advance_job_stage_with_parallel_support: {
        Args: {
          p_current_stage_id: string
          p_job_id: string
          p_job_table_name: string
          p_notes?: string
        }
        Returns: boolean
      }
      advance_job_stage_with_parts: {
        Args: {
          p_completed_by?: string
          p_current_stage_id: string
          p_job_id: string
          p_job_table_name: string
          p_notes?: string
        }
        Returns: boolean
      }
      advance_job_to_batch_allocation: {
        Args: {
          p_completed_by?: string
          p_job_id: string
          p_job_table_name?: string
        }
        Returns: boolean
      }
      advance_parallel_job_stage: {
        Args: {
          p_completed_by?: string
          p_current_stage_id: string
          p_job_id: string
          p_job_table_name: string
          p_notes?: string
        }
        Returns: boolean
      }
      any_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      apply_stage_updates_safe: {
        Args: {
          as_proposed?: boolean
          commit?: boolean
          only_if_unset?: boolean
          updates: Json
        }
        Returns: Json
      }
      audit_job_stage_ordering: {
        Args: Record<PropertyKey, never>
        Returns: {
          dependency_groups: string[]
          has_duplicates: boolean
          has_gaps: boolean
          job_id: string
          part_assignments: string[]
          stage_orders: number[]
          wo_no: string
        }[]
      }
      batch_update_stage_instances: {
        Args: { p_job_id: string; p_updates: Json[] }
        Returns: {
          errors: string[]
          updated_count: number
        }[]
      }
      bulk_recalculate_job_due_dates: {
        Args: Record<PropertyKey, never>
        Returns: {
          estimated_hours: number
          new_due_date: string
          old_due_date: string
          updated_job_id: string
        }[]
      }
      calculate_smart_due_date: {
        Args: { p_estimated_hours: number; p_priority?: number }
        Returns: string
      }
      calculate_stage_duration: {
        Args: {
          p_make_ready_time_minutes?: number
          p_quantity: number
          p_running_speed_per_hour: number
          p_speed_unit?: string
        }
        Returns: number
      }
      calculate_stage_duration_with_type: {
        Args: {
          p_make_ready_time_minutes?: number
          p_quantity: number
          p_quantity_type?: string
          p_running_speed_per_hour: number
          p_speed_unit?: string
        }
        Returns: number
      }
      calculate_stage_queue_workload: {
        Args: { p_production_stage_id: string } | { stage_ids: string[] }
        Returns: {
          active_jobs_count: number
          earliest_available_slot: string
          pending_jobs_count: number
          queue_processing_hours: number
          stage_id: string
          total_active_hours: number
          total_pending_hours: number
        }[]
      }
      can_user_start_new_job: {
        Args: { p_department_id: string; p_user_id: string }
        Returns: boolean
      }
      carry_forward_overdue_active_jobs: {
        Args: Record<PropertyKey, never>
        Returns: {
          carried_forward_count: number
          job_details: string[]
        }[]
      }
      check_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_dependency_completion: {
        Args: {
          p_dependency_group: string
          p_job_id: string
          p_job_table_name: string
        }
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
      cleanup_corrupted_batch_jobs: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      clear_all_stage_time_slots: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_instances_count: number
          deleted_slots_count: number
        }[]
      }
      clear_non_completed_scheduling_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          cleared_instances: number
          cleared_slots: number
        }[]
      }
      consolidate_excel_mappings: {
        Args: Record<PropertyKey, never>
        Returns: {
          conflict_count: number
          consolidation_log: Json
          merged_count: number
        }[]
      }
      create_batch_master_job: {
        Args:
          | { p_batch_id: string; p_constituent_job_ids: string[] }
          | {
              p_batch_id: string
              p_constituent_job_ids: string[]
              p_created_by?: string
            }
        Returns: string
      }
      create_batch_master_job_simple: {
        Args: { p_batch_id: string }
        Returns: string
      }
      create_enhanced_batch_master_job: {
        Args: { p_batch_id: string; p_created_by?: string }
        Returns: {
          constituent_jobs_count: number
          master_job_id: string
          printing_stage_id: string
        }[]
      }
      create_stage_availability_tracker: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cron_nightly_reschedule: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cron_nightly_reschedule_with_carryforward: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_production_jobs: {
        Args: { job_ids: string[] }
        Returns: Json
      }
      expedite_job_factory_wide: {
        Args: {
          p_expedite_reason: string
          p_expedited_by?: string
          p_job_id: string
        }
        Returns: boolean
      }
      explain_job_scheduling: {
        Args: { p_job_id: string; p_job_table_name?: string }
        Returns: {
          alternative_options: string[]
          decision_factors: Json
          explanation: string
          scheduled_time: string
          stage_name: string
        }[]
      }
      export_scheduler_input: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      find_available_gaps: {
        Args:
          | {
              p_align_at?: string
              p_duration_minutes: number
              p_fifo_start_time: string
              p_lookback_days?: number
              p_stage_id: string
            }
          | {
              p_duration_minutes: number
              p_fifo_start_time: string
              p_lookback_days?: number
              p_stage_id: string
            }
        Returns: {
          days_earlier: number
          gap_capacity_minutes: number
          gap_end: string
          gap_start: string
        }[]
      }
      fix_category_stage_ordering: {
        Args: { p_category_id: string }
        Returns: Json
      }
      fix_existing_cover_text_workflows: {
        Args: Record<PropertyKey, never>
        Returns: {
          dependency_group_assigned: string
          fixed_job_id: string
          stages_updated: number
          wo_no: string
        }[]
      }
      fix_job_stage_ordering: {
        Args: Record<PropertyKey, never>
        Returns: {
          jobs_fixed: number
          stages_updated: number
        }[]
      }
      get_actual_stage_end_time: {
        Args: { p_stage_instance_id: string }
        Returns: string
      }
      get_admin_status: {
        Args: { check_user_id?: string }
        Returns: {
          any_admin_exists: boolean
          user_is_admin: boolean
        }[]
      }
      get_admin_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          admin_users: number
          recent_signups: number
          regular_users: number
          total_users: number
          users_without_profiles: number
        }[]
      }
      get_all_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          id: string
        }[]
      }
      get_all_users_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          id: string
        }[]
      }
      get_all_users_with_complete_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          email_confirmed_at: string
          full_name: string
          id: string
          last_sign_in_at: string
          role: string
        }[]
      }
      get_all_users_with_roles: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          role: string
        }[]
      }
      get_available_stages_for_activation: {
        Args: { p_job_id: string; p_job_table_name: string }
        Returns: {
          blocking_reason: string
          can_activate: boolean
          part_assignment: string
          stage_id: string
          stage_name: string
          stage_order: number
        }[]
      }
      get_category_usage_stats: {
        Args: { p_category_id: string }
        Returns: {
          blocking_reason: string
          can_delete: boolean
          category_production_stages_count: number
          job_stage_instances_count: number
          production_jobs_count: number
        }[]
      }
      get_compatible_specifications: {
        Args: { p_category: string; p_product_type: string }
        Returns: {
          description: string
          display_name: string
          id: string
          is_default: boolean
          name: string
          properties: Json
        }[]
      }
      get_department_job_queue: {
        Args: { p_department_id: string }
        Returns: {
          current_stage: string
          customer: string
          due_date: string
          has_priority_override: boolean
          is_blocked: boolean
          job_id: string
          job_table_name: string
          priority_order: number
          status: string
          wo_no: string
        }[]
      }
      get_job_hp12000_stages: {
        Args: { p_job_id: string }
        Returns: {
          is_paper_size_required: boolean
          paper_size_id: string
          paper_size_name: string
          paper_specifications: Json
          part_assignment: string
          part_name: string
          printing_specifications: Json
          production_stage_id: string
          stage_instance_id: string
          stage_name: string
          stage_order: number
        }[]
      }
      get_job_rework_history: {
        Args: { p_job_id: string; p_job_table_name: string }
        Returns: {
          last_rework_reason: string
          rework_count: number
          stage_name: string
          total_reworks: number
        }[]
      }
      get_job_specifications: {
        Args: { p_job_id: string; p_job_table_name: string }
        Returns: {
          category: string
          display_name: string
          name: string
          printer_id: string
          printer_name: string
          properties: Json
          specification_id: string
        }[]
      }
      get_next_active_stage: {
        Args: { p_job_id: string; p_job_table_name: string }
        Returns: string
      }
      get_next_capacity_slot: {
        Args: {
          p_duration_minutes: number
          p_earliest_date?: string
          p_stage_id: string
        }
        Returns: {
          date_scheduled: string
          end_time: string
          start_time: string
        }[]
      }
      get_stage_next_available_time: {
        Args: { p_stage_id: string }
        Returns: string
      }
      get_stage_sub_tasks: {
        Args: { p_stage_instance_id: string }
        Returns: {
          actual_duration_minutes: number
          completed_at: string
          completed_by: string
          estimated_duration_minutes: number
          id: string
          notes: string
          quantity: number
          specification_name: string
          stage_instance_id: string
          stage_specification_id: string
          started_at: string
          started_by: string
          status: string
          sub_task_order: number
        }[]
      }
      get_user_accessible_jobs: {
        Args: {
          p_permission_type?: string
          p_stage_filter?: string
          p_status_filter?: string
          p_user_id?: string
        }
        Returns: {
          batch_category: string
          batch_name: string
          category_color: string
          category_id: string
          category_name: string
          completed_stages: number
          constituent_job_count: number
          contact: string
          current_stage_color: string
          current_stage_id: string
          current_stage_name: string
          current_stage_status: string
          customer: string
          display_stage_name: string
          due_date: string
          has_custom_workflow: boolean
          is_batch_master: boolean
          is_in_batch_processing: boolean
          job_id: string
          manual_due_date: string
          proof_approved_at: string
          proof_emailed_at: string
          qty: number
          reference: string
          started_by: string
          started_by_name: string
          status: string
          total_stages: number
          user_can_edit: boolean
          user_can_manage: boolean
          user_can_view: boolean
          user_can_work: boolean
          wo_no: string
          workflow_progress: number
        }[]
      }
      get_user_accessible_jobs_with_batch_allocation: {
        Args: {
          p_permission_type?: string
          p_stage_filter?: string
          p_status_filter?: string
          p_user_id?: string
        }
        Returns: {
          batch_category: string
          batch_name: string
          category_color: string
          category_id: string
          category_name: string
          completed_stages: number
          constituent_job_count: number
          contact: string
          current_stage_color: string
          current_stage_id: string
          current_stage_name: string
          current_stage_status: string
          customer: string
          display_stage_name: string
          due_date: string
          effectiveduedate: string
          has_custom_workflow: boolean
          is_batch_master: boolean
          is_in_batch_processing: boolean
          job_id: string
          manual_due_date: string
          proof_emailed_at: string
          qty: number
          reference: string
          started_by: string
          started_by_name: string
          status: string
          total_stages: number
          user_can_edit: boolean
          user_can_manage: boolean
          user_can_view: boolean
          user_can_work: boolean
          wo_no: string
          workflow_progress: number
        }[]
      }
      get_user_accessible_stages: {
        Args: { p_user_id?: string }
        Returns: {
          can_edit: boolean
          can_manage: boolean
          can_view: boolean
          can_work: boolean
          stage_color: string
          stage_id: string
          stage_name: string
        }[]
      }
      get_user_accessible_stages_with_master_queue: {
        Args: { p_user_id?: string }
        Returns: {
          can_edit: boolean
          can_manage: boolean
          can_view: boolean
          can_work: boolean
          master_queue_id: string
          master_queue_name: string
          stage_color: string
          stage_id: string
          stage_name: string
        }[]
      }
      get_user_departments: {
        Args: { p_user_id?: string }
        Returns: {
          allows_concurrent_jobs: boolean
          department_color: string
          department_id: string
          department_name: string
          max_concurrent_jobs: number
        }[]
      }
      get_user_role_safe: {
        Args: { user_id_param: string }
        Returns: string
      }
      get_workflow_metrics: {
        Args: { p_job_id: string }
        Returns: {
          complete_stages: number
          configuration_warnings: string[]
          empty_stages: number
          estimated_completion_days: number
          partial_stages: number
          total_duration_minutes: number
          total_quantity: number
          total_stages: number
          validation_status: string
        }[]
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
      initialize_custom_job_stages_with_specs: {
        Args:
          | {
              p_category_id: string
              p_job_id: string
              p_job_table_name: string
              p_part_assignments?: Json
            }
          | {
              p_job_id: string
              p_job_table_name: string
              p_stage_mappings: Json
            }
        Returns: boolean
      }
      initialize_job_stages: {
        Args: {
          p_category_id: string
          p_job_id: string
          p_job_table_name: string
        }
        Returns: boolean
      }
      initialize_job_stages_auto: {
        Args: {
          p_category_id: string
          p_job_id: string
          p_job_table_name: string
        }
        Returns: boolean
      }
      initialize_job_stages_concurrent: {
        Args: {
          p_category_id: string
          p_job_id: string
          p_job_table_name: string
        }
        Returns: boolean
      }
      initialize_job_stages_with_multi_specs: {
        Args: {
          p_consolidated_stages: Json
          p_job_id: string
          p_job_table_name: string
        }
        Returns: boolean
      }
      initialize_queue_state: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      inject_batch_allocation_stage_for_existing_jobs: {
        Args: Record<PropertyKey, never>
        Returns: {
          category_name: string
          fixed_job_id: string
          stages_added: number
          wo_no: string
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
      is_hp12000_stage: {
        Args: { stage_name: string }
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
      is_working_day: {
        Args: { p_date: string }
        Returns: boolean
      }
      jsi_minutes: {
        Args: {
          p_completion_percentage?: number
          p_estimated_duration_minutes: number
          p_remaining_minutes?: number
          p_scheduled_minutes: number
        }
        Returns: number
      }
      list_working_days: {
        Args: { end_date: string; start_date: string }
        Returns: {
          work_date: string
        }[]
      }
      log_scheduler_action: {
        Args: {
          p_details?: Json
          p_job_id?: string
          p_message: string
          p_stage_name?: string
        }
        Returns: undefined
      }
      mark_job_ready_for_batching: {
        Args: { p_job_id: string; p_job_table_name: string; p_user_id?: string }
        Returns: boolean
      }
      mirror_jsi_to_stage_time_slots: {
        Args: { p_stage_ids: string[] }
        Returns: undefined
      }
      next_shift_start_from_now: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      next_working_start: {
        Args: { p_from: string }
        Returns: string
      }
      pg_advisory_unlock: {
        Args: { key: number }
        Returns: boolean
      }
      pg_try_advisory_lock: {
        Args: { key: number }
        Returns: boolean
      }
      place_duration_business_hours: {
        Args: {
          p_duration_minutes: number
          p_production_stage_id?: string
          p_start_time: string
        }
        Returns: {
          duration_minutes: number
          slot_end_time: string
          slot_start_time: string
        }[]
      }
      place_duration_sql: {
        Args: {
          p_duration_minutes: number
          p_earliest_start: string
          p_max_days?: number
        }
        Returns: {
          placement_success: boolean
          slots_created: Json
        }[]
      }
      place_duration_sql_enhanced: {
        Args: {
          p_duration_minutes: number
          p_earliest_start: string
          p_max_days?: number
        }
        Returns: {
          placement_success: boolean
          slots_created: Json
        }[]
      }
      planned_minutes_for_jsi: {
        Args: { p_jsi_id: string }
        Returns: number
      }
      process_due_date_recalculation_queue: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      reassign_jobs_to_category: {
        Args: {
          p_from_category_id: string
          p_to_category_id: string
          p_user_id?: string
        }
        Returns: {
          error_message: string
          jobs_reassigned: number
          stages_updated: number
          success: boolean
        }[]
      }
      recalculate_job_due_date_from_schedule: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      remove_job_expedite_status: {
        Args: { p_job_id: string; p_removed_by?: string }
        Returns: boolean
      }
      reorder_category_stages_safe: {
        Args: { p_category_id: string; p_stage_reorders: Json }
        Returns: Json
      }
      reorder_jobs_in_master_queue: {
        Args: {
          p_job_reorders: Json
          p_master_queue_stage_id: string
          p_reordered_by?: string
        }
        Returns: boolean
      }
      repair_batch_job_references: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_reference: boolean
          job_number: string
          repaired_job_id: string
          repaired_table: string
        }[]
      }
      repair_jobs_missing_stages: {
        Args: Record<PropertyKey, never>
        Returns: {
          category_name: string
          job_wo_no: string
          repaired_job_id: string
          stages_created: number
        }[]
      }
      repair_missing_batch_references_fixed: {
        Args: Record<PropertyKey, never>
        Returns: {
          batch_id: string
          batch_name: string
          references_created: number
        }[]
      }
      reset_custom_workflow_stages_to_pending: {
        Args: Record<PropertyKey, never>
        Returns: {
          reset_job_id: string
          stages_reset: number
          wo_no: string
        }[]
      }
      revoke_user_role: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      rework_job_stage: {
        Args: {
          p_current_stage_id: string
          p_job_id: string
          p_job_table_name: string
          p_rework_reason?: string
          p_reworked_by?: string
          p_target_stage_id: string
        }
        Returns: boolean
      }
      safe_delete_category: {
        Args: { p_category_id: string; p_user_id?: string }
        Returns: {
          deleted_stages: number
          message: string
          success: boolean
        }[]
      }
      schedule_job_with_detailed_logging: {
        Args: {
          p_earliest_start?: string
          p_estimated_minutes: number
          p_job_id: string
          p_job_table_name: string
          p_stage_id: string
        }
        Returns: {
          capacity_info: Json
          decision_log_id: string
          reasoning: string
          scheduled_end: string
          scheduled_start: string
        }[]
      }
      scheduler_append_jobs: {
        Args:
          | { p_job_ids: string[]; p_only_if_unset?: boolean }
          | {
              p_job_ids: string[]
              p_only_if_unset?: boolean
              p_start_from?: string
            }
        Returns: {
          updated_jsi: number
          violations: Json
          wrote_slots: number
        }[]
      }
      scheduler_completely_sequential: {
        Args: { p_start_from?: string }
        Returns: {
          updated_jsi: number
          violations: Json
          wrote_slots: number
        }[]
      }
      scheduler_delete_slots_for_jobs: {
        Args: { job_ids: string[] }
        Returns: number
      }
      scheduler_reschedule_all_parallel_aware: {
        Args: { p_start_from?: string }
        Returns: {
          updated_jsi: number
          violations: Json
          wrote_slots: number
        }[]
      }
      scheduler_reschedule_all_sequential_enhanced: {
        Args: { p_start_from?: string }
        Returns: {
          updated_jsi: number
          violations: Json
          wrote_slots: number
        }[]
      }
      scheduler_reschedule_all_sequential_fixed: {
        Args: { p_start_from?: string }
        Returns: {
          updated_jsi: number
          violations: Json
          wrote_slots: number
        }[]
      }
      scheduler_reschedule_all_sequential_fixed_v2: {
        Args: { p_start_from?: string }
        Returns: {
          updated_jsi: number
          violations: Json
          wrote_slots: number
        }[]
      }
      scheduler_resource_fill_optimized: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["CompositeTypes"]["scheduler_result_type"]
      }
      scheduler_truly_sequential_v2: {
        Args: { p_start_from?: string }
        Returns: {
          updated_jsi: number
          violations: Json
          wrote_slots: number
        }[]
      }
      scheduler_truncate_slots: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      set_user_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: boolean
      }
      set_user_role_admin: {
        Args: { _new_role: string; _target_user_id: string }
        Returns: boolean
      }
      shift_window: {
        Args: { p_date: string }
        Returns: {
          win_end: string
          win_start: string
        }[]
      }
      shift_window_enhanced: {
        Args: { p_date: string }
        Returns: {
          has_lunch_break: boolean
          lunch_end: string
          lunch_start: string
          win_end: string
          win_start: string
        }[]
      }
      simple_scheduler_wrapper: {
        Args: { p_mode?: string; p_start_from?: string }
        Returns: Json
      }
      split_batch_at_packaging: {
        Args: { p_master_job_id: string; p_split_by?: string }
        Returns: {
          batch_id: string
          split_jobs_count: number
        }[]
      }
      sql: {
        Args: { q: string }
        Returns: Json
      }
      start_concurrent_printing_stages: {
        Args: {
          p_job_id: string
          p_job_table_name: string
          p_stage_ids: string[]
        }
        Returns: boolean
      }
      sync_completed_jobs_with_batch_flow: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      sync_production_jobs_from_batch_completion: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      sync_profiles_with_auth: {
        Args: Record<PropertyKey, never>
        Returns: {
          fixed_count: number
          synced_count: number
        }[]
      }
      unschedule_auto_stages: {
        Args: { from_date: string; wipe_all?: boolean }
        Returns: number
      }
      update_job_due_dates_after_scheduling: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_stage_availability: {
        Args: {
          p_additional_minutes?: number
          p_new_available_time: string
          p_stage_id: string
        }
        Returns: undefined
      }
      update_stage_queue_end_time: {
        Args: { p_date?: string; p_new_end_time: string; p_stage_id: string }
        Returns: boolean
      }
      update_stage_workload_tracking: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      update_user_profile_admin: {
        Args: { _full_name: string; _user_id: string }
        Returns: boolean
      }
      upsert_delivery_specification_mapping: {
        Args: {
          p_address_pattern?: string
          p_confidence_score?: number
          p_created_by?: string
          p_delivery_method_id?: string
          p_excel_text: string
          p_is_collection?: boolean
        }
        Returns: {
          action_taken: string
          conflict_detected: boolean
          mapping_id: string
          new_confidence: number
          previous_confidence: number
        }[]
      }
      upsert_excel_mapping: {
        Args: {
          p_confidence_score?: number
          p_created_by?: string
          p_excel_text: string
          p_production_stage_id: string
          p_stage_specification_id?: string
        }
        Returns: {
          action_taken: string
          conflict_detected: boolean
          mapping_id: string
          new_confidence: number
          previous_confidence: number
        }[]
      }
      upsert_paper_specification_mapping: {
        Args: {
          p_confidence_score?: number
          p_created_by?: string
          p_excel_text: string
          p_paper_type_id: string
          p_paper_weight_id: string
        }
        Returns: {
          action_taken: string
          conflict_detected: boolean
          mapping_id: string
          new_confidence: number
          previous_confidence: number
        }[]
      }
      upsert_print_specification_mapping: {
        Args: {
          p_confidence_score?: number
          p_created_by?: string
          p_excel_text: string
          p_print_specification_id: string
        }
        Returns: {
          action_taken: string
          conflict_detected: boolean
          mapping_id: string
          new_confidence: number
          previous_confidence: number
        }[]
      }
      validate_batch_integrity: {
        Args: { p_batch_id: string }
        Returns: {
          error_count: number
          is_valid: boolean
          issues: Json
          missing_references: number
          orphaned_jobs: number
        }[]
      }
      validate_batch_simple: {
        Args: { p_batch_id: string }
        Returns: {
          is_valid: boolean
          message: string
          missing_jobs: number
          reference_count: number
        }[]
      }
      validate_business_hours: {
        Args: { check_time: string }
        Returns: boolean
      }
      validate_job_scheduling_precedence: {
        Args: { p_job_ids?: string[] }
        Returns: {
          job_id: string
          stage1_end: string
          stage1_name: string
          stage1_order: number
          stage1_start: string
          stage2_end: string
          stage2_name: string
          stage2_order: number
          stage2_start: string
          violation_details: string
          violation_type: string
        }[]
      }
      validate_not_in_past: {
        Args: { check_time: string }
        Returns: boolean
      }
      validate_slot_timing_consistency: {
        Args: Record<PropertyKey, never>
        Returns: {
          discrepancy_minutes: number
          issue_type: string
          job_wo_no: string
          jsi_end: string
          jsi_start: string
          slot_count: number
          slots_end: string
          slots_start: string
          stage_instance_id: string
          stage_name: string
        }[]
      }
      validate_working_day: {
        Args: { check_time: string }
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
      mapping_type:
        | "production_stage"
        | "print_specification"
        | "paper_specification"
        | "delivery_specification"
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
      scheduler_result_type: {
        wrote_slots: number | null
        updated_jsi: number | null
        violations: Json | null
      }
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
      batch_status: [
        "pending",
        "processing",
        "completed",
        "cancelled",
        "sent_to_print",
      ],
      lamination_type: ["gloss", "matt", "soft_touch", "none"],
      mapping_type: [
        "production_stage",
        "print_specification",
        "paper_specification",
        "delivery_specification",
      ],
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

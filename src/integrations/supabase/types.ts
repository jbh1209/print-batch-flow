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
          batch_id: string | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          lamination_type: string
          name: string
          paper_type: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          lamination_type?: string
          name: string
          paper_type: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          lamination_type?: string
          name?: string
          paper_type?: string
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
          batch_id: string | null
          created_at: string
          double_sided: boolean
          due_date: string
          file_name: string
          id: string
          job_number: string
          lamination_type: Database["public"]["Enums"]["lamination_type"]
          name: string
          paper_type: string
          pdf_url: string
          quantity: number
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          double_sided?: boolean
          due_date: string
          file_name: string
          id?: string
          job_number: string
          lamination_type?: Database["public"]["Enums"]["lamination_type"]
          name: string
          paper_type?: string
          pdf_url: string
          quantity: number
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          double_sided?: boolean
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          lamination_type?: Database["public"]["Enums"]["lamination_type"]
          name?: string
          paper_type?: string
          pdf_url?: string
          quantity?: number
          status?: Database["public"]["Enums"]["job_status"]
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
      cover_jobs: {
        Row: {
          batch_id: string | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          lamination_type: string
          name: string
          paper_type: string
          paper_weight: string
          pdf_url: string
          quantity: number
          sides: string
          status: string
          updated_at: string
          user_id: string
          uv_varnish: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          lamination_type?: string
          name: string
          paper_type: string
          paper_weight: string
          pdf_url: string
          quantity: number
          sides?: string
          status?: string
          updated_at?: string
          user_id: string
          uv_varnish?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          lamination_type?: string
          name?: string
          paper_type?: string
          paper_weight?: string
          pdf_url?: string
          quantity?: number
          sides?: string
          status?: string
          updated_at?: string
          user_id?: string
          uv_varnish?: string
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
      flyer_jobs: {
        Row: {
          batch_id: string | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          name: string
          paper_type: Database["public"]["Enums"]["paper_type"]
          paper_weight: string
          pdf_url: string
          quantity: number
          size: Database["public"]["Enums"]["flyer_size"]
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          name: string
          paper_type: Database["public"]["Enums"]["paper_type"]
          paper_weight: string
          pdf_url: string
          quantity: number
          size: Database["public"]["Enums"]["flyer_size"]
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          name?: string
          paper_type?: Database["public"]["Enums"]["paper_type"]
          paper_weight?: string
          pdf_url?: string
          quantity?: number
          size?: Database["public"]["Enums"]["flyer_size"]
          status?: Database["public"]["Enums"]["job_status"]
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
      postcard_jobs: {
        Row: {
          batch_id: string | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          lamination_type: string
          name: string
          paper_type: string
          paper_weight: string
          pdf_url: string
          quantity: number
          size: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          lamination_type?: string
          name: string
          paper_type: string
          paper_weight: string
          pdf_url: string
          quantity: number
          size?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          lamination_type?: string
          name?: string
          paper_type?: string
          paper_weight?: string
          pdf_url?: string
          quantity?: number
          size?: string
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
          batch_id: string | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          lamination_type: string
          name: string
          paper_type: string
          paper_weight: string
          pdf_url: string
          quantity: number
          sides: string
          size: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          lamination_type?: string
          name: string
          paper_type: string
          paper_weight: string
          pdf_url: string
          quantity: number
          sides?: string
          size: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          lamination_type?: string
          name?: string
          paper_type?: string
          paper_weight?: string
          pdf_url?: string
          quantity?: number
          sides?: string
          size?: string
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
      sleeve_jobs: {
        Row: {
          batch_id: string | null
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
          stock_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          batch_id?: string | null
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
          stock_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          batch_id?: string | null
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
          stock_type?: string
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
          batch_id: string | null
          created_at: string
          due_date: string
          file_name: string
          id: string
          job_number: string
          lamination_type: string
          name: string
          paper_type: string
          pdf_url: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          due_date: string
          file_name: string
          id?: string
          job_number: string
          lamination_type?: string
          name: string
          paper_type: string
          pdf_url: string
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          due_date?: string
          file_name?: string
          id?: string
          job_number?: string
          lamination_type?: string
          name?: string
          paper_type?: string
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
      add_admin_role: {
        Args: { admin_user_id: string }
        Returns: boolean
      }
      any_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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
      is_admin_secure_fixed: {
        Args: { _user_id: string }
        Returns: boolean
      }
      revoke_user_role: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      set_user_role: {
        Args: { target_user_id: string; new_role: string }
        Returns: boolean
      }
      set_user_role_admin: {
        Args: { _target_user_id: string; _new_role: string }
        Returns: boolean
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
      flyer_size: "A5" | "A4" | "DL" | "A3"
      job_status: "queued" | "batched" | "completed" | "cancelled"
      lamination_type: "gloss" | "matt" | "soft_touch" | "none"
      page_status:
        | "queued"
        | "batched"
        | "completed"
        | "cancelled"
        | "sent_to_print"
      paper_type: "Matt" | "Gloss"
      printer_type: "HP 12000" | "HP 7900"
      sheet_size: "455x640mm" | "530x750mm" | "320x455mm"
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
      flyer_size: ["A5", "A4", "DL", "A3"],
      job_status: ["queued", "batched", "completed", "cancelled"],
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
      sheet_size: ["455x640mm", "530x750mm", "320x455mm"],
    },
  },
} as const

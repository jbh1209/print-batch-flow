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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
        Returns: undefined
      }
      any_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_role: {
        Args: { role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      batch_status:
        | "pending"
        | "processing"
        | "completed"
        | "cancelled"
        | "sent_to_print"
      flyer_size: "A5" | "A4" | "DL" | "A3"
      job_status: "queued" | "batched" | "completed" | "cancelled"
      lamination_type: "gloss" | "matt" | "soft_touch" | "none"
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
      app_role: ["admin", "user"],
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
      paper_type: ["Matt", "Gloss"],
      printer_type: ["HP 12000", "HP 7900"],
      sheet_size: ["455x640mm", "530x750mm", "320x455mm"],
    },
  },
} as const

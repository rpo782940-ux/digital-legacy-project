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
      callback_requests: {
        Row: {
          created_at: string
          id: string
          lang: string
          message: string | null
          name: string | null
          phone: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          lang?: string
          message?: string | null
          name?: string | null
          phone: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          lang?: string
          message?: string | null
          name?: string | null
          phone?: string
          status?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description_ru: string | null
          description_uk: string | null
          external_id: string | null
          h1_ru: string | null
          h1_uk: string | null
          id: string
          image_path: string | null
          intro_ru: string | null
          intro_uk: string | null
          is_active: boolean
          meta_desc_ru: string | null
          meta_desc_uk: string | null
          meta_title_ru: string | null
          meta_title_uk: string | null
          name_ru: string
          name_uk: string
          seo_url: string | null
          slug: string
          sort_order: number
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ru?: string | null
          description_uk?: string | null
          external_id?: string | null
          h1_ru?: string | null
          h1_uk?: string | null
          id?: string
          image_path?: string | null
          intro_ru?: string | null
          intro_uk?: string | null
          is_active?: boolean
          meta_desc_ru?: string | null
          meta_desc_uk?: string | null
          meta_title_ru?: string | null
          meta_title_uk?: string | null
          name_ru: string
          name_uk: string
          seo_url?: string | null
          slug: string
          sort_order?: number
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ru?: string | null
          description_uk?: string | null
          external_id?: string | null
          h1_ru?: string | null
          h1_uk?: string | null
          id?: string
          image_path?: string | null
          intro_ru?: string | null
          intro_uk?: string | null
          is_active?: boolean
          meta_desc_ru?: string | null
          meta_desc_uk?: string | null
          meta_title_ru?: string | null
          meta_title_uk?: string | null
          name_ru?: string
          name_uk?: string
          seo_url?: string | null
          slug?: string
          sort_order?: number
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          unit_price: number
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number
          unit_price?: number
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          unit_price?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          city: string | null
          comment: string | null
          created_at: string
          customer_name: string
          delivery: string | null
          discount: number
          email: string | null
          id: string
          lang: string
          np_city: string | null
          np_warehouse: string | null
          np_warehouse_address: string | null
          np_warehouse_data: Json | null
          order_no: number
          payment: string | null
          phone: string
          salesdrive_order_id: number | null
          salesdrive_status_id: number | null
          salesdrive_sync_error: string | null
          salesdrive_sync_status: string
          salesdrive_synced_at: string | null
          status: string
          total: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          comment?: string | null
          created_at?: string
          customer_name: string
          delivery?: string | null
          discount?: number
          email?: string | null
          id?: string
          lang?: string
          np_city?: string | null
          np_warehouse?: string | null
          np_warehouse_address?: string | null
          np_warehouse_data?: Json | null
          order_no?: never
          payment?: string | null
          phone: string
          salesdrive_order_id?: number | null
          salesdrive_status_id?: number | null
          salesdrive_sync_error?: string | null
          salesdrive_sync_status?: string
          salesdrive_synced_at?: string | null
          status?: string
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string
          delivery?: string | null
          discount?: number
          email?: string | null
          id?: string
          lang?: string
          np_city?: string | null
          np_warehouse?: string | null
          np_warehouse_address?: string | null
          np_warehouse_data?: Json | null
          order_no?: never
          payment?: string | null
          phone?: string
          salesdrive_order_id?: number | null
          salesdrive_status_id?: number | null
          salesdrive_sync_error?: string | null
          salesdrive_sync_status?: string
          salesdrive_synced_at?: string | null
          status?: string
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          phone: string | null
          purpose: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          phone?: string | null
          purpose?: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      product_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          note: string | null
          products_count: number
          products_created: number
          products_updated: number
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          note?: string | null
          products_count?: number
          products_created?: number
          products_updated?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          note?: string | null
          products_count?: number
          products_created?: number
          products_updated?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          alt_ru: string | null
          alt_uk: string | null
          brand: string | null
          category_id: string
          created_at: string
          description_ru: string | null
          description_uk: string | null
          external_id: string | null
          gallery: Json
          h1_ru: string | null
          h1_uk: string | null
          id: string
          image_path: string
          in_stock: boolean
          is_active: boolean
          is_new: boolean
          is_special: boolean
          manufacturer: string | null
          meta_desc_ru: string | null
          meta_desc_uk: string | null
          meta_title_ru: string | null
          meta_title_uk: string | null
          name_ru: string
          name_uk: string
          old_price: number | null
          price: number | null
          quantity: number
          seo_url: string | null
          sku: string | null
          slug: string
          sort_order: number
          source_hash: string | null
          special_price: number | null
          specs_ru: Json
          specs_uk: Json
          synced_at: string | null
          updated_at: string
          variants_ru: Json
          variants_uk: Json
        }
        Insert: {
          alt_ru?: string | null
          alt_uk?: string | null
          brand?: string | null
          category_id: string
          created_at?: string
          description_ru?: string | null
          description_uk?: string | null
          external_id?: string | null
          gallery?: Json
          h1_ru?: string | null
          h1_uk?: string | null
          id?: string
          image_path: string
          in_stock?: boolean
          is_active?: boolean
          is_new?: boolean
          is_special?: boolean
          manufacturer?: string | null
          meta_desc_ru?: string | null
          meta_desc_uk?: string | null
          meta_title_ru?: string | null
          meta_title_uk?: string | null
          name_ru: string
          name_uk: string
          old_price?: number | null
          price?: number | null
          quantity?: number
          seo_url?: string | null
          sku?: string | null
          slug: string
          sort_order?: number
          source_hash?: string | null
          special_price?: number | null
          specs_ru?: Json
          specs_uk?: Json
          synced_at?: string | null
          updated_at?: string
          variants_ru?: Json
          variants_uk?: Json
        }
        Update: {
          alt_ru?: string | null
          alt_uk?: string | null
          brand?: string | null
          category_id?: string
          created_at?: string
          description_ru?: string | null
          description_uk?: string | null
          external_id?: string | null
          gallery?: Json
          h1_ru?: string | null
          h1_uk?: string | null
          id?: string
          image_path?: string
          in_stock?: boolean
          is_active?: boolean
          is_new?: boolean
          is_special?: boolean
          manufacturer?: string | null
          meta_desc_ru?: string | null
          meta_desc_uk?: string | null
          meta_title_ru?: string | null
          meta_title_uk?: string | null
          name_ru?: string
          name_uk?: string
          old_price?: number | null
          price?: number | null
          quantity?: number
          seo_url?: string | null
          sku?: string | null
          slug?: string
          sort_order?: number
          source_hash?: string | null
          special_price?: number | null
          specs_ru?: Json
          specs_uk?: Json
          synced_at?: string | null
          updated_at?: string
          variants_ru?: Json
          variants_uk?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          email_verified: boolean
          first_name: string
          id: string
          last_name: string
          nickname: string | null
          phone: string | null
          phone_verified: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_verified?: boolean
          first_name?: string
          id: string
          last_name?: string
          nickname?: string | null
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          email_verified?: boolean
          first_name?: string
          id?: string
          last_name?: string
          nickname?: string | null
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          categories_synced: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          products_created: number
          products_disabled: number
          products_skipped: number
          products_updated: number
          started_at: string
          status: string
          trigger: string
          updated_at: string
        }
        Insert: {
          categories_synced?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          products_created?: number
          products_disabled?: number
          products_skipped?: number
          products_updated?: number
          started_at?: string
          status?: string
          trigger?: string
          updated_at?: string
        }
        Update: {
          categories_synced?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          products_created?: number
          products_disabled?: number
          products_skipped?: number
          products_updated?: number
          started_at?: string
          status?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
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
      app_role: ["admin", "manager", "user"],
    },
  },
} as const

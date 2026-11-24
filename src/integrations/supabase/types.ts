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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          id: string
          kind: string
          logo_url: string | null
          name: string
          slug: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          low_stock_threshold: number
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string | null
        }
        ComputedFields: never
        Insert: {
          id?: string
          low_stock_threshold?: number
          product_id: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          low_stock_threshold?: number
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
      motorcycle_versions: {
        Row: {
          created_at: string
          id: string
          motorcycle_id: string
          version: string
          year: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          motorcycle_id: string
          version?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          motorcycle_id?: string
          version?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_versions_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycles: {
        Row: {
          active: boolean
          brand_id: string
          created_at: string
          displacement_cc: number | null
          id: string
          model: string
          slug: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          brand_id: string
          created_at?: string
          displacement_cc?: number | null
          id?: string
          model: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_id?: string
          created_at?: string
          displacement_cc?: number | null
          id?: string
          model?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      product_experiences: {
        Row: {
          config: NonNullable<Json>
          created_at: string
          enabled: boolean
          id: string
          product_id: string
          type: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          config?: NonNullable<Json>
          created_at?: string
          enabled?: boolean
          id?: string
          product_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          config?: NonNullable<Json>
          created_at?: string
          enabled?: boolean
          id?: string
          product_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_experiences_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fitments: {
        Row: {
          created_at: string
          id: string
          motorcycle_version_id: string
          notes: string
          position: string
          product_id: string
          restrictions: string
          updated_at: string
          validated: boolean
          validated_at: string | null
          validated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          motorcycle_version_id: string
          notes?: string
          position?: string
          product_id: string
          restrictions?: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motorcycle_version_id?: string
          notes?: string
          position?: string
          product_id?: string
          restrictions?: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_fitments_motorcycle_version_id_fkey"
            columns: ["motorcycle_version_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fitments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt: string
          created_at: string
          id: string
          is_primary: boolean
          kind: string
          meta: NonNullable<Json>
          product_id: string
          sequence_index: number | null
          sort_order: number
          storage_path: string | null
          url: string | null
          variant_id: string | null
        }
        ComputedFields: never
        Insert: {
          alt?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          kind: string
          meta?: NonNullable<Json>
          product_id: string
          sequence_index?: number | null
          sort_order?: number
          storage_path?: string | null
          url?: string | null
          variant_id?: string | null
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          kind?: string
          meta?: NonNullable<Json>
          product_id?: string
          sequence_index?: number | null
          sort_order?: number
          storage_path?: string | null
          url?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
      product_specs: {
        Row: {
          id: string
          label: string
          product_id: string
          sort_order: number
          value: string
        }
        ComputedFields: never
        Insert: {
          id?: string
          label: string
          product_id: string
          sort_order?: number
          value: string
        }
        Update: {
          id?: string
          label?: string
          product_id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          attributes: NonNullable<Json>
          created_at: string
          id: string
          name: string
          price: number | null
          product_id: string
          sku: string
          sort_order: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          attributes?: NonNullable<Json>
          created_at?: string
          id?: string
          name: string
          price?: number | null
          product_id: string
          sku: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          attributes?: NonNullable<Json>
          created_at?: string
          id?: string
          name?: string
          price?: number | null
          product_id?: string
          sku?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string
          brand_id: string | null
          category_id: string | null
          colors: string[]
          created_at: string
          description: string
          featured: boolean
          id: string
          images: string[]
          is_demo: boolean
          is_new: boolean
          model_approved: boolean
          model_error: string | null
          model_job_id: string | null
          model_status: string
          model_url: string | null
          name: string
          old_price: number | null
          price: number
          sizes: string[]
          sku: string | null
          slug: string
          specs: NonNullable<Json>
          stock_status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          brand?: string
          brand_id?: string | null
          category_id?: string | null
          colors?: string[]
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          images?: string[]
          is_demo?: boolean
          is_new?: boolean
          model_approved?: boolean
          model_error?: string | null
          model_job_id?: string | null
          model_status?: string
          model_url?: string | null
          name: string
          old_price?: number | null
          price?: number
          sizes?: string[]
          sku?: string | null
          slug: string
          specs?: NonNullable<Json>
          stock_status?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          brand_id?: string | null
          category_id?: string | null
          colors?: string[]
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          images?: string[]
          is_demo?: boolean
          is_new?: boolean
          model_approved?: boolean
          model_error?: string | null
          model_job_id?: string | null
          model_status?: string
          model_url?: string | null
          name?: string
          old_price?: number | null
          price?: number
          sizes?: string[]
          sku?: string | null
          slug?: string
          specs?: NonNullable<Json>
          stock_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
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
          display_name: string
          id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          address: string | null
          banner_image: string | null
          banner_subtitle: string | null
          banner_title: string | null
          hours: string | null
          id: number
          instagram: string | null
          logo_url: string | null
          store_name: string
          whatsapp: string
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          banner_image?: string | null
          banner_subtitle?: string | null
          banner_title?: string | null
          hours?: string | null
          id?: number
          instagram?: string | null
          logo_url?: string | null
          store_name?: string
          whatsapp?: string
        }
        Update: {
          address?: string | null
          banner_image?: string | null
          banner_subtitle?: string | null
          banner_title?: string | null
          hours?: string | null
          id?: number
          instagram?: string | null
          logo_url?: string | null
          store_name?: string
          whatsapp?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_stock_status: {
        Row: {
          in_stock: boolean | null
          product_id: string
          variant_id: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
    }
    Functions: {
      experience_missing_assets: {
        Args: { p_config: Json; p_product: string; p_type: string }
        Returns: string[]
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

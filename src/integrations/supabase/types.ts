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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      available_ingredients: {
        Row: {
          available: number
          created_at: string | null
          id: number
          name: string
          producto_id: string
          required: number
          unit: string
        }
        Insert: {
          available: number
          created_at?: string | null
          id?: number
          name: string
          producto_id: string
          required: number
          unit: string
        }
        Update: {
          available?: number
          created_at?: string | null
          id?: number
          name?: string
          producto_id?: string
          required?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "available_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "available_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      envios: {
        Row: {
          created_at: string | null
          destino: string
          estado: string
          fecha_creacion: string | null
          fecha_envio: string | null
          id: string
          numero_envio: string
          observaciones: string | null
          total_kilos: number | null
          total_remitos: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          destino: string
          estado?: string
          fecha_creacion?: string | null
          fecha_envio?: string | null
          id?: string
          numero_envio: string
          observaciones?: string | null
          total_kilos?: number | null
          total_remitos?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          destino?: string
          estado?: string
          fecha_creacion?: string | null
          fecha_envio?: string | null
          id?: string
          numero_envio?: string
          observaciones?: string | null
          total_kilos?: number | null
          total_remitos?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      envios_remitos: {
        Row: {
          created_at: string | null
          envio_id: string
          id: string
          remito_id: string
        }
        Insert: {
          created_at?: string | null
          envio_id: string
          id?: string
          remito_id: string
        }
        Update: {
          created_at?: string | null
          envio_id?: string
          id?: string
          remito_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "envios_remitos_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_remitos_remito_id_fkey"
            columns: ["remito_id"]
            isOneToOne: false
            referencedRelation: "remitos"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          certificate: string
          created_at: string | null
          current_stock: number
          id: string
          last_update: string
          level: string
          location: string
          max_stock: number
          min_stock: number
          name: string
          place: string
          rack: string
          status: string
          supplier: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          certificate: string
          created_at?: string | null
          current_stock?: number
          id: string
          last_update?: string
          level: string
          location: string
          max_stock?: number
          min_stock?: number
          name: string
          place: string
          rack: string
          status?: string
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          certificate?: string
          created_at?: string | null
          current_stock?: number
          id?: string
          last_update?: string
          level?: string
          location?: string
          max_stock?: number
          min_stock?: number
          name?: string
          place?: string
          rack?: string
          status?: string
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      materias_primas: {
        Row: {
          categoria: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          nombre: string
          notas: string | null
          proveedor: string | null
          stock: number | null
          stock_minimo: number | null
          unidad: string
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nombre: string
          notas?: string | null
          proveedor?: string | null
          stock?: number | null
          stock_minimo?: number | null
          unidad: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nombre?: string
          notas?: string | null
          proveedor?: string | null
          stock?: number | null
          stock_minimo?: number | null
          unidad?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      missing_ingredients: {
        Row: {
          created_at: string | null
          id: number
          name: string
          producto_id: string
          required: number
          unit: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          producto_id: string
          required: number
          unit: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          producto_id?: string
          required?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          batch_size: number
          lote_code: string | null
          stock_actual: number
          client_name: string | null
          created_at: string | null
          date: string | null
          destination: string
          id: string
          name: string
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          batch_size?: number
          lote_code?: string | null
          stock_actual?: number
          client_name?: string | null
          created_at?: string | null
          date?: string | null
          destination: string
          id: string
          name: string
          status: string
          type: string
          updated_at?: string | null
        }
        Update: {
          batch_size?: number
          lote_code?: string | null
          stock_actual?: number
          client_name?: string | null
          created_at?: string | null
          date?: string | null
          destination?: string
          id?: string
          name?: string
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      remito_items: {
        Row: {
          cantidad_lotes: number
          cliente_o_stock: string | null
          created_at: string | null
          id: string
          kilos_sumados: number
          lote: string | null
          nombre_producto: string
          notas: string | null
          producto_id: string
          remito_id: string
          updated_at: string | null
        }
        Insert: {
          cantidad_lotes?: number
          cliente_o_stock?: string | null
          created_at?: string | null
          id: string
          kilos_sumados?: number
          lote?: string | null
          nombre_producto: string
          notas?: string | null
          producto_id: string
          remito_id: string
          updated_at?: string | null
        }
        Update: {
          cantidad_lotes?: number
          cliente_o_stock?: string | null
          created_at?: string | null
          id?: string
          kilos_sumados?: number
          lote?: string | null
          nombre_producto?: string
          notas?: string | null
          producto_id?: string
          remito_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remito_items_remito_id_fkey"
            columns: ["remito_id"]
            isOneToOne: false
            referencedRelation: "remitos"
            referencedColumns: ["id"]
          },
        ]
      }
      remitos: {
        Row: {
          created_at: string | null
          destino: string
          estado: string
          fecha: string
          id: string
          observaciones: string | null
          total_kilos: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          destino: string
          estado?: string
          fecha?: string
          id: string
          observaciones?: string | null
          total_kilos?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          destino?: string
          estado?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          total_kilos?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      test_connection: {
        Row: {
          created_at: string | null
          id: number
          message: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          message?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          message?: string | null
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          id: string
          password: string
          role: string
          updated_at: string | null
          user_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password: string
          role?: string
          updated_at?: string | null
          user_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password?: string
          role?: string
          updated_at?: string | null
          user_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      available_ingredients_detailed: {
        Row: {
          available: number | null
          batch_size: number | null
          created_at: string | null
          destination: string | null
          id: number | null
          name: string | null
          producto_id: string | null
          producto_name: string | null
          producto_status: string | null
          required: number | null
          stock_status: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "available_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "available_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      missing_ingredients_detailed: {
        Row: {
          batch_size: number | null
          created_at: string | null
          destination: string | null
          id: number | null
          name: string | null
          producto_id: string | null
          producto_name: string | null
          producto_status: string | null
          required: number | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missing_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_ingredients_formula_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_complete: {
        Row: {
          available_ingredients_count: number | null
          batch_size: number | null
          client_name: string | null
          created_at: string | null
          date: string | null
          destination: string | null
          id: string | null
          missing_ingredients_count: number | null
          name: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      productos_stats: {
        Row: {
          available_productos: number | null
          avg_batch_size: number | null
          client_productos: number | null
          incomplete_productos: number | null
          stock_productos: number | null
          total_productos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      authenticate_user: {
        Args: { password_param: string; username_param: string }
        Returns: Json
      }
      authenticate_user_with_supabase: {
        Args: { password_param: string; username_param: string }
        Returns: Json
      }
      change_user_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      create_user: {
        Args: {
          password_param: string
          role_param?: string
          username_param: string
        }
        Returns: Json
      }
      delete_complete_user: { Args: { p_user_id: string }; Returns: boolean }
      delete_user: { Args: { user_id_param: string }; Returns: Json }
      delete_user_with_role: { Args: { p_user_id: string }; Returns: boolean }
      generate_remito_villa_martelli: {
        Args: {
          p_destino: string
          p_fecha: string
          p_items: Json
          p_observaciones: string
          p_total_kilos: number
        }
        Returns: Json
      }
      get_all_users: {
        Args: never
        Returns: {
          created_at: string
          id: string
          role: string
          updated_at: string
          user_name: string
        }[]
      }
      get_current_user: { Args: never; Returns: Json }
      get_productos_complete: {
        Args: never
        Returns: {
          available_ingredients_count: number
          batch_size: number
          client_name: string
          created_at: string
          date: string
          destination: string
          id: string
          missing_ingredients_count: number
          name: string
          status: string
          type: string
          updated_at: string
        }[]
      }
      get_user_by_id: { Args: { user_id_param: string }; Returns: Json }
      get_user_stats: { Args: never; Returns: Json }
      insert_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      is_user_admin: { Args: { p_user_id: string }; Returns: boolean }
      logout_user: { Args: never; Returns: Json }
      update_complete_user: {
        Args: {
          p_email?: string
          p_full_name?: string
          p_is_active?: boolean
          p_role?: string
          p_user_id: string
        }
        Returns: Json
      }
      update_user: {
        Args: {
          new_password?: string
          new_role?: string
          new_username?: string
          user_id_param: string
        }
        Returns: Json
      }
      get_weekly_production: {
        Args: {
          target_date?: string
        }
        Returns: number
      }
      get_monthly_production: {
        Args: {
          target_date?: string
        }
        Returns: number
      }
      get_weekly_production_total: {
        Args: {
          target_date?: string
        }
        Returns: number
      }
      get_monthly_production_total: {
        Args: {
          target_date?: string
        }
        Returns: number
      }
      get_current_production_kilos: {
        Args: Record<string, never>
        Returns: number
      }
      update_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
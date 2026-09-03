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
      attendance: {
        Row: {
          check_in_time: string
          created_at: string
          id: string
          member_id: string
          recorded_by: string | null
          service_date: string
          service_type: string
          status: string
        }
        Insert: {
          check_in_time?: string
          created_at?: string
          id?: string
          member_id: string
          recorded_by?: string | null
          service_date?: string
          service_type?: string
          status?: string
        }
        Update: {
          check_in_time?: string
          created_at?: string
          id?: string
          member_id?: string
          recorded_by?: string | null
          service_date?: string
          service_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      church_settings: {
        Row: {
          church_name: string
          geofence_enabled: boolean
          id: number
          latitude: number | null
          longitude: number | null
          radius_meters: number
          updated_at: string
        }
        Insert: {
          church_name?: string
          geofence_enabled?: boolean
          id?: number
          latitude?: number | null
          longitude?: number | null
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          church_name?: string
          geofence_enabled?: boolean
          id?: number
          latitude?: number | null
          longitude?: number | null
          radius_meters?: number
          updated_at?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          contact_method: string
          contacted_on: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          notes: string | null
          situation: string | null
        }
        Insert: {
          contact_method: string
          contacted_on?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          notes?: string | null
          situation?: string | null
        }
        Update: {
          contact_method?: string
          contacted_on?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          situation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          age_bracket: string | null
          anniversary_day: number | null
          anniversary_month: number | null
          birth_day: number | null
          birth_month: number | null
          birth_year: number | null
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          full_name: string
          gender: string | null
          home_address: string | null
          id: string
          invited_by: string | null
          is_first_timer: boolean
          marital_status: string | null
          member_code: string
          membership_year: number | null
          phone: string | null
          photo_url: string | null
          user_id: string | null
        }
        Insert: {
          age_bracket?: string | null
          anniversary_day?: number | null
          anniversary_month?: number | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          home_address?: string | null
          id?: string
          invited_by?: string | null
          is_first_timer?: boolean
          marital_status?: string | null
          member_code?: string
          membership_year?: number | null
          phone?: string | null
          photo_url?: string | null
          user_id?: string | null
        }
        Update: {
          age_bracket?: string | null
          anniversary_day?: number | null
          anniversary_month?: number | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          home_address?: string | null
          id?: string
          invited_by?: string | null
          is_first_timer?: boolean
          marital_status?: string | null
          member_code?: string
          membership_year?: number | null
          phone?: string | null
          photo_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department: string | null
          full_name: string
          id: string
          phone: string | null
          sub_role: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id: string
          phone?: string | null
          sub_role?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          sub_role?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role:
        | "pastorate"
        | "hod"
        | "group_leader"
        | "member"
        | "it_infrastructure"
        | "follow_up"
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
        "pastorate",
        "hod",
        "group_leader",
        "member",
        "it_infrastructure",
        "follow_up",
      ],
    },
  },
} as const

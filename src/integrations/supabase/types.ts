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
      active_timers: {
        Row: {
          created_at: string
          installer_id: string
          project_id: string
          project_name: string | null
          started_at: string
        }
        Insert: {
          created_at?: string
          installer_id: string
          project_id: string
          project_name?: string | null
          started_at?: string
        }
        Update: {
          created_at?: string
          installer_id?: string
          project_id?: string
          project_name?: string | null
          started_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          data: Json
          hourly_rate: number | null
          id: string
          mileage_rate: number | null
          name: string
          overtime_rate: number | null
          ref: string | null
          sandbox: boolean
          updated_at: string
          vat_percent: number
        }
        Insert: {
          created_at?: string
          data?: Json
          hourly_rate?: number | null
          id?: string
          mileage_rate?: number | null
          name: string
          overtime_rate?: number | null
          ref?: string | null
          sandbox?: boolean
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          created_at?: string
          data?: Json
          hourly_rate?: number | null
          id?: string
          mileage_rate?: number | null
          name?: string
          overtime_rate?: number | null
          ref?: string | null
          sandbox?: boolean
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      deviations: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          installer_id: string
          installer_name: string | null
          occurred_at: string
          photo_paths: Json
          project_name: string | null
          project_ref: string
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          installer_id: string
          installer_name?: string | null
          occurred_at?: string
          photo_paths?: Json
          project_name?: string | null
          project_ref: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          installer_id?: string
          installer_name?: string | null
          occurred_at?: string
          photo_paths?: Json
          project_name?: string | null
          project_ref?: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_type: string | null
          id: string
          sandbox: boolean
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          id?: string
          sandbox?: boolean
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          id?: string
          sandbox?: boolean
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          amount: number
          category: string
          client_name: string | null
          created_at: string
          entry_date: string
          id: string
          installer_id: string
          note: string | null
          project_id: string
          project_name: string | null
          receipt_path: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          client_name?: string | null
          created_at?: string
          entry_date: string
          id?: string
          installer_id: string
          note?: string | null
          project_id: string
          project_name?: string | null
          receipt_path?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          client_name?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          installer_id?: string
          note?: string | null
          project_id?: string
          project_name?: string | null
          receipt_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      field_reports: {
        Row: {
          checked_items: Json
          created_at: string
          id: string
          installer_id: string
          photo_meta: Json
          photo_paths: Json
          project_ref: string
          report_text: string | null
          sign_offs: Json
          signature: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          checked_items?: Json
          created_at?: string
          id?: string
          installer_id: string
          photo_meta?: Json
          photo_paths?: Json
          project_ref: string
          report_text?: string | null
          sign_offs?: Json
          signature?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          checked_items?: Json
          created_at?: string
          id?: string
          installer_id?: string
          photo_meta?: Json
          photo_paths?: Json
          project_ref?: string
          report_text?: string | null
          sign_offs?: Json
          signature?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      installer_absences: {
        Row: {
          created_at: string
          end_date: string
          id: string
          installer_id: string
          label: string | null
          sandbox: boolean
          start_date: string
          type: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          installer_id: string
          label?: string | null
          sandbox?: boolean
          start_date: string
          type: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          installer_id?: string
          label?: string | null
          sandbox?: boolean
          start_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "installer_absences_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
        ]
      }
      installers: {
        Row: {
          base_location: string | null
          color: number
          created_at: string
          id: string
          name: string
          profile_id: string | null
          sandbox: boolean
          type: string
          updated_at: string
        }
        Insert: {
          base_location?: string | null
          color?: number
          created_at?: string
          id?: string
          name: string
          profile_id?: string | null
          sandbox?: boolean
          type?: string
          updated_at?: string
        }
        Update: {
          base_location?: string | null
          color?: number
          created_at?: string
          id?: string
          name?: string
          profile_id?: string | null
          sandbox?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_entries: {
        Row: {
          amount: number
          client_name: string | null
          created_at: string
          entry_date: string
          id: string
          installer_id: string
          km: number
          note: string | null
          project_id: string
          project_name: string | null
          rate: number
          updated_at: string
        }
        Insert: {
          amount?: number
          client_name?: string | null
          created_at?: string
          entry_date: string
          id?: string
          installer_id: string
          km?: number
          note?: string | null
          project_id: string
          project_name?: string | null
          rate?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_name?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          installer_id?: string
          km?: number
          note?: string | null
          project_id?: string
          project_name?: string | null
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          clothing_size: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          drivers_license: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          emergency_contact2_name: string | null
          emergency_contact2_phone: string | null
          employment_start_date: string | null
          employment_type: string | null
          full_name: string | null
          id: string
          installer_id: string | null
          job_title: string | null
          medical_notes: string | null
          phone: string | null
          postal_code: string | null
          sandbox_mode: boolean
          shoe_size: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          clothing_size?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          drivers_license?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          emergency_contact2_name?: string | null
          emergency_contact2_phone?: string | null
          employment_start_date?: string | null
          employment_type?: string | null
          full_name?: string | null
          id: string
          installer_id?: string | null
          job_title?: string | null
          medical_notes?: string | null
          phone?: string | null
          postal_code?: string | null
          sandbox_mode?: boolean
          shoe_size?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          clothing_size?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          drivers_license?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          emergency_contact2_name?: string | null
          emergency_contact2_phone?: string | null
          employment_start_date?: string | null
          employment_type?: string | null
          full_name?: string | null
          id?: string
          installer_id?: string | null
          job_title?: string | null
          medical_notes?: string | null
          phone?: string | null
          postal_code?: string | null
          sandbox_mode?: boolean
          shoe_size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_assignees: {
        Row: {
          created_at: string
          id: string
          installer_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installer_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installer_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignees_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_events: {
        Row: {
          changed_by: string
          changed_by_name: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          project_name: string | null
          project_ref: string
          to_status: string
        }
        Insert: {
          changed_by: string
          changed_by_name?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          project_name?: string | null
          project_ref: string
          to_status: string
        }
        Update: {
          changed_by?: string
          changed_by_name?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          project_name?: string | null
          project_ref?: string
          to_status?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          data: Json
          end_date: string | null
          id: string
          location: string | null
          name: string
          project_type: string
          ref: string | null
          sandbox: boolean
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          data?: Json
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          project_type?: string
          ref?: string | null
          sandbox?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          data?: Json
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          project_type?: string
          ref?: string | null
          sandbox?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          fcm_token: string
          id: string
          last_seen_at: string
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fcm_token: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fcm_token?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminder_events: {
        Row: {
          channel: string | null
          id: string
          kind: Database["public"]["Enums"]["reminder_event_kind"]
          meta: Json
          reminder_id: string
          sent_at: string
        }
        Insert: {
          channel?: string | null
          id?: string
          kind: Database["public"]["Enums"]["reminder_event_kind"]
          meta?: Json
          reminder_id: string
          sent_at?: string
        }
        Update: {
          channel?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["reminder_event_kind"]
          meta?: Json
          reminder_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_events_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          installer_id: string
          last_notified_at: string | null
          level: Database["public"]["Enums"]["reminder_level"]
          missing: Json
          project_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          triggered_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          installer_id: string
          last_notified_at?: string | null
          level?: Database["public"]["Enums"]["reminder_level"]
          missing?: Json
          project_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          triggered_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          installer_id?: string
          last_notified_at?: string | null
          level?: Database["public"]["Enums"]["reminder_level"]
          missing?: Json
          project_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          client_name: string | null
          created_at: string
          end_time: string | null
          entry_date: string
          hourly_rate: number | null
          hours: number
          id: string
          installer_id: string
          note: string | null
          project_id: string
          project_name: string | null
          source: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          end_time?: string | null
          entry_date: string
          hourly_rate?: number | null
          hours?: number
          id?: string
          installer_id: string
          note?: string | null
          project_id: string
          project_name?: string | null
          source?: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          end_time?: string | null
          entry_date?: string
          hourly_rate?: number | null
          hours?: number
          id?: string
          installer_id?: string
          note?: string | null
          project_id?: string
          project_name?: string | null
          source?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transport_stops: {
        Row: {
          address: string
          created_at: string
          id: string
          project_id: string
          sort_order: number
          type: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          project_id: string
          sort_order?: number
          type: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          project_id?: string
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_stops_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_role: {
        Args: {
          _grant?: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: { Args: { _project_id: string }; Returns: boolean }
      shares_project_with_installer: {
        Args: { _installer_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "installer"
      reminder_event_kind: "push" | "banner" | "admin_alert"
      reminder_level: "gentle" | "urgent" | "escalated"
      reminder_status: "open" | "resolved" | "dismissed"
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
      app_role: ["admin", "installer"],
      reminder_event_kind: ["push", "banner", "admin_alert"],
      reminder_level: ["gentle", "urgent", "escalated"],
      reminder_status: ["open", "resolved", "dismissed"],
    },
  },
} as const

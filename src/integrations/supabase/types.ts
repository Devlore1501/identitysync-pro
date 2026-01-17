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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          account_id: string
          action: string
          created_at: string
          details: Json
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          account_id: string
          action: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_usage: {
        Row: {
          account_id: string
          created_at: string
          events_count: number
          id: string
          period_end: string
          period_start: string
          profiles_count: number
          syncs_count: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          events_count?: number
          id?: string
          period_end: string
          period_start: string
          profiles_count?: number
          syncs_count?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          events_count?: number
          id?: string
          period_end?: string
          period_start?: string
          profiles_count?: number
          syncs_count?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_usage_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          event_mapping: Json
          id: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          property_mapping: Json
          type: Database["public"]["Enums"]["destination_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          event_mapping?: Json
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          property_mapping?: Json
          type: Database["public"]["Enums"]["destination_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          event_mapping?: Json
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          property_mapping?: Json
          type?: Database["public"]["Enums"]["destination_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          anonymous_id: string | null
          consent_state: Json | null
          context: Json
          created_at: string
          dedupe_key: string | null
          event_name: string
          event_time: string
          event_type: string
          id: string
          processed_at: string | null
          properties: Json
          session_id: string | null
          source: string
          status: Database["public"]["Enums"]["event_status"]
          synced_at: string | null
          unified_user_id: string | null
          workspace_id: string
        }
        Insert: {
          anonymous_id?: string | null
          consent_state?: Json | null
          context?: Json
          created_at?: string
          dedupe_key?: string | null
          event_name: string
          event_time?: string
          event_type: string
          id?: string
          processed_at?: string | null
          properties?: Json
          session_id?: string | null
          source: string
          status?: Database["public"]["Enums"]["event_status"]
          synced_at?: string | null
          unified_user_id?: string | null
          workspace_id: string
        }
        Update: {
          anonymous_id?: string | null
          consent_state?: Json | null
          context?: Json
          created_at?: string
          dedupe_key?: string | null
          event_name?: string
          event_time?: string
          event_type?: string
          id?: string
          processed_at?: string | null
          properties?: Json
          session_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["event_status"]
          synced_at?: string | null
          unified_user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_unified_user_id_fkey"
            columns: ["unified_user_id"]
            isOneToOne: false
            referencedRelation: "users_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      events_raw: {
        Row: {
          error: string | null
          id: string
          ip_address: unknown
          payload: Json
          processed_at: string | null
          received_at: string
          source: string
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          error?: string | null
          id?: string
          ip_address?: unknown
          payload: Json
          processed_at?: string | null
          received_at?: string
          source: string
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          error?: string | null
          id?: string
          ip_address?: unknown
          payload?: Json
          processed_at?: string | null
          received_at?: string
          source?: string
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_raw_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      identities: {
        Row: {
          capture_source: string | null
          confidence: number
          created_at: string
          id: string
          identity_type: Database["public"]["Enums"]["identity_type"]
          identity_value: string
          source: string
          unified_user_id: string
          workspace_id: string
        }
        Insert: {
          capture_source?: string | null
          confidence?: number
          created_at?: string
          id?: string
          identity_type: Database["public"]["Enums"]["identity_type"]
          identity_value: string
          source: string
          unified_user_id: string
          workspace_id: string
        }
        Update: {
          capture_source?: string | null
          confidence?: number
          created_at?: string
          id?: string
          identity_type?: Database["public"]["Enums"]["identity_type"]
          identity_value?: string
          source?: string
          unified_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_unified_user_id_fkey"
            columns: ["unified_user_id"]
            isOneToOne: false
            referencedRelation: "users_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_signals: {
        Row: {
          confidence: number
          created_at: string
          expires_at: string | null
          flow_name: string | null
          flow_triggered_at: string | null
          id: string
          last_synced_at: string | null
          payload: Json
          should_trigger_flow: boolean
          signal_name: string
          signal_type: string
          synced_to: Json
          unified_user_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          expires_at?: string | null
          flow_name?: string | null
          flow_triggered_at?: string | null
          id?: string
          last_synced_at?: string | null
          payload?: Json
          should_trigger_flow?: boolean
          signal_name: string
          signal_type: string
          synced_to?: Json
          unified_user_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          flow_name?: string | null
          flow_triggered_at?: string | null
          id?: string
          last_synced_at?: string | null
          payload?: Json
          should_trigger_flow?: boolean
          signal_name?: string
          signal_type?: string
          synced_to?: Json
          unified_user_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictive_signals_unified_user_id_fkey"
            columns: ["unified_user_id"]
            isOneToOne: false
            referencedRelation: "users_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictive_signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          destination_id: string
          event_id: string | null
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          payload: Json
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["sync_status"]
          unified_user_id: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          destination_id: string
          event_id?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          unified_user_id?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          destination_id?: string
          event_id?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          unified_user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_unified_user_id_fkey"
            columns: ["unified_user_id"]
            isOneToOne: false
            referencedRelation: "users_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          account_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      users_unified: {
        Row: {
          ad_ids: Json | null
          anonymous_ids: string[]
          computed: Json
          created_at: string
          customer_ids: string[]
          emails: string[]
          external_ids: Json
          first_seen_at: string
          id: string
          last_seen_at: string
          phone: string | null
          primary_email: string | null
          traits: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_ids?: Json | null
          anonymous_ids?: string[]
          computed?: Json
          created_at?: string
          customer_ids?: string[]
          emails?: string[]
          external_ids?: Json
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          phone?: string | null
          primary_email?: string | null
          traits?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_ids?: Json | null
          anonymous_ids?: string[]
          computed?: Json
          created_at?: string
          customer_ids?: string[]
          emails?: string[]
          external_ids?: Json
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          phone?: string | null
          primary_email?: string | null
          traits?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_unified_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_health: {
        Row: {
          alert_no_ecommerce: boolean | null
          alert_no_events_24h: boolean | null
          alert_tracking_broken: boolean | null
          cart_events_count: number | null
          checked_at: string | null
          checkout_events_count: number | null
          created_at: string | null
          events_today: number | null
          events_week: number | null
          has_cart_events: boolean | null
          has_checkout_events: boolean | null
          has_order_events: boolean | null
          has_product_events: boolean | null
          id: string
          last_event_at: string | null
          order_events_count: number | null
          product_events_count: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          alert_no_ecommerce?: boolean | null
          alert_no_events_24h?: boolean | null
          alert_tracking_broken?: boolean | null
          cart_events_count?: number | null
          checked_at?: string | null
          checkout_events_count?: number | null
          created_at?: string | null
          events_today?: number | null
          events_week?: number | null
          has_cart_events?: boolean | null
          has_checkout_events?: boolean | null
          has_order_events?: boolean | null
          has_product_events?: boolean | null
          id?: string
          last_event_at?: string | null
          order_events_count?: number | null
          product_events_count?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          alert_no_ecommerce?: boolean | null
          alert_no_events_24h?: boolean | null
          alert_tracking_broken?: boolean | null
          cart_events_count?: number | null
          checked_at?: string | null
          checkout_events_count?: number | null
          created_at?: string | null
          events_today?: number | null
          events_week?: number | null
          has_cart_events?: boolean | null
          has_checkout_events?: boolean | null
          has_order_events?: boolean | null
          has_product_events?: boolean | null
          id?: string
          last_event_at?: string | null
          order_events_count?: number | null
          product_events_count?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_health_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          account_id: string
          created_at: string
          domain: string | null
          id: string
          name: string
          platform: string | null
          platform_store_id: string | null
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          domain?: string | null
          id?: string
          name: string
          platform?: string | null
          platform_store_id?: string | null
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
          platform?: string | null
          platform_store_id?: string | null
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decay_recency_scores: { Args: never; Returns: number }
      get_account_info: {
        Args: { p_account_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          plan: string
          updated_at: string
        }[]
      }
      get_user_account_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _account_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_billing_usage: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      merge_anonymous_to_identified: {
        Args: {
          p_anonymous_id: string
          p_identified_user_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      process_event_fast: {
        Args: {
          p_anonymous_id: string
          p_consent_state?: Json
          p_context: Json
          p_customer_id?: string
          p_email?: string
          p_event_name: string
          p_event_time?: string
          p_event_type: string
          p_phone?: string
          p_properties: Json
          p_session_id?: string
          p_source?: string
          p_workspace_id: string
        }
        Returns: {
          event_id: string
          is_duplicate: boolean
          unified_user_id: string
        }[]
      }
      recompute_behavioral_signals_batch: {
        Args: { p_limit?: number }
        Returns: number
      }
      recompute_user_signals_from_events: {
        Args: { p_user_id: string }
        Returns: Json
      }
      resolve_identity:
        | {
            Args: {
              p_anonymous_id: string
              p_customer_id?: string
              p_email?: string
              p_phone?: string
              p_source?: string
              p_workspace_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_ad_ids?: Json
              p_anonymous_id: string
              p_customer_id?: string
              p_email?: string
              p_phone?: string
              p_source?: string
              p_workspace_id: string
            }
            Returns: string
          }
      schedule_sync_jobs: {
        Args: {
          p_context: Json
          p_event_id: string
          p_event_name: string
          p_event_type: string
          p_properties: Json
          p_unified_user_id: string
          p_workspace_id: string
        }
        Returns: number
      }
      update_computed_traits_fast: {
        Args: {
          p_event_name: string
          p_event_type: string
          p_properties: Json
          p_unified_user_id: string
        }
        Returns: undefined
      }
      user_has_workspace_access: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member"
      destination_type: "klaviyo" | "webhook" | "ga4" | "meta"
      event_status: "pending" | "processed" | "failed" | "synced"
      identity_type:
        | "email"
        | "phone"
        | "customer_id"
        | "anonymous_id"
        | "external_id"
      sync_status: "pending" | "running" | "completed" | "failed"
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
      app_role: ["owner", "admin", "member"],
      destination_type: ["klaviyo", "webhook", "ga4", "meta"],
      event_status: ["pending", "processed", "failed", "synced"],
      identity_type: [
        "email",
        "phone",
        "customer_id",
        "anonymous_id",
        "external_id",
      ],
      sync_status: ["pending", "running", "completed", "failed"],
    },
  },
} as const

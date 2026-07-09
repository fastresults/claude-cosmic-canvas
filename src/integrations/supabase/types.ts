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
      arc_nodes: {
        Row: {
          campaign_id: string
          created_at: string
          draft_id: string | null
          format: string
          id: string
          position: number
          prompt: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          draft_id?: string | null
          format: string
          id?: string
          position: number
          prompt?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          draft_id?: string | null
          format?: string
          id?: string
          position?: number
          prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arc_nodes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arc_nodes_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          meta: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      brain_edges: {
        Row: {
          created_at: string
          dst_id: string
          dst_type: string
          edge_kind: string
          id: string
          meta: Json
          src_id: string
          src_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dst_id: string
          dst_type: string
          edge_kind: string
          id?: string
          meta?: Json
          src_id: string
          src_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          dst_id?: string
          dst_type?: string
          edge_kind?: string
          id?: string
          meta?: Json
          src_id?: string
          src_type?: string
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          arc: Json
          created_at: string
          id: string
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arc?: Json
          created_at?: string
          id?: string
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arc?: Json
          created_at?: string
          id?: string
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_connections: {
        Row: {
          channel: string
          created_at: string
          handle: string | null
          id: string
          oauth_tokens: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          handle?: string | null
          id?: string
          oauth_tokens?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          handle?: string | null
          id?: string
          oauth_tokens?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          arc_node_id: string | null
          body: string
          campaign_id: string | null
          created_at: string
          format: string
          hooks: Json
          id: string
          image_url: string | null
          score: Json
          search_vector: unknown
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arc_node_id?: string | null
          body?: string
          campaign_id?: string | null
          created_at?: string
          format: string
          hooks?: Json
          id?: string
          image_url?: string | null
          score?: Json
          search_vector?: unknown
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arc_node_id?: string | null
          body?: string
          campaign_id?: string | null
          created_at?: string
          format?: string
          hooks?: Json
          id?: string
          image_url?: string | null
          score?: Json
          search_vector?: unknown
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_entries: {
        Row: {
          content: string | null
          created_at: string
          embedding: string | null
          id: string
          kind: string
          last_used_at: string | null
          meta: Json
          source_url: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          kind: string
          last_used_at?: string | null
          meta?: Json
          source_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          meta?: Json
          source_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mcp_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_used_at: string | null
          name: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          snoozed_until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          snoozed_until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          snoozed_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_voice_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          onboarded_at: string | null
          persona_active_id: string | null
          streak_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_voice_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          onboarded_at?: string | null
          persona_active_id?: string | null
          streak_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_voice_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          onboarded_at?: string | null
          persona_active_id?: string | null
          streak_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_voice_id_fkey"
            columns: ["active_voice_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          channel: string
          created_at: string
          draft_id: string
          error: string | null
          id: string
          published_at: string | null
          scheduled_at: string
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          draft_id: string
          error?: string | null
          id?: string
          published_at?: string | null
          scheduled_at: string
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          draft_id?: string
          error?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_voices: {
        Row: {
          category: string | null
          conciseness: number
          created_at: string
          formality: number
          guidelines: string | null
          humor: number
          id: string
          is_visible: boolean
          name: string
          profession: string | null
          samples: Json
          sort_order: number
          tagline: string | null
          technicality: number
          tone: string | null
          updated_at: string
          vocabulary_avoid: string[]
          vocabulary_preferred: string[]
        }
        Insert: {
          category?: string | null
          conciseness?: number
          created_at?: string
          formality?: number
          guidelines?: string | null
          humor?: number
          id?: string
          is_visible?: boolean
          name: string
          profession?: string | null
          samples?: Json
          sort_order?: number
          tagline?: string | null
          technicality?: number
          tone?: string | null
          updated_at?: string
          vocabulary_avoid?: string[]
          vocabulary_preferred?: string[]
        }
        Update: {
          category?: string | null
          conciseness?: number
          created_at?: string
          formality?: number
          guidelines?: string | null
          humor?: number
          id?: string
          is_visible?: boolean
          name?: string
          profession?: string | null
          samples?: Json
          sort_order?: number
          tagline?: string | null
          technicality?: number
          tone?: string | null
          updated_at?: string
          vocabulary_avoid?: string[]
          vocabulary_preferred?: string[]
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
      voice_directives: {
        Row: {
          created_at: string
          directive_text: string
          directive_type: Database["public"]["Enums"]["voice_directive_type"]
          evidence_count: number
          id: string
          persona_id: string | null
          status: Database["public"]["Enums"]["voice_directive_status"]
          updated_at: string
          user_id: string
          voice_profile_id: string
        }
        Insert: {
          created_at?: string
          directive_text: string
          directive_type: Database["public"]["Enums"]["voice_directive_type"]
          evidence_count?: number
          id?: string
          persona_id?: string | null
          status?: Database["public"]["Enums"]["voice_directive_status"]
          updated_at?: string
          user_id: string
          voice_profile_id: string
        }
        Update: {
          created_at?: string
          directive_text?: string
          directive_type?: Database["public"]["Enums"]["voice_directive_type"]
          evidence_count?: number
          id?: string
          persona_id?: string | null
          status?: Database["public"]["Enums"]["voice_directive_status"]
          updated_at?: string
          user_id?: string
          voice_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_directives_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_directives_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_learning_settings: {
        Row: {
          auto_promote_threshold: number
          created_at: string
          enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_promote_threshold?: number
          created_at?: string
          enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_promote_threshold?: number
          created_at?: string
          enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_profiles: {
        Row: {
          category: string | null
          conciseness: number
          created_at: string
          directives: Json
          formality: number
          guidelines: string | null
          humor: number
          id: string
          is_default: boolean
          match_threshold: number
          name: string
          persona_id: string | null
          samples: Json
          signals: Json
          source: string
          technicality: number
          tone: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
          vocabulary_avoid: string[]
          vocabulary_preferred: string[]
        }
        Insert: {
          category?: string | null
          conciseness?: number
          created_at?: string
          directives?: Json
          formality?: number
          guidelines?: string | null
          humor?: number
          id?: string
          is_default?: boolean
          match_threshold?: number
          name?: string
          persona_id?: string | null
          samples?: Json
          signals?: Json
          source?: string
          technicality?: number
          tone?: string | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          vocabulary_avoid?: string[]
          vocabulary_preferred?: string[]
        }
        Update: {
          category?: string | null
          conciseness?: number
          created_at?: string
          directives?: Json
          formality?: number
          guidelines?: string | null
          humor?: number
          id?: string
          is_default?: boolean
          match_threshold?: number
          name?: string
          persona_id?: string | null
          samples?: Json
          signals?: Json
          source?: string
          technicality?: number
          tone?: string | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          vocabulary_avoid?: string[]
          vocabulary_preferred?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "voice_profiles_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_signals: {
        Row: {
          context: Json
          created_at: string
          edited_text: string | null
          id: string
          original_text: string
          persona_id: string | null
          processed_at: string | null
          signal_type: Database["public"]["Enums"]["voice_signal_type"]
          user_id: string
          voice_profile_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          edited_text?: string | null
          id?: string
          original_text: string
          persona_id?: string | null
          processed_at?: string | null
          signal_type: Database["public"]["Enums"]["voice_signal_type"]
          user_id: string
          voice_profile_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          edited_text?: string | null
          id?: string
          original_text?: string
          persona_id?: string | null
          processed_at?: string | null
          signal_type?: Database["public"]["Enums"]["voice_signal_type"]
          user_id?: string
          voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_signals_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_signals_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "user" | "tester" | "admin" | "super_admin"
      voice_directive_status: "suggested" | "active" | "dismissed"
      voice_directive_type:
        | "avoid_word"
        | "prefer_word"
        | "avoid_pattern"
        | "prefer_pattern"
        | "tone_shift"
        | "structural"
      voice_signal_type: "edit" | "approval" | "rejection" | "regeneration"
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
      app_role: ["user", "tester", "admin", "super_admin"],
      voice_directive_status: ["suggested", "active", "dismissed"],
      voice_directive_type: [
        "avoid_word",
        "prefer_word",
        "avoid_pattern",
        "prefer_pattern",
        "tone_shift",
        "structural",
      ],
      voice_signal_type: ["edit", "approval", "rejection", "regeneration"],
    },
  },
} as const

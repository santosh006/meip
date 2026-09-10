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
      backlog_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          aliases: string[] | null
          created_at: string | null
          id: string
          name: string
          sector: string | null
          ticker: string | null
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          name: string
          sector?: string | null
          ticker?: string | null
        }
        Update: {
          aliases?: string[] | null
          created_at?: string | null
          id?: string
          name?: string
          sector?: string | null
          ticker?: string | null
        }
        Relationships: []
      }
      event_links: {
        Row: {
          created_at: string | null
          id: string
          relation: string | null
          source_event: string | null
          target_event: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          relation?: string | null
          source_event?: string | null
          target_event?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          relation?: string | null
          source_event?: string | null
          target_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_links_source_event_fkey"
            columns: ["source_event"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_links_target_event_fkey"
            columns: ["target_event"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          affected_metrics: Json | null
          confidence: number | null
          detected_at: string | null
          entity_id: string | null
          event_type: string
          id: string
          impact_direction: string | null
          impact_score: number | null
          occurred_at: string
          rationale: string | null
          raw: Json | null
          significance: string | null
          source_id: string | null
          source_url: string | null
          summary: string | null
          title: string
        }
        Insert: {
          affected_metrics?: Json | null
          confidence?: number | null
          detected_at?: string | null
          entity_id?: string | null
          event_type: string
          id?: string
          impact_direction?: string | null
          impact_score?: number | null
          occurred_at: string
          rationale?: string | null
          raw?: Json | null
          significance?: string | null
          source_id?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          affected_metrics?: Json | null
          confidence?: number | null
          detected_at?: string | null
          entity_id?: string | null
          event_type?: string
          id?: string
          impact_direction?: string | null
          impact_score?: number | null
          occurred_at?: string
          rationale?: string | null
          raw?: Json | null
          significance?: string | null
          source_id?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_records: {
        Row: {
          confidence: number
          created_at: string | null
          direction: string
          entity_id: string | null
          event_id: string | null
          headline: string
          id: string
          impact_score: number
          metrics: Json | null
          occurred_at: string
          rationale: string | null
          significance: string
        }
        Insert: {
          confidence: number
          created_at?: string | null
          direction: string
          entity_id?: string | null
          event_id?: string | null
          headline: string
          id?: string
          impact_score: number
          metrics?: Json | null
          occurred_at: string
          rationale?: string | null
          significance: string
        }
        Update: {
          confidence?: number
          created_at?: string | null
          direction?: string
          entity_id?: string | null
          event_id?: string | null
          headline?: string
          id?: string
          impact_score?: number
          metrics?: Json | null
          occurred_at?: string
          rationale?: string | null
          significance?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_records_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string | null
          credibility: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          credibility?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          credibility?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          description: string | null
          id: number
          title: string
          updated_at: string
        }
        Insert: {
          completed: boolean
          created_at?: string
          description?: string | null
          id?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_items: {
        Row: {
          content: string | null
          created_at: string | null
          data: Json | null
          id: string
          kind: string
          pinned: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          kind?: string
          pinned?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          kind?: string
          pinned?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
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
    Enums: {},
  },
} as const

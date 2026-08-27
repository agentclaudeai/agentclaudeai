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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          actor: string
          created_at: string
          id: string
          input: string
          kind: string
          ok: boolean
          output: string
          run_id: string
          target: string
          turn: number | null
        }
        Insert: {
          actor: string
          created_at?: string
          id?: string
          input?: string
          kind: string
          ok?: boolean
          output?: string
          run_id: string
          target?: string
          turn?: number | null
        }
        Update: {
          actor?: string
          created_at?: string
          id?: string
          input?: string
          kind?: string
          ok?: boolean
          output?: string
          run_id?: string
          target?: string
          turn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          kind: string
          milestone_position: number | null
          run_id: string
          title: string
          turn: number | null
          version: number
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          kind?: string
          milestone_position?: number | null
          run_id: string
          title: string
          turn?: number | null
          version?: number
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          milestone_position?: number | null
          run_id?: string
          title?: string
          turn?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      beliefs: {
        Row: {
          author: string
          created_at: string
          id: string
          retired_at: string | null
          retired_reason: string | null
          run_id: string
          statement: string
          status: string
          support: number
        }
        Insert: {
          author: string
          created_at?: string
          id?: string
          retired_at?: string | null
          retired_reason?: string | null
          run_id: string
          statement: string
          status?: string
          support?: number
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          retired_at?: string | null
          retired_reason?: string | null
          run_id?: string
          statement?: string
          status?: string
          support?: number
        }
        Relationships: [
          {
            foreignKeyName: "beliefs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_run: {
        Row: {
          budget_usd: number
          created_at: string
          credit_anchor_at: string | null
          credit_anchor_spend_usd: number
          credit_anchor_usd: number
          ends_at: string
          evm_balance: number
          funded_usd: number
          funding_checked_at: string | null
          goal: string
          id: string
          initial_budget_usd: number
          is_active: boolean
          last_shipped: string | null
          last_shipped_at: string | null
          last_tick_at: string | null
          lock_until: string | null
          sol_balance: number
          spent_usd: number
          started_at: string
          status: string
          turn_count: number
          working_label: string | null
          working_note: string | null
          working_since: string | null
        }
        Insert: {
          budget_usd?: number
          created_at?: string
          credit_anchor_at?: string | null
          credit_anchor_spend_usd?: number
          credit_anchor_usd?: number
          ends_at?: string
          evm_balance?: number
          funded_usd?: number
          funding_checked_at?: string | null
          goal: string
          id?: string
          initial_budget_usd?: number
          is_active?: boolean
          last_shipped?: string | null
          last_shipped_at?: string | null
          last_tick_at?: string | null
          lock_until?: string | null
          sol_balance?: number
          spent_usd?: number
          started_at?: string
          status?: string
          turn_count?: number
          working_label?: string | null
          working_note?: string | null
          working_since?: string | null
        }
        Update: {
          budget_usd?: number
          created_at?: string
          credit_anchor_at?: string | null
          credit_anchor_spend_usd?: number
          credit_anchor_usd?: number
          ends_at?: string
          evm_balance?: number
          funded_usd?: number
          funding_checked_at?: string | null
          goal?: string
          id?: string
          initial_budget_usd?: number
          is_active?: boolean
          last_shipped?: string | null
          last_shipped_at?: string | null
          last_tick_at?: string | null
          lock_until?: string | null
          sol_balance?: number
          spent_usd?: number
          started_at?: string
          status?: string
          turn_count?: number
          working_label?: string | null
          working_note?: string | null
          working_since?: string | null
        }
        Relationships: []
      }
      instances: {
        Row: {
          id: string
          label: string
          last_active_at: string | null
          model: string
          role: string
          run_id: string
          spent_usd: number
          state: string
          tokens: number
          turns: number
        }
        Insert: {
          id?: string
          label: string
          last_active_at?: string | null
          model: string
          role: string
          run_id: string
          spent_usd?: number
          state?: string
          tokens?: number
          turns?: number
        }
        Update: {
          id?: string
          label?: string
          last_active_at?: string | null
          model?: string
          role?: string
          run_id?: string
          spent_usd?: number
          state?: string
          tokens?: number
          turns?: number
        }
        Relationships: [
          {
            foreignKeyName: "instances_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      log_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          run_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          run_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          run_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          label: string
          model: string
          output_tokens: number
          run_id: string
          turn: number
        }
        Insert: {
          content: string
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          label: string
          model: string
          output_tokens?: number
          run_id: string
          turn?: number
        }
        Update: {
          content?: string
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          label?: string
          model?: string
          output_tokens?: number
          run_id?: string
          turn?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string
          id: string
          position: number
          run_id: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          position: number
          run_id: string
          status?: string
          summary?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          position?: number
          run_id?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          run_id: string
          slug: string
          title: string
          turn: number | null
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          run_id: string
          slug: string
          title: string
          turn?: number | null
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          run_id?: string
          slug?: string
          title?: string
          turn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string
          detail: string
          done_at: string | null
          done_by: string | null
          id: string
          result: string | null
          run_id: string
          status: string
          title: string
          turn: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          detail?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          result?: string | null
          run_id: string
          status?: string
          title: string
          turn?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          detail?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          result?: string | null
          run_id?: string
          status?: string
          title?: string
          turn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          label: string
          model: string
          output_tokens: number
          run_id: string
          turn: number | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          label: string
          model: string
          output_tokens?: number
          run_id: string
          turn?: number | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          label?: string
          model?: string
          output_tokens?: number
          run_id?: string
          turn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_run"
            referencedColumns: ["id"]
          },
        ]
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

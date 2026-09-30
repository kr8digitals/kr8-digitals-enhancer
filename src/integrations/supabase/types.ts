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
      accounts: {
        Row: {
          attendance_accepted: number | null
          avatar: string | null
          cert_recognition: string | null
          cert_tier: string | null
          country: string | null
          created_at: string
          dob: string | null
          email: string | null
          executive_role: string | null
          graduated: boolean | null
          id: string
          name: string | null
          password: string | null
          phone: string | null
          points: number | null
          referrals: number | null
          skill: string | null
          submissions: number | null
          type: string
          vip: boolean | null
        }
        Insert: {
          attendance_accepted?: number | null
          avatar?: string | null
          cert_recognition?: string | null
          cert_tier?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          executive_role?: string | null
          graduated?: boolean | null
          id: string
          name?: string | null
          password?: string | null
          phone?: string | null
          points?: number | null
          referrals?: number | null
          skill?: string | null
          submissions?: number | null
          type?: string
          vip?: boolean | null
        }
        Update: {
          attendance_accepted?: number | null
          avatar?: string | null
          cert_recognition?: string | null
          cert_tier?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          executive_role?: string | null
          graduated?: boolean | null
          id?: string
          name?: string | null
          password?: string | null
          phone?: string | null
          points?: number | null
          referrals?: number | null
          skill?: string | null
          submissions?: number | null
          type?: string
          vip?: boolean | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          id: string
          path: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          path?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          path?: string | null
          target?: string | null
        }
        Relationships: []
      }
      live_chat: {
        Row: {
          created_at: number | null
          id: string
          is_pinned: boolean | null
          sender_badge: string | null
          sender_id: string | null
          sender_name: string | null
          sender_role: string | null
          stream_id: string | null
          text: string | null
        }
        Insert: {
          created_at?: number | null
          id: string
          is_pinned?: boolean | null
          sender_badge?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          stream_id?: string | null
          text?: string | null
        }
        Update: {
          created_at?: number | null
          id?: string
          is_pinned?: boolean | null
          sender_badge?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          stream_id?: string | null
          text?: string | null
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          access_key: string | null
          assigned_tasks: Json | null
          category: string | null
          created_at: string
          description: string | null
          ended_at: number | null
          host_avatar: string | null
          host_id: string | null
          host_name: string | null
          id: string
          is_live: boolean | null
          peak_viewers: number | null
          pinned_notice: string | null
          poster_url: string | null
          quality: string | null
          recognized_participants: Json | null
          started_at: number | null
          title: string | null
          video_url: string | null
          viewer_count: number | null
          viewers: Json | null
          visibility: string | null
        }
        Insert: {
          access_key?: string | null
          assigned_tasks?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          ended_at?: number | null
          host_avatar?: string | null
          host_id?: string | null
          host_name?: string | null
          id: string
          is_live?: boolean | null
          peak_viewers?: number | null
          pinned_notice?: string | null
          poster_url?: string | null
          quality?: string | null
          recognized_participants?: Json | null
          started_at?: number | null
          title?: string | null
          video_url?: string | null
          viewer_count?: number | null
          viewers?: Json | null
          visibility?: string | null
        }
        Update: {
          access_key?: string | null
          assigned_tasks?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          ended_at?: number | null
          host_avatar?: string | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          is_live?: boolean | null
          peak_viewers?: number | null
          pinned_notice?: string | null
          poster_url?: string | null
          quality?: string | null
          recognized_participants?: Json | null
          started_at?: number | null
          title?: string | null
          video_url?: string | null
          viewer_count?: number | null
          viewers?: Json | null
          visibility?: string | null
        }
        Relationships: []
      }
      mindset_shift_event: {
        Row: {
          config: Json | null
          edition: string | null
          id: string
          updated_at: number | null
        }
        Insert: {
          config?: Json | null
          edition?: string | null
          id: string
          updated_at?: number | null
        }
        Update: {
          config?: Json | null
          edition?: string | null
          id?: string
          updated_at?: number | null
        }
        Relationships: []
      }
      mindset_shift_registrations: {
        Row: {
          admin_note: string | null
          area_to_improve: string | null
          biggest_challenge: string | null
          created_at: string | null
          debt_experience: string | null
          deleted_at: string | null
          edition: string | null
          email: string | null
          financial_situation: string | null
          full_name: string | null
          has_financial_goal: boolean | null
          heard_about: string | null
          hoping_to_learn: string | null
          id: string
          location: string | null
          money_question: string | null
          phone: string | null
          proof_data: string | null
          proof_submitted_at: string | null
          status: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          whatsapp: string | null
        }
        Insert: {
          admin_note?: string | null
          area_to_improve?: string | null
          biggest_challenge?: string | null
          created_at?: string | null
          debt_experience?: string | null
          deleted_at?: string | null
          edition?: string | null
          email?: string | null
          financial_situation?: string | null
          full_name?: string | null
          has_financial_goal?: boolean | null
          heard_about?: string | null
          hoping_to_learn?: string | null
          id: string
          location?: string | null
          money_question?: string | null
          phone?: string | null
          proof_data?: string | null
          proof_submitted_at?: string | null
          status?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          admin_note?: string | null
          area_to_improve?: string | null
          biggest_challenge?: string | null
          created_at?: string | null
          debt_experience?: string | null
          deleted_at?: string | null
          edition?: string | null
          email?: string | null
          financial_situation?: string | null
          full_name?: string | null
          has_financial_goal?: boolean | null
          heard_about?: string | null
          hoping_to_learn?: string | null
          id?: string
          location?: string | null
          money_question?: string | null
          phone?: string | null
          proof_data?: string | null
          proof_submitted_at?: string | null
          status?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      stream_chat_messages: {
        Row: {
          created_at: number | null
          id: string
          is_pinned: boolean | null
          is_private: boolean | null
          recipient_id: string | null
          recipient_name: string | null
          sender_id: string | null
          sender_name: string | null
          sender_role: string | null
          stream_id: string | null
          text: string | null
        }
        Insert: {
          created_at?: number | null
          id: string
          is_pinned?: boolean | null
          is_private?: boolean | null
          recipient_id?: string | null
          recipient_name?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          stream_id?: string | null
          text?: string | null
        }
        Update: {
          created_at?: number | null
          id?: string
          is_pinned?: boolean | null
          is_private?: boolean | null
          recipient_id?: string | null
          recipient_name?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          stream_id?: string | null
          text?: string | null
        }
        Relationships: []
      }
      streams: {
        Row: {
          access_key: string | null
          category: string | null
          chat_permission: string | null
          created_at: string
          description: string | null
          host_avatar: string | null
          host_id: string | null
          host_name: string | null
          id: string
          is_live: boolean | null
          is_locked: boolean | null
          is_recording: boolean | null
          is_suspended: boolean | null
          livekit_room_name: string | null
          spotlight_participant_id: string | null
          started_at: number | null
          title: string | null
          viewer_count: number | null
          viewers: Json | null
          visibility: string | null
        }
        Insert: {
          access_key?: string | null
          category?: string | null
          chat_permission?: string | null
          created_at?: string
          description?: string | null
          host_avatar?: string | null
          host_id?: string | null
          host_name?: string | null
          id: string
          is_live?: boolean | null
          is_locked?: boolean | null
          is_recording?: boolean | null
          is_suspended?: boolean | null
          livekit_room_name?: string | null
          spotlight_participant_id?: string | null
          started_at?: number | null
          title?: string | null
          viewer_count?: number | null
          viewers?: Json | null
          visibility?: string | null
        }
        Update: {
          access_key?: string | null
          category?: string | null
          chat_permission?: string | null
          created_at?: string
          description?: string | null
          host_avatar?: string | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          is_live?: boolean | null
          is_locked?: boolean | null
          is_recording?: boolean | null
          is_suspended?: boolean | null
          livekit_room_name?: string | null
          spotlight_participant_id?: string | null
          started_at?: number | null
          title?: string | null
          viewer_count?: number | null
          viewers?: Json | null
          visibility?: string | null
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

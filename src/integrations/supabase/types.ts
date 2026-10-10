export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      // Legacy table kept for migration
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
      profiles: {
        Row: {
          id: string
          kr8_id: string
          name: string
          email: string
          phone: string | null
          country: string | null
          dob: string | null
          skill: string | null
          avatar: string | null
          bio: string | null
          cover_photo: string | null
          points: number | null
          attendance_accepted: number | null
          submissions: number | null
          referrals: number | null
          graduated: boolean | null
          cert_tier: string | null
          cert_recognition: string | null
          joined: string | null
          created_at: string | null
          updated_at: string | null
          is_placeholder: boolean | null
        }
        Insert: {
          id: string
          kr8_id: string
          name: string
          email: string
          phone?: string | null
          country?: string | null
          dob?: string | null
          skill?: string | null
          avatar?: string | null
          bio?: string | null
          cover_photo?: string | null
          points?: number | null
          attendance_accepted?: number | null
          submissions?: number | null
          referrals?: number | null
          graduated?: boolean | null
          cert_tier?: string | null
          cert_recognition?: string | null
          joined?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_placeholder?: boolean | null
        }
        Update: {
          id?: string
          kr8_id?: string
          name?: string
          email?: string
          phone?: string | null
          country?: string | null
          dob?: string | null
          skill?: string | null
          avatar?: string | null
          bio?: string | null
          cover_photo?: string | null
          points?: number | null
          attendance_accepted?: number | null
          submissions?: number | null
          referrals?: number | null
          graduated?: boolean | null
          cert_tier?: string | null
          cert_recognition?: string | null
          joined?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_placeholder?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: string
          title: string | null
          permissions: Json | null
          granted_by: string | null
          granted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          title?: string | null
          permissions?: Json | null
          granted_by?: string | null
          granted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          title?: string | null
          permissions?: Json | null
          granted_by?: string | null
          granted_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          skill_key: string
          skill_name: string | null
          serial: number | null
          year: number | null
          graduated: boolean | null
          graduated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          skill_key: string
          skill_name?: string | null
          serial?: number | null
          year?: number | null
          graduated?: boolean | null
          graduated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          skill_key?: string
          skill_name?: string | null
          serial?: number | null
          year?: number | null
          graduated?: boolean | null
          graduated_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          id: string
          certificate_code: string
          student_id: string
          kr8_id: string
          student_name: string
          formatted_name: string | null
          skill: string
          skill_name: string | null
          tier: string
          template_url: string | null
          achievement_text: string | null
          additional_notes: string | null
          issued_at: string | null
          issued_by: string | null
          status: string
          email_sent_at: string | null
          email_failure_reason: string | null
          withdrawal_reason: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
          certificate_image_url: string | null
          pdf_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          certificate_code: string
          student_id: string
          kr8_id: string
          student_name: string
          formatted_name?: string | null
          skill: string
          skill_name?: string | null
          tier: string
          template_url?: string | null
          achievement_text?: string | null
          additional_notes?: string | null
          issued_at?: string | null
          issued_by?: string | null
          status?: string
          email_sent_at?: string | null
          email_failure_reason?: string | null
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          certificate_image_url?: string | null
          pdf_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          certificate_code?: string
          student_id?: string
          kr8_id?: string
          student_name?: string
          formatted_name?: string | null
          skill?: string
          skill_name?: string | null
          tier?: string
          template_url?: string | null
          achievement_text?: string | null
          additional_notes?: string | null
          issued_at?: string | null
          issued_by?: string | null
          status?: string
          email_sent_at?: string | null
          email_failure_reason?: string | null
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          certificate_image_url?: string | null
          pdf_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          id: string
          certificate_id: string | null
          recipient_email: string
          status: string
          error_message: string | null
          resend_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          certificate_id?: string | null
          recipient_email: string
          status: string
          error_message?: string | null
          resend_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          certificate_id?: string | null
          recipient_email?: string
          status?: string
          error_message?: string | null
          resend_id?: string | null
          created_at?: string | null
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
      live_rooms: {
        Row: {
          access_key: string | null
          description: string | null
          ended_at: string | null
          host_id: string | null
          host_name: string | null
          id: string
          is_live: boolean
          is_recording: boolean
          mode: string
          started_at: string
          title: string
          visibility: string
          waiting_room: boolean
          created_at: string | null
        }
        Insert: {
          access_key?: string | null
          description?: string | null
          ended_at?: string | null
          host_id?: string | null
          host_name?: string | null
          id: string
          is_live?: boolean
          is_recording?: boolean
          mode?: string
          started_at?: string
          title: string
          visibility?: string
          waiting_room?: boolean
          created_at?: string | null
        }
        Update: {
          access_key?: string | null
          description?: string | null
          ended_at?: string | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          is_live?: boolean
          is_recording?: boolean
          mode?: string
          started_at?: string
          title?: string
          visibility?: string
          waiting_room?: boolean
          created_at?: string | null
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
      room_admissions: {
        Row: {
          created_at: string
          id: string
          room_id: string
          status: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          status?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          status?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          created_at: string
          id: string
          is_deleted: boolean
          is_pinned: boolean
          reactions: Json
          read_by: Json
          reply_to: string | null
          room_id: string
          sender_id: string | null
          sender_name: string | null
          text: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          reactions?: Json
          read_by?: Json
          reply_to?: string | null
          room_id: string
          sender_id?: string | null
          sender_name?: string | null
          text?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          reactions?: Json
          read_by?: Json
          reply_to?: string | null
          room_id?: string
          sender_id?: string | null
          sender_name?: string | null
          text?: string | null
        }
        Relationships: []
      }
      recordings: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_path: string
          host_name: string | null
          id: string
          is_hidden: boolean
          room_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_path: string
          host_name?: string | null
          id?: string
          is_hidden?: boolean
          room_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_path?: string
          host_name?: string | null
          id?: string
          is_hidden?: boolean
          room_id?: string | null
          title?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: { user_uuid: string; role_name: string }
        Returns: boolean
      }
      is_host: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      verify_certificate_public: {
        Args: { cert_code: string }
        Returns: {
          certificate_code: string
          kr8_id: string
          student_name: string
          skill: string
          skill_name: string
          tier: string
          status: string
          issued_at: string
          achievement_text: string
          additional_notes: string
          is_valid: boolean
        }[]
      }
      get_profile_by_kr8_id: {
        Args: { lookup_id: string }
        Returns: {
          kr8_id: string
          name: string
          skill: string
          graduated: boolean
          cert_tier: string
          joined: string
        }[]
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const

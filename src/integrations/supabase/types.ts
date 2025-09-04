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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      challenge_enrollments: {
        Row: {
          challenge_id: string
          enrolled_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          enrolled_at?: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          enrolled_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_enrollments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_final_rewards: {
        Row: {
          challenge_id: string
          coins_reward: number
          created_at: string
          id: string
          position: number
        }
        Insert: {
          challenge_id: string
          coins_reward: number
          created_at?: string
          id?: string
          position: number
        }
        Update: {
          challenge_id?: string
          coins_reward?: number
          created_at?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_final_rewards_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_items: {
        Row: {
          challenge_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number | null
          requires_photo: boolean | null
          title: string
          unlock_days: number[] | null
          unlock_time: string
          xp_points: number | null
        }
        Insert: {
          challenge_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          requires_photo?: boolean | null
          title: string
          unlock_days?: number[] | null
          unlock_time: string
          xp_points?: number | null
        }
        Update: {
          challenge_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          requires_photo?: boolean | null
          title?: string
          unlock_days?: number[] | null
          unlock_time?: string
          xp_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_items_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_rankings: {
        Row: {
          challenge_id: string
          coins_earned: number | null
          created_at: string
          id: string
          position: number
          total_xp: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          coins_earned?: number | null
          created_at?: string
          id?: string
          position: number
          total_xp: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          coins_earned?: number | null
          created_at?: string
          id?: string
          position?: number
          total_xp?: number
          user_id?: string
        }
        Relationships: []
      }
      challenge_rewards: {
        Row: {
          challenge_id: string
          coins_reward: number
          created_at: string
          id: string
          position: number
        }
        Insert: {
          challenge_id: string
          coins_reward: number
          created_at?: string
          id?: string
          position: number
        }
        Update: {
          challenge_id?: string
          coins_reward?: number
          created_at?: string
          id?: string
          position?: number
        }
        Relationships: []
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string
          daily_calories: number | null
          daily_time_minutes: number | null
          description: string
          difficulty_level: string | null
          end_date: string
          give_rewards_on_manual_finalization: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_finished: boolean | null
          manually_finalized: boolean | null
          max_participants: number | null
          start_date: string
          title: string
          total_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          daily_calories?: number | null
          daily_time_minutes?: number | null
          description: string
          difficulty_level?: string | null
          end_date: string
          give_rewards_on_manual_finalization?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_finished?: boolean | null
          manually_finalized?: boolean | null
          max_participants?: number | null
          start_date: string
          title: string
          total_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          daily_calories?: number | null
          daily_time_minutes?: number | null
          description?: string
          difficulty_level?: string | null
          end_date?: string
          give_rewards_on_manual_finalization?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_finished?: boolean | null
          manually_finalized?: boolean | null
          max_participants?: number | null
          start_date?: string
          title?: string
          total_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          challenge_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          coins: number | null
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean | null
          level: number | null
          total_xp: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean | null
          level?: number | null
          total_xp?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean | null
          level?: number | null
          total_xp?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          challenge_item_id: string
          completed_at: string
          id: string
          notes: string | null
          photo_url: string | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          challenge_item_id: string
          completed_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          challenge_item_id?: string
          completed_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_challenge_item_id_fkey"
            columns: ["challenge_item_id"]
            isOneToOne: false
            referencedRelation: "challenge_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalize_expired_challenges: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_admin_user: {
        Args: { user_id?: string }
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

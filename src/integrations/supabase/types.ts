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
      mvp_kill_participants: {
        Row: { kill_id: string; user_id: string; added_by: string; created_at: string }
        Insert: { kill_id: string; user_id: string; added_by: string; created_at?: string }
        Update: { kill_id?: string; user_id?: string; added_by?: string; created_at?: string }
        Relationships: []
      }
      forum_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          thread_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          thread_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_id: string
          body: string
          category: string
          created_at: string
          id: string
          last_post_at: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          category: string
          created_at?: string
          id?: string
          last_post_at?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          last_post_at?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_wishlist: {
        Row: {
          created_at: string
          id: string
          item_key: string
          item_name: string
          item_type: string | null
          note: string | null
          quantity: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          item_name: string
          item_type?: string | null
          note?: string | null
          quantity?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          item_name?: string
          item_type?: string | null
          note?: string | null
          quantity?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gear_wishlist_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_member_roles: {
        Row: {
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guild_notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          item_name: string
          kind: string
          read_at: string | null
          recipient_id: string
          wishlist_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          item_name: string
          kind: string
          read_at?: string | null
          recipient_id: string
          wishlist_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          item_name?: string
          kind?: string
          read_at?: string | null
          recipient_id?: string
          wishlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guild_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_notifications_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "gear_wishlist"
            referencedColumns: ["id"]
          },
        ]
      }
      market_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_listings: {
        Row: {
          created_at: string
          id: string
          item_key: string
          item_name: string
          note: string | null
          price: number
          quantity: number
          seller_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          item_name: string
          note?: string | null
          price: number
          quantity?: number
          seller_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          item_name?: string
          note?: string | null
          price?: number
          quantity?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_offers: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          message: string | null
          responded_at: string | null
          status: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_offers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_kills: {
        Row: {
          boss_key: string
          created_at: string
          id: string
          killed_at: string
          killer_id: string | null
          map_key: string
          reporter_id: string
          tomb_x: number | null
          tomb_y: number | null
        }
        Insert: {
          boss_key: string
          created_at?: string
          id?: string
          killed_at: string
          killer_id?: string | null
          map_key: string
          reporter_id: string
          tomb_x?: number | null
          tomb_y?: number | null
        }
        Update: {
          boss_key?: string
          created_at?: string
          id?: string
          killed_at?: string
          killer_id?: string | null
          map_key?: string
          reporter_id?: string
          tomb_x?: number | null
          tomb_y?: number | null
        }
        Relationships: []
      }
      mvp_tombs: {
        Row: {
          boss_key: string
          map_key: string
          tomb_x: number
          tomb_y: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          boss_key: string
          map_key: string
          tomb_x: number
          tomb_y: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          boss_key?: string
          map_key?: string
          tomb_x?: number
          tomb_y?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          checklist: Json
          created_at: string
          creator_id: string
          id: string
          notes: string | null
          place: string
          signup_mode: string
          starts_at: string
          template: string | null
          title: string
        }
        Insert: {
          checklist?: Json
          created_at?: string
          creator_id: string
          id?: string
          notes?: string | null
          place: string
          signup_mode?: string
          starts_at: string
          template?: string | null
          title: string
        }
        Update: {
          checklist?: Json
          created_at?: string
          creator_id?: string
          id?: string
          notes?: string | null
          place?: string
          signup_mode?: string
          starts_at?: string
          template?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_creator_fk"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_attendance: {
        Row: {
          late_minutes: number | null
          message: string
          party_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          late_minutes?: number | null
          message?: string
          party_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          late_minutes?: number | null
          message?: string
          party_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_attendance_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_readiness: {
        Row: {
          party_id: string
          ready: boolean
          supplies_ready: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          party_id: string
          ready?: boolean
          supplies_ready?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          party_id?: string
          ready?: boolean
          supplies_ready?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_readiness_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_readiness_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_slots: {
        Row: {
          char_name: string | null
          id: string
          job: string | null
          party_id: string
          position: number
          role: string
          user_id: string | null
        }
        Insert: {
          char_name?: string | null
          id?: string
          job?: string | null
          party_id: string
          position: number
          role?: string
          user_id?: string | null
        }
        Update: {
          char_name?: string | null
          id?: string
          job?: string | null
          party_id?: string
          position?: number
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_slots_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_slots_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_specializations: {
        Row: {
          party_id: string
          role: string
          specialization: string
          updated_at: string
          user_id: string
        }
        Insert: {
          party_id: string
          role: string
          specialization: string
          updated_at?: string
          user_id: string
        }
        Update: {
          party_id?: string
          role?: string
          specialization?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_specializations_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_templates: {
        Row: {
          checklist: Json
          created_at: string
          creator_id: string
          description: string
          id: string
          name: string
          roles: string[]
          signup_mode: string
        }
        Insert: {
          checklist?: Json
          created_at?: string
          creator_id: string
          description?: string
          id?: string
          name: string
          roles: string[]
          signup_mode?: string
        }
        Update: {
          checklist?: Json
          created_at?: string
          creator_id?: string
          description?: string
          id?: string
          name?: string
          roles?: string[]
          signup_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_templates_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_waitlist: {
        Row: {
          char_name: string | null
          created_at: string
          id: string
          job: string
          party_id: string
          user_id: string
        }
        Insert: {
          char_name?: string | null
          created_at?: string
          id?: string
          job: string
          party_id: string
          user_id: string
        }
        Update: {
          char_name?: string | null
          created_at?: string
          id?: string
          job?: string
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_waitlist_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          base_lv: number
          bio: string | null
          birthday_day: number | null
          birthday_month: number | null
          char_name: string | null
          created_at: string
          display_name: string
          id: string
          job: string
          job_lv: number
          skill_build: Json | null
          stat_build: Json | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          base_lv?: number
          bio?: string | null
          birthday_day?: number | null
          birthday_month?: number | null
          char_name?: string | null
          created_at?: string
          display_name?: string
          id: string
          job?: string
          job_lv?: number
          skill_build?: Json | null
          stat_build?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          base_lv?: number
          bio?: string | null
          birthday_day?: number | null
          birthday_month?: number | null
          char_name?: string | null
          created_at?: string
          display_name?: string
          id?: string
          job?: string
          job_lv?: number
          skill_build?: Json | null
          stat_build?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      wishlist_help: {
        Row: {
          created_at: string
          helper_id: string
          id: string
          kind: string
          message: string | null
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          helper_id: string
          id?: string
          kind: string
          message?: string | null
          wishlist_id: string
        }
        Update: {
          created_at?: string
          helper_id?: string
          id?: string
          kind?: string
          message?: string | null
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_help_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_help_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "gear_wishlist"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      guild_delete_member: { Args: { target_user: string }; Returns: undefined }
      guild_my_role: { Args: never; Returns: string }
      guild_set_role: {
        Args: { new_role: string; target_user: string }
        Returns: undefined
      }
      is_party_creator: { Args: { _party: string }; Returns: boolean }
      market_respond_offer: {
        Args: { p_action: string; p_offer: string }
        Returns: undefined
      }
      market_withdraw_offer: { Args: { p_offer: string }; Returns: undefined }
      party_job_matches: {
        Args: { p_job: string; p_role: string }
        Returns: boolean
      }
      party_leave: {
        Args: { _member?: string; _party: string }
        Returns: undefined
      }
      party_promote: { Args: { _party: string }; Returns: undefined }
      party_signup: {
        Args: { _char_name?: string; _job: string; _party: string }
        Returns: string
      }
      party_signup_role: {
        Args: {
          _char_name?: string
          _party: string
          _slot?: string
          _waitlist_role?: string
        }
        Returns: string
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

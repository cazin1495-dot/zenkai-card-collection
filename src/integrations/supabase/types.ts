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
      booster_pity: {
        Row: {
          counter: number
          user_id: string
        }
        Insert: {
          counter?: number
          user_id: string
        }
        Update: {
          counter?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booster_pity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          active: boolean
          anilist_id: number | null
          category: string | null
          description: string
          id: string
          image_url: string | null
          name: string
          popularity: number
          quote: string | null
          rarity: Database["public"]["Enums"]["card_rarity"]
          role: string | null
          series: string | null
          sort_order: number
          subtitle_text: string | null
          title: string
          voice_audio_url: string | null
        }
        Insert: {
          active?: boolean
          anilist_id?: number | null
          category?: string | null
          description?: string
          id: string
          image_url?: string | null
          name: string
          popularity?: number
          quote?: string | null
          rarity: Database["public"]["Enums"]["card_rarity"]
          role?: string | null
          series?: string | null
          sort_order?: number
          subtitle_text?: string | null
          title: string
          voice_audio_url?: string | null
        }
        Update: {
          active?: boolean
          anilist_id?: number | null
          category?: string | null
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          popularity?: number
          quote?: string | null
          rarity?: Database["public"]["Enums"]["card_rarity"]
          role?: string | null
          series?: string | null
          sort_order?: number
          subtitle_text?: string | null
          title?: string
          voice_audio_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bonus_boosters: number
          boosters_stored: number
          coins: number
          cosmetics: Json
          created_at: string
          id: string
          last_booster_at: string | null
          level: number
          mission_claims: string[]
          mission_opened: number
          mission_recycled: number
          mission_started_at: string
          reward_packs: Json
          stock_updated_at: string
          username: string
          xp: number
        }
        Insert: {
          bonus_boosters?: number
          boosters_stored?: number
          coins?: number
          cosmetics?: Json
          created_at?: string
          id: string
          last_booster_at?: string | null
          level?: number
          mission_claims?: string[]
          mission_opened?: number
          mission_recycled?: number
          mission_started_at?: string
          reward_packs?: Json
          stock_updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          bonus_boosters?: number
          boosters_stored?: number
          coins?: number
          cosmetics?: Json
          created_at?: string
          id?: string
          last_booster_at?: string | null
          level?: number
          mission_claims?: string[]
          mission_opened?: number
          mission_recycled?: number
          mission_started_at?: string
          reward_packs?: Json
          stock_updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: []
      }
      user_cards: {
        Row: {
          awaken_attempted: boolean
          card_id: string
          id: string
          obtained_at: string
          transcended: boolean
          user_id: string
        }
        Insert: {
          awaken_attempted?: boolean
          card_id: string
          id?: string
          obtained_at?: string
          transcended?: boolean
          user_id: string
        }
        Update: {
          awaken_attempted?: boolean
          card_id?: string
          id?: string
          obtained_at?: string
          transcended?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attempt_transcendance: {
        Args: { _user_card_id: string }
        Returns: boolean
      }
      award_xp: { Args: { _amount: number; _uid: string }; Returns: undefined }
      booster_pity_after: {
        Args: { _counter: number; _mythic: boolean }
        Returns: number
      }
      booster_rarity_for_roll: {
        Args: { _roll: number }
        Returns: Database["public"]["Enums"]["card_rarity"]
      }
      buy_boosters: { Args: { _count: number }; Returns: Json }
      claim_mission: { Args: { _mission: string }; Returns: Json }
      game_state: { Args: never; Returns: Json }
      open_booster: {
        Args: never
        Returns: {
          card_id: string
          next_booster_at: string
        }[]
      }
      open_boosters: {
        Args: { _category: string; _count: number }
        Returns: {
          boosters_left: number
          card_id: string
          stock_updated_at: string
          user_card_id: string
        }[]
      }
      recycle_copy: { Args: { _copy: string }; Returns: number }
      recycle_value: {
        Args: {
          _popularity: number
          _rarity: Database["public"]["Enums"]["card_rarity"]
        }
        Returns: number
      }
      sync_daily: { Args: { _uid: string }; Returns: undefined }
      xp_required: { Args: { _level: number }; Returns: number }
    }
    Enums: {
      card_rarity:
        | "commune"
        | "non_commune"
        | "rare"
        | "epique"
        | "legendaire"
        | "mythique"
        | "transcendance"
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
      card_rarity: [
        "commune",
        "non_commune",
        "rare",
        "epique",
        "legendaire",
        "mythique",
        "transcendance",
      ],
    },
  },
} as const

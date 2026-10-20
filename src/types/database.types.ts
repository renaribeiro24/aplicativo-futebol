export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      group_invitations: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          group_id: string;
          id: string;
          max_uses: number;
          revoked_at: string | null;
          role: string;
          token_hash: string;
          updated_at: string;
          uses_count: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          expires_at: string;
          group_id: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          role: string;
          token_hash: string;
          updated_at?: string;
          uses_count?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          group_id?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          role?: string;
          token_hash?: string;
          updated_at?: string;
          uses_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          joined_at: string;
          player_id: string;
          role: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          joined_at?: string;
          player_id: string;
          role?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          joined_at?: string;
          player_id?: string;
          role?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_attendance: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          match_id: string;
          player_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          match_id: string;
          player_id: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          match_id?: string;
          player_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_attendance_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_attendance_group_id_match_id_fkey";
            columns: ["group_id", "match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["group_id", "id"];
          },
          {
            foreignKeyName: "match_attendance_group_id_player_id_fkey";
            columns: ["group_id", "player_id"];
            isOneToOne: false;
            referencedRelation: "group_members";
            referencedColumns: ["group_id", "player_id"];
          },
        ];
      };
      matches: {
        Row: {
          capacity: number;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          ends_at: string;
          group_id: string;
          id: string;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
          venue_id: string | null;
        };
        Insert: {
          capacity: number;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_at: string;
          group_id: string;
          id?: string;
          starts_at: string;
          status?: string;
          title: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_at?: string;
          group_id?: string;
          id?: string;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_group_id_venue_id_fkey";
            columns: ["group_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["group_id", "id"];
          },
        ];
      };
      players: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          name: string;
          nickname: string | null;
          origin_group_id: string | null;
          preferred_position: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          nickname?: string | null;
          origin_group_id?: string | null;
          preferred_position?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          nickname?: string | null;
          origin_group_id?: string | null;
          preferred_position?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "players_origin_group_fk";
            columns: ["origin_group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          address: string | null;
          created_at: string;
          deleted_at: string | null;
          group_id: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          group_id: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          group_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venues_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_guest: {
        Args: { p_group_id: string; p_name: string; p_nickname?: string };
        Returns: string;
      };
      create_group: {
        Args: {
          p_description?: string;
          p_logo_url?: string;
          p_name: string;
          p_slug: string;
          p_timezone?: string;
        };
        Returns: string;
      };
      create_invitation: {
        Args: {
          p_expires_at: string;
          p_group_id: string;
          p_max_uses?: number;
          p_role: string;
          p_token_hash: string;
        };
        Returns: string;
      };
      list_invitations: {
        Args: { p_group_id: string };
        Returns: {
          created_at: string;
          expires_at: string;
          id: string;
          max_uses: number;
          revoked_at: string;
          role: string;
          uses_count: number;
        }[];
      };
      revoke_invitation: {
        Args: { p_group_id: string; p_invitation_id: string };
        Returns: undefined;
      };
      set_member_role: {
        Args: { p_group_id: string; p_member_id: string; p_role: string };
        Returns: undefined;
      };
      set_member_status: {
        Args: { p_group_id: string; p_member_id: string; p_status: string };
        Returns: undefined;
      };
      transfer_ownership: {
        Args: { p_group_id: string; p_member_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

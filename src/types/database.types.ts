// Manually written to match supabase/migrations/0001_initial_schema.sql
// After creating your Supabase project, regenerate with:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      watchlist: {
        Row: {
          id: string;
          ticker: string;
          company_name: string | null;
          added_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          ticker: string;
          company_name?: string | null;
          added_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          ticker?: string;
          company_name?: string | null;
          added_at?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      institutional_activity: {
        Row: {
          id: string;
          ticker: string;
          source: "quiver_congress" | "quiver_insider" | "quiver_institutional" | "sec_13f" | "house_congress" | "senate_congress" | "sec_form4";
          activity_type: "buy" | "sell" | "increase" | "decrease" | "new_position" | "closed_position";
          actor_name: string | null;
          actor_type: "congress" | "institution" | "insider" | null;
          trade_date: string | null;
          filed_date: string | null;
          value_usd: number | null;
          shares: number | null;
          price_per_share: number | null;
          position_delta_pct: number | null;
          raw_payload: Json | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          ticker: string;
          source: "quiver_congress" | "quiver_insider" | "quiver_institutional" | "sec_13f" | "house_congress" | "senate_congress" | "sec_form4";
          activity_type: "buy" | "sell" | "increase" | "decrease" | "new_position" | "closed_position";
          actor_name?: string | null;
          actor_type?: "congress" | "institution" | "insider" | null;
          trade_date?: string | null;
          filed_date?: string | null;
          value_usd?: number | null;
          shares?: number | null;
          price_per_share?: number | null;
          position_delta_pct?: number | null;
          raw_payload?: Json | null;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          ticker?: string;
          source?: "quiver_congress" | "quiver_insider" | "quiver_institutional" | "sec_13f" | "house_congress" | "senate_congress" | "sec_form4";
          activity_type?: "buy" | "sell" | "increase" | "decrease" | "new_position" | "closed_position";
          actor_name?: string | null;
          actor_type?: "congress" | "institution" | "insider" | null;
          trade_date?: string | null;
          filed_date?: string | null;
          value_usd?: number | null;
          shares?: number | null;
          price_per_share?: number | null;
          position_delta_pct?: number | null;
          raw_payload?: Json | null;
          fetched_at?: string;
        };
        Relationships: [];
      };
      alert_settings: {
        Row: {
          id: string;
          min_trade_value_usd: number;
          alert_congress: boolean;
          alert_insider: boolean;
          alert_institutional: boolean;
          min_position_delta_pct: number;
          quiet_hours_start: string;
          quiet_hours_end: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          min_trade_value_usd?: number;
          alert_congress?: boolean;
          alert_insider?: boolean;
          alert_institutional?: boolean;
          min_position_delta_pct?: number;
          quiet_hours_start?: string;
          quiet_hours_end?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          min_trade_value_usd?: number;
          alert_congress?: boolean;
          alert_insider?: boolean;
          alert_institutional?: boolean;
          min_position_delta_pct?: number;
          quiet_hours_start?: string;
          quiet_hours_end?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          endpoint: string;
          p256dh_key: string;
          auth_secret: string;
          device_label: string | null;
          user_agent: string | null;
          subscribed_at: string;
          last_seen_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          endpoint: string;
          p256dh_key: string;
          auth_secret: string;
          device_label?: string | null;
          user_agent?: string | null;
          subscribed_at?: string;
          last_seen_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          endpoint?: string;
          p256dh_key?: string;
          auth_secret?: string;
          device_label?: string | null;
          user_agent?: string | null;
          subscribed_at?: string;
          last_seen_at?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      alert_history: {
        Row: {
          id: string;
          activity_id: string | null;
          notification_title: string | null;
          notification_body: string | null;
          sent_at: string;
          delivery_status: string;
        };
        Insert: {
          id?: string;
          activity_id?: string | null;
          notification_title?: string | null;
          notification_body?: string | null;
          sent_at?: string;
          delivery_status?: string;
        };
        Update: {
          id?: string;
          activity_id?: string | null;
          notification_title?: string | null;
          notification_body?: string | null;
          sent_at?: string;
          delivery_status?: string;
        };
        Relationships: [];
      };
      fetch_log: {
        Row: {
          id: string;
          source: string;
          status: "success" | "error" | "partial" | null;
          records_fetched: number;
          records_new: number;
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          source: string;
          status?: "success" | "error" | "partial" | null;
          records_fetched?: number;
          records_new?: number;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          source?: string;
          status?: "success" | "error" | "partial" | null;
          records_fetched?: number;
          records_new?: number;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row types
export type WatchlistRow = Database["public"]["Tables"]["watchlist"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["institutional_activity"]["Row"];
export type AlertSettingsRow = Database["public"]["Tables"]["alert_settings"]["Row"];
export type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type AlertHistoryRow = Database["public"]["Tables"]["alert_history"]["Row"];
export type FetchLogRow = Database["public"]["Tables"]["fetch_log"]["Row"];

-- ============================================================
-- Stock Whale Tracker — Initial Schema
-- Run this in your Supabase SQL editor to set up the database
-- ============================================================

-- ── Watchlist ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker       text NOT NULL,
  company_name text,
  added_at     timestamptz DEFAULT now(),
  is_active    boolean DEFAULT true,
  CONSTRAINT watchlist_ticker_unique UNIQUE (ticker)
);

-- ── Core activity event log (append-only) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS institutional_activity (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker             text NOT NULL,
  source             text NOT NULL CHECK (source IN (
                       'quiver_congress', 'quiver_insider',
                       'quiver_institutional', 'sec_13f'
                     )),
  activity_type      text NOT NULL CHECK (activity_type IN (
                       'buy', 'sell', 'increase', 'decrease',
                       'new_position', 'closed_position'
                     )),
  actor_name         text,
  actor_type         text CHECK (actor_type IN ('congress', 'institution', 'insider')),
  trade_date         date,
  filed_date         date,
  value_usd          bigint,              -- stored in cents to avoid float issues
  shares             bigint,
  price_per_share    numeric(10, 4),
  position_delta_pct numeric(6, 2),
  raw_payload        jsonb,
  fetched_at         timestamptz DEFAULT now(),
  CONSTRAINT inst_act_dedup UNIQUE (source, ticker, actor_name, trade_date, activity_type)
);

CREATE INDEX IF NOT EXISTS idx_inst_act_ticker     ON institutional_activity (ticker);
CREATE INDEX IF NOT EXISTS idx_inst_act_fetched    ON institutional_activity (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_act_trade_date ON institutional_activity (trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_inst_act_actor_type ON institutional_activity (actor_type);

-- ── Alert settings (single row for the personal user) ─────────────────────
CREATE TABLE IF NOT EXISTS alert_settings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_trade_value_usd    bigint DEFAULT 100000000,   -- $1,000,000 (stored in cents)
  alert_congress         boolean DEFAULT true,
  alert_insider          boolean DEFAULT true,
  alert_institutional    boolean DEFAULT true,
  min_position_delta_pct numeric(5, 2) DEFAULT 5.0,  -- 5% position change threshold
  quiet_hours_start      time DEFAULT '22:00',
  quiet_hours_end        time DEFAULT '08:00',
  updated_at             timestamptz DEFAULT now()
);

-- Seed the single settings row on first migration
INSERT INTO alert_settings DEFAULT VALUES
  ON CONFLICT DO NOTHING;

-- ── Push notification device subscriptions ────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint      text NOT NULL,
  p256dh_key    text NOT NULL,
  auth_secret   text NOT NULL,
  device_label  text,
  user_agent    text,
  subscribed_at timestamptz DEFAULT now(),
  last_seen_at  timestamptz DEFAULT now(),
  is_active     boolean DEFAULT true,
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

-- ── Alert history (prevents duplicate notifications) ──────────────────────
CREATE TABLE IF NOT EXISTS alert_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id        uuid REFERENCES institutional_activity (id) ON DELETE CASCADE,
  notification_title text,
  notification_body  text,
  sent_at            timestamptz DEFAULT now(),
  delivery_status    text DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS idx_alert_history_activity ON alert_history (activity_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at  ON alert_history (sent_at DESC);

-- ── Cron / fetch job log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fetch_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL,
  status          text CHECK (status IN ('success', 'error', 'partial')),
  records_fetched int DEFAULT 0,
  records_new     int DEFAULT 0,
  error_message   text,
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- For a single-user personal app we enable RLS but allow the service role
-- key (used by cron routes) to bypass it. The anon key used by the browser
-- is also granted access since this is a personal, gated app (auth is
-- enforced at the middleware/session layer).

ALTER TABLE watchlist              ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fetch_log              ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to all tables
CREATE POLICY "authenticated_all" ON watchlist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON institutional_activity
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON alert_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON push_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON alert_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON fetch_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

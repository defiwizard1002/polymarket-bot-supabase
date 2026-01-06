-- Polymarket Monitor Bot - Database Setup Script
-- Execute this in Supabase SQL Editor

-- ============================================
-- 1. Enable Required Extensions
-- ============================================

-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable vault for secure secret storage
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- ============================================
-- 2. Create Tables
-- ============================================

-- Markets table
CREATE TABLE IF NOT EXISTS public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id TEXT UNIQUE NOT NULL,
  slug TEXT,
  question TEXT,
  outcomes JSONB,
  outcome_prices JSONB,
  clob_token_ids JSONB,
  active BOOLEAN DEFAULT true,
  monitored BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Large trades table
CREATE TABLE IF NOT EXISTS public.large_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id TEXT UNIQUE,
  market_condition_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  side TEXT NOT NULL,
  price DECIMAL(10, 6) NOT NULL,
  size DECIMAL(20, 6) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot configuration table
CREATE TABLE IF NOT EXISTS public.bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  chat_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- ============================================
-- 3. Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_markets_condition_id ON public.markets(condition_id);
CREATE INDEX IF NOT EXISTS idx_markets_monitored ON public.markets(monitored) WHERE monitored = true;
CREATE INDEX IF NOT EXISTS idx_large_trades_market ON public.large_trades(market_condition_id);
CREATE INDEX IF NOT EXISTS idx_large_trades_timestamp ON public.large_trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_large_trades_trade_id ON public.large_trades(trade_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON public.notifications(sent_at DESC);

-- ============================================
-- 4. Insert Default Configuration
-- ============================================

INSERT INTO public.bot_config (key, value, description) VALUES
  ('min_bet_size', '1000', '最小大单阈值(USDC)'),
  ('monitor_all_markets', 'true', '是否监控所有市场'),
  ('polling_interval', '5000', '轮询间隔(毫秒)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 5. Store Secrets in Vault
-- ============================================
-- Replace <YOUR_PROJECT_URL> and <YOUR_ANON_KEY> with actual values

SELECT vault.create_secret(
  '<YOUR_PROJECT_URL>',  -- e.g., 'https://eeoanzxkwznmrivvymzc.supabase.co'
  'project_url'
);

SELECT vault.create_secret(
  '<YOUR_ANON_KEY>',  -- Your Supabase Anon Key
  'anon_key'
);

-- ============================================
-- 6. Create Cron Jobs
-- ============================================

-- Monitor new markets every 5 minutes
SELECT cron.schedule(
  'monitor-markets-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:= (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/monitor-markets',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Monitor large trades every 1 minute
SELECT cron.schedule(
  'monitor-trades-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:= (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/monitor-trades',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- ============================================
-- 7. Verify Setup
-- ============================================

-- Check if tables are created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('markets', 'large_trades', 'bot_config', 'notifications');

-- Check if extensions are enabled
SELECT extname FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net', 'vault');

-- Check cron jobs
SELECT * FROM cron.job;

-- Check vault secrets
SELECT name FROM vault.decrypted_secrets;

-- ============================================
-- Setup Complete!
-- ============================================
-- Next: Test your bot by sending /start in Telegram

-- ============================================
-- Supabase Analytics Setup for Inscene PlayTT
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Optimized for tracking per-viewer time and traffic for videos and chats
-- Uses native Google OAuth (not Supabase Auth)

-- ============================================
-- 0. USERS TABLE (Google OAuth Users)
-- ============================================
-- Stores users who sign in with Google
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT NOT NULL UNIQUE, -- Google's user ID (sub claim from JWT)
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  first_sign_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sign_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 1. VIEWERS TABLE (Persistent Anonymous Users)
-- ============================================
-- Tracks unique viewers across sessions (stored in localStorage)
-- Links to Google user when logged in
CREATE TABLE IF NOT EXISTS viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id TEXT NOT NULL UNIQUE, -- Stored in localStorage, persists across sessions
  google_user_id TEXT, -- Links to Google user ID when logged in
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  os TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viewers_viewer_id ON viewers(viewer_id);
CREATE INDEX IF NOT EXISTS idx_viewers_google_user_id ON viewers(google_user_id);
CREATE INDEX IF NOT EXISTS idx_viewers_first_seen ON viewers(first_seen_at);

-- ============================================
-- 2. VIDEO SESSIONS TABLE
-- Tracks each video view with time spent per viewer
-- ============================================
CREATE TABLE IF NOT EXISTS video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Viewer identification
  viewer_id TEXT NOT NULL, -- Persistent across browser sessions (localStorage)
  session_id TEXT NOT NULL, -- Browser session (sessionStorage) for grouping
  google_user_id TEXT, -- Links to Google user ID when logged in
  
  -- Video identification (matches your SERIES_CATALOG structure)
  series_id TEXT NOT NULL, -- 'heart-beats', 'startup-boy-anish', 'deb-filmmaker', 'cricket-coaching'
  series_title TEXT, -- 'Heart Beats', 'Startup Boy Anish', etc.
  episode_id INTEGER NOT NULL, -- 1, 2, 3, 4, 5
  episode_label TEXT, -- 'Episode 01', 'Phase 1', 'Scene 01'
  video_url TEXT,
  
  -- Time tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  watch_duration_seconds INTEGER DEFAULT 0, -- Actual time watched
  video_duration_seconds INTEGER, -- Total video length
  completion_percentage DECIMAL(5,2), -- 0.00 to 100.00
  
  -- Engagement metrics
  is_completed BOOLEAN DEFAULT FALSE, -- Watched to the end
  paused_count INTEGER DEFAULT 0,
  seek_count INTEGER DEFAULT 0,
  muted_at_start BOOLEAN DEFAULT FALSE,
  unmuted_during_watch BOOLEAN DEFAULT FALSE,
  
  -- Context
  entry_point TEXT, -- 'discover_grid', 'choice_modal', 'next_episode_button'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_video_sessions_viewer_id ON video_sessions(viewer_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_google_user_id ON video_sessions(google_user_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_series_episode ON video_sessions(series_id, episode_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_started_at ON video_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_video_sessions_session_id ON video_sessions(session_id);

-- ============================================
-- 3. CHAT SESSIONS TABLE
-- Tracks each chat with time spent per viewer per character
-- ============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Viewer identification
  viewer_id TEXT NOT NULL, -- Persistent across browser sessions
  session_id TEXT NOT NULL, -- Browser session
  google_user_id TEXT, -- Links to Google user ID when logged in
  
  -- Chat identification (matches your character structure)
  character_name TEXT NOT NULL, -- 'Priyank', 'Arzoo', 'Debu', 'Anish', 'Chirag'
  
  -- Context: which series/episode triggered this chat (can be null if from chat history)
  series_id TEXT, -- Can be null if opened from chat history
  series_title TEXT,
  episode_id INTEGER,
  episode_label TEXT,
  
  -- Time tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0, -- Total time in chat
  
  -- Engagement metrics
  message_count INTEGER DEFAULT 0, -- Total messages
  user_message_count INTEGER DEFAULT 0, -- Messages sent by user
  assistant_message_count INTEGER DEFAULT 0, -- AI responses
  avg_response_time_ms INTEGER, -- Avg time between user msg and AI response
  
  -- UI context
  is_whatsapp_style BOOLEAN DEFAULT FALSE,
  entry_point TEXT NOT NULL, -- 'video_sidebar', 'video_end_screen', 'choice_modal', 'chat_history'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_viewer_id ON chat_sessions(viewer_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_google_user_id ON chat_sessions(google_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_character ON chat_sessions(character_name);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_started_at ON chat_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_series_episode ON chat_sessions(series_id, episode_id);

-- ============================================
-- 4. CHAT MESSAGES TABLE (Persistent Chat History)
-- ============================================
-- Stores individual messages for logged-in users
-- Allows chat history to persist across sessions
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification (required - only for logged in users)
  google_user_id TEXT NOT NULL,
  
  -- Character this chat is with
  character_name TEXT NOT NULL, -- 'Priyank', 'Arzoo', 'Debu', 'Anish', 'Chirag'
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  
  -- Timestamp
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Optional context
  series_id TEXT,
  episode_id INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_google_user_id ON chat_messages(google_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_character ON chat_messages(character_name);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_character ON chat_messages(google_user_id, character_name);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at ON chat_messages(sent_at);

-- ============================================
-- 5. PAGE VIEWS TABLE (Traffic Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  google_user_id TEXT, -- Links to Google user ID when logged in
  
  -- What was viewed
  view_type TEXT NOT NULL, -- 'app_open', 'discover', 'chats_tab', 'series_modal', 'video', 'chat'
  
  -- Context
  series_id TEXT,
  episode_id INTEGER,
  character_name TEXT,
  tab_name TEXT, -- 'For you', 'Grow with me', 'Dream World'
  
  -- Timing
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER, -- How long they stayed on this view
  
  -- Traffic source
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_viewer_id ON page_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_page_views_google_user_id ON page_views(google_user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_view_type ON page_views(view_type);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Allow public inserts
CREATE POLICY "Allow public inserts on users"
  ON users FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public inserts on viewers"
  ON viewers FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public inserts on video_sessions"
  ON video_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public inserts on chat_sessions"
  ON chat_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public inserts on page_views"
  ON page_views FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow updates (for tracking duration/end times and linking users)
CREATE POLICY "Allow public updates on users"
  ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public updates on viewers"
  ON viewers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public updates on video_sessions"
  ON video_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public updates on chat_sessions"
  ON chat_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Allow selects (needed for .select() after updates and for analytics queries)
CREATE POLICY "Allow public select on video_sessions"
  ON video_sessions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public select on chat_sessions"
  ON chat_sessions FOR SELECT TO anon, authenticated USING (true);

-- Chat messages policies (insert, select, delete for the owning user)
CREATE POLICY "Allow public inserts on chat_messages"
  ON chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on chat_messages"
  ON chat_messages FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public delete on chat_messages"
  ON chat_messages FOR DELETE TO anon, authenticated USING (true);

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- View: Traffic & Time Per Video Per Viewer
CREATE OR REPLACE VIEW video_analytics AS
SELECT 
  series_id,
  series_title,
  episode_id,
  episode_label,
  COUNT(*) as total_views,
  COUNT(DISTINCT viewer_id) as unique_viewers,
  COUNT(DISTINCT google_user_id) as logged_in_viewers,
  COUNT(DISTINCT session_id) as unique_sessions,
  
  -- Time metrics
  SUM(watch_duration_seconds) as total_watch_time_seconds,
  AVG(watch_duration_seconds) as avg_watch_time_seconds,
  MAX(watch_duration_seconds) as max_watch_time_seconds,
  AVG(completion_percentage) as avg_completion_percentage,
  
  -- Engagement
  COUNT(*) FILTER (WHERE is_completed = true) as completed_views,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_completed = true) / NULLIF(COUNT(*), 0), 2) as completion_rate,
  
  -- Rewatch rate (views per unique viewer)
  ROUND(COUNT(*)::DECIMAL / NULLIF(COUNT(DISTINCT viewer_id), 0), 2) as avg_views_per_viewer
  
FROM video_sessions
GROUP BY series_id, series_title, episode_id, episode_label;

-- View: Traffic & Time Per Chat Per Viewer
CREATE OR REPLACE VIEW chat_analytics AS
SELECT 
  character_name,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT viewer_id) as unique_chatters,
  COUNT(DISTINCT google_user_id) as logged_in_chatters,
  COUNT(DISTINCT session_id) as unique_browser_sessions,
  
  -- Time metrics
  SUM(duration_seconds) as total_time_seconds,
  AVG(duration_seconds) as avg_duration_seconds,
  MAX(duration_seconds) as max_duration_seconds,
  
  -- Engagement
  SUM(message_count) as total_messages,
  AVG(message_count) as avg_messages_per_session,
  SUM(user_message_count) as total_user_messages,
  
  -- Chat frequency per viewer
  ROUND(COUNT(*)::DECIMAL / NULLIF(COUNT(DISTINCT viewer_id), 0), 2) as avg_chats_per_viewer,
  
  -- Entry points breakdown
  COUNT(*) FILTER (WHERE entry_point = 'video_sidebar') as from_video_sidebar,
  COUNT(*) FILTER (WHERE entry_point = 'video_end_screen') as from_video_end,
  COUNT(*) FILTER (WHERE entry_point = 'choice_modal') as from_choice_modal,
  COUNT(*) FILTER (WHERE entry_point = 'chat_history') as from_chat_history
  
FROM chat_sessions
GROUP BY character_name;

-- View: Per-Viewer Summary (for individual viewer analysis)
CREATE OR REPLACE VIEW viewer_summary AS
SELECT 
  v.viewer_id,
  v.google_user_id,
  u.email as user_email,
  u.name as user_name,
  v.first_seen_at,
  v.last_seen_at,
  v.visit_count,
  v.device_type,
  
  -- Video stats for this viewer
  COUNT(DISTINCT vs.id) as videos_watched,
  SUM(vs.watch_duration_seconds) as total_video_time_seconds,
  COUNT(DISTINCT vs.series_id) as series_explored,
  
  -- Chat stats for this viewer
  COUNT(DISTINCT cs.id) as chat_sessions,
  SUM(cs.duration_seconds) as total_chat_time_seconds,
  SUM(cs.message_count) as total_messages_sent,
  COUNT(DISTINCT cs.character_name) as characters_chatted_with
  
FROM viewers v
LEFT JOIN users u ON v.google_user_id = u.google_id
LEFT JOIN video_sessions vs ON v.viewer_id = vs.viewer_id
LEFT JOIN chat_sessions cs ON v.viewer_id = cs.viewer_id
GROUP BY v.viewer_id, v.google_user_id, u.email, u.name, v.first_seen_at, v.last_seen_at, v.visit_count, v.device_type;

-- View: Daily Traffic Summary
CREATE OR REPLACE VIEW daily_traffic AS
SELECT 
  DATE(viewed_at) as date,
  
  -- Overall traffic
  COUNT(*) as total_page_views,
  COUNT(DISTINCT viewer_id) as unique_visitors,
  COUNT(DISTINCT google_user_id) as logged_in_visitors,
  COUNT(DISTINCT session_id) as unique_sessions,
  
  -- Breakdown by view type
  COUNT(*) FILTER (WHERE view_type = 'app_open') as app_opens,
  COUNT(*) FILTER (WHERE view_type = 'video') as video_views,
  COUNT(*) FILTER (WHERE view_type = 'chat') as chat_opens,
  
  -- Tab engagement
  COUNT(*) FILTER (WHERE tab_name = 'For you') as for_you_views,
  COUNT(*) FILTER (WHERE tab_name = 'Grow with me') as grow_with_me_views,
  COUNT(*) FILTER (WHERE tab_name = 'Dream World') as dream_world_views
  
FROM page_views
GROUP BY DATE(viewed_at)
ORDER BY date DESC;

-- View: Registered Users Summary
CREATE OR REPLACE VIEW user_analytics AS
SELECT 
  u.google_id,
  u.email,
  u.name,
  u.avatar_url,
  u.first_sign_in,
  u.last_sign_in,
  
  -- Engagement stats
  COUNT(DISTINCT vs.id) as videos_watched,
  SUM(vs.watch_duration_seconds) as total_video_time_seconds,
  COUNT(DISTINCT cs.id) as chat_sessions,
  SUM(cs.duration_seconds) as total_chat_time_seconds,
  SUM(cs.message_count) as total_messages
  
FROM users u
LEFT JOIN video_sessions vs ON u.google_id = vs.google_user_id
LEFT JOIN chat_sessions cs ON u.google_id = cs.google_user_id
GROUP BY u.google_id, u.email, u.name, u.avatar_url, u.first_sign_in, u.last_sign_in;

-- ============================================
-- DONE! 
-- ============================================
-- Your schema is ready for native Google OAuth. Key features:
--
-- 1. users table - Stores Google OAuth users
-- 2. google_user_id - Links anonymous viewers to Google users
-- 3. viewer_id (localStorage) - Tracks same user across browser sessions
-- 4. session_id (sessionStorage) - Groups activity within one visit
-- 5. Pre-built views for easy analytics queries
--
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Get your Supabase URL and anon key from Settings > API
-- 3. Get Google OAuth Client ID from Google Cloud Console
-- 4. Add to .env.local:
--    VITE_SUPABASE_URL=your-supabase-url
--    VITE_SUPABASE_ANON_KEY=your-anon-key
--    VITE_GOOGLE_CLIENT_ID=your-google-client-id

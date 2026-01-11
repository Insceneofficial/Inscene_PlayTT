-- ============================================
-- Streaks, Points & Leaderboard Schema for Inscene PlayTT
-- ============================================
-- Tracks user activity streaks, points earned, and creator-specific leaderboards

-- ============================================
-- 1. USER STREAKS TABLE
-- ============================================
-- Tracks daily activity streaks per user per creator
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  
  -- Creator/character this streak is with
  creator_id TEXT NOT NULL, -- 'Debu', 'Anish', 'Chirag'
  
  -- Streak tracking
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  
  -- Activity types tracked
  last_video_watch_date DATE,
  last_chat_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one streak record per user per creator
  UNIQUE(google_user_id, creator_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_streaks_google_user_id ON user_streaks(google_user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_creator_id ON user_streaks(creator_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC);

-- ============================================
-- 2. DAILY ACTIVITY LOG TABLE
-- ============================================
-- Logs daily activity for streak tracking
CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  
  -- Creator context
  creator_id TEXT NOT NULL,
  
  -- Activity date (one entry per user per creator per day)
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Activity flags (at least one must be true)
  watched_video BOOLEAN DEFAULT FALSE,
  chatted BOOLEAN DEFAULT FALSE,
  completed_goal BOOLEAN DEFAULT FALSE,
  
  -- Activity counts for the day
  videos_watched INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  video_watch_seconds INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one activity record per user per creator per day
  UNIQUE(google_user_id, creator_id, activity_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_activity_user ON daily_activity(google_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_creator ON daily_activity(creator_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_creator_date ON daily_activity(google_user_id, creator_id, activity_date);

-- ============================================
-- 3. USER POINTS TABLE
-- ============================================
-- Tracks total points per user per creator
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  
  -- Creator context (NULL for global points)
  creator_id TEXT,
  
  -- Points breakdown
  total_points INTEGER DEFAULT 0,
  streak_points INTEGER DEFAULT 0,
  goal_points INTEGER DEFAULT 0,
  video_points INTEGER DEFAULT 0,
  chat_points INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one points record per user per creator
  UNIQUE(google_user_id, creator_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_points_google_user_id ON user_points(google_user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_creator_id ON user_points(creator_id);
CREATE INDEX IF NOT EXISTS idx_user_points_total_points ON user_points(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_creator_total ON user_points(creator_id, total_points DESC);

-- ============================================
-- 4. POINTS TRANSACTIONS TABLE
-- ============================================
-- Logs individual point earning events
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  
  -- Creator context
  creator_id TEXT,
  
  -- Transaction details
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'streak_daily',      -- Daily streak bonus (5 points)
    'streak_milestone',  -- Milestone bonus (7 day = 50, 30 day = 200)
    'goal_completed',    -- Goal completion (100 points)
    'video_watched',     -- Video watched (10 points)
    'video_completed',   -- Video completed (20 bonus points)
    'chat_session',      -- Chat session started (5 points)
    'chat_messages',     -- Chat messages sent (1 point each, max 10 per day)
    'first_activity'     -- First activity with creator (25 points)
  )),
  
  -- Context metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(google_user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_creator ON points_transactions(creator_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created ON points_transactions(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- User Streaks policies
CREATE POLICY "Allow public inserts on user_streaks"
  ON user_streaks FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on user_streaks"
  ON user_streaks FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public updates on user_streaks"
  ON user_streaks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Daily Activity policies
CREATE POLICY "Allow public inserts on daily_activity"
  ON daily_activity FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on daily_activity"
  ON daily_activity FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public updates on daily_activity"
  ON daily_activity FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- User Points policies
CREATE POLICY "Allow public inserts on user_points"
  ON user_points FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on user_points"
  ON user_points FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public updates on user_points"
  ON user_points FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Points Transactions policies
CREATE POLICY "Allow public inserts on points_transactions"
  ON points_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on points_transactions"
  ON points_transactions FOR SELECT TO anon, authenticated USING (true);

-- ============================================
-- VIEWS
-- ============================================

-- View: Creator Leaderboard
CREATE OR REPLACE VIEW creator_leaderboard AS
SELECT 
  up.creator_id,
  up.google_user_id,
  u.name as user_name,
  u.avatar_url,
  up.total_points,
  us.current_streak,
  us.longest_streak,
  RANK() OVER (PARTITION BY up.creator_id ORDER BY up.total_points DESC) as rank,
  COUNT(*) OVER (PARTITION BY up.creator_id) as total_users,
  ROUND(
    100.0 * (COUNT(*) OVER (PARTITION BY up.creator_id) - RANK() OVER (PARTITION BY up.creator_id ORDER BY up.total_points DESC) + 1) / 
    NULLIF(COUNT(*) OVER (PARTITION BY up.creator_id), 0), 
    1
  ) as top_percentage
FROM user_points up
LEFT JOIN users u ON up.google_user_id = u.google_id
LEFT JOIN user_streaks us ON up.google_user_id = us.google_user_id AND up.creator_id = us.creator_id
WHERE up.creator_id IS NOT NULL
ORDER BY up.creator_id, up.total_points DESC;

-- View: Global Leaderboard
CREATE OR REPLACE VIEW global_leaderboard AS
SELECT 
  up.google_user_id,
  u.name as user_name,
  u.avatar_url,
  SUM(up.total_points) as total_points,
  MAX(us.current_streak) as best_current_streak,
  MAX(us.longest_streak) as best_longest_streak,
  COUNT(DISTINCT up.creator_id) as creators_engaged,
  RANK() OVER (ORDER BY SUM(up.total_points) DESC) as rank
FROM user_points up
LEFT JOIN users u ON up.google_user_id = u.google_id
LEFT JOIN user_streaks us ON up.google_user_id = us.google_user_id AND up.creator_id = us.creator_id
WHERE up.creator_id IS NOT NULL
GROUP BY up.google_user_id, u.name, u.avatar_url
ORDER BY total_points DESC;

-- View: User Summary with Streaks & Points
CREATE OR REPLACE VIEW user_engagement_summary AS
SELECT 
  us.google_user_id,
  us.creator_id,
  u.name as user_name,
  u.avatar_url,
  us.current_streak,
  us.longest_streak,
  us.last_activity_date,
  up.total_points,
  up.streak_points,
  up.goal_points,
  up.video_points,
  up.chat_points,
  -- Recent activity stats (last 7 days)
  (SELECT COUNT(*) FROM daily_activity da 
   WHERE da.google_user_id = us.google_user_id 
   AND da.creator_id = us.creator_id 
   AND da.activity_date >= CURRENT_DATE - INTERVAL '7 days') as active_days_last_week,
  (SELECT SUM(videos_watched) FROM daily_activity da 
   WHERE da.google_user_id = us.google_user_id 
   AND da.creator_id = us.creator_id 
   AND da.activity_date >= CURRENT_DATE - INTERVAL '7 days') as videos_last_week
FROM user_streaks us
LEFT JOIN user_points up ON us.google_user_id = up.google_user_id AND us.creator_id = up.creator_id
LEFT JOIN users u ON us.google_user_id = u.google_id;

-- ============================================
-- DONE!
-- ============================================
-- Run this SQL in Supabase SQL Editor after running supabase_setup.sql and goals_schema.sql

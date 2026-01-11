-- ============================================
-- Goals Schema for Inscene PlayTT
-- ============================================
-- Minimal goal tracking integrated with chat-driven AI coaching

-- ============================================
-- 1. GOALS TABLE
-- ============================================
-- Stores user goals per creator
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  
  -- Creator/character this goal is with
  creator_id TEXT NOT NULL, -- 'Priyank', 'Arzoo', 'Debu', 'Anish', 'Chirag'
  
  -- Goal details
  title TEXT NOT NULL,
  daily_task TEXT NOT NULL,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  commitment_days INTEGER DEFAULT 5, -- days per week user committed to
  blocker TEXT, -- what usually blocks consistency
  
  -- Timeline
  target_date DATE, -- when the user wants to complete this goal by
  duration_days INTEGER DEFAULT 30, -- default 30-day goal
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_google_user_id ON goals(google_user_id);
CREATE INDEX IF NOT EXISTS idx_goals_creator_id ON goals(creator_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_user_creator ON goals(google_user_id, creator_id);

-- ============================================
-- 2. GOAL PROGRESS TABLE
-- ============================================
-- Tracks daily progress for each goal
CREATE TABLE IF NOT EXISTS goal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to goal
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  
  -- Progress tracking
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  streak_count INTEGER NOT NULL DEFAULT 0,
  
  -- Optional notes from AI
  ai_feedback TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal_id ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_date ON goal_progress(date);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal_date ON goal_progress(goal_id, date);

-- Unique constraint: one progress entry per goal per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_progress_unique ON goal_progress(goal_id, date);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;

-- Goals policies
CREATE POLICY "Allow public inserts on goals"
  ON goals FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on goals"
  ON goals FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public updates on goals"
  ON goals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete on goals"
  ON goals FOR DELETE TO anon, authenticated USING (true);

-- Goal progress policies
CREATE POLICY "Allow public inserts on goal_progress"
  ON goal_progress FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on goal_progress"
  ON goal_progress FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public updates on goal_progress"
  ON goal_progress FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete on goal_progress"
  ON goal_progress FOR DELETE TO anon, authenticated USING (true);

-- ============================================
-- VIEWS
-- ============================================

-- View: Active goals with current streak
CREATE OR REPLACE VIEW active_goals_with_streak AS
SELECT 
  g.id,
  g.google_user_id,
  g.creator_id,
  g.title,
  g.daily_task,
  g.difficulty_level,
  g.commitment_days,
  g.blocker,
  g.status,
  g.created_at,
  g.updated_at,
  COALESCE(
    (SELECT streak_count FROM goal_progress 
     WHERE goal_id = g.id 
     ORDER BY date DESC 
     LIMIT 1), 
    0
  ) as current_streak,
  (SELECT date FROM goal_progress 
   WHERE goal_id = g.id AND completed = true 
   ORDER BY date DESC 
   LIMIT 1) as last_completed_date,
  (SELECT completed FROM goal_progress 
   WHERE goal_id = g.id AND date = CURRENT_DATE 
   LIMIT 1) as completed_today
FROM goals g
WHERE g.status = 'active';

-- ============================================
-- DONE!
-- ============================================
-- Run this SQL in Supabase SQL Editor after running supabase_setup.sql

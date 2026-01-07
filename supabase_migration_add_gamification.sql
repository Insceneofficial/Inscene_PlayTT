-- ============================================
-- Migration: Add Gamification System
-- Purpose: Track streaks, badges, points, and activity logs for goal tracking gamification
-- Date: 2024
-- ============================================

-- Create user_gamification table
CREATE TABLE IF NOT EXISTS user_gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  
  -- Streak tracking
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_check_in_date DATE,
  
  -- Points and level
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one gamification record per user per character
  UNIQUE(google_user_id, character_name)
);

-- Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  
  -- Badge information
  badge_type TEXT NOT NULL CHECK (badge_type IN (
    'first_goal',
    'first_milestone',
    'streak_3',
    'streak_7',
    'streak_30',
    'milestone_master',
    'consistent',
    'goal_completed'
  )),
  
  -- Timestamps
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one badge of each type per user per character
  UNIQUE(google_user_id, character_name, badge_type)
);

-- Create goal_activity_log table
CREATE TABLE IF NOT EXISTS goal_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  goal_id UUID REFERENCES user_goals(id) ON DELETE CASCADE,
  
  -- Activity information
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'check_in',
    'milestone_started',
    'milestone_completed',
    'goal_completed',
    'badge_earned'
  )),
  
  -- Points and metadata
  points_earned INTEGER DEFAULT 0,
  metadata JSONB, -- Store additional info like milestone_index, badge_type, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_gamification_user_character ON user_gamification(google_user_id, character_name);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_character ON user_badges(google_user_id, character_name);
CREATE INDEX IF NOT EXISTS idx_goal_activity_log_user_character ON goal_activity_log(google_user_id, character_name);
CREATE INDEX IF NOT EXISTS idx_goal_activity_log_created_at ON goal_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_activity_log_goal_id ON goal_activity_log(goal_id);

-- Add comments for documentation
COMMENT ON TABLE user_gamification IS 'Stores gamification stats (streaks, points, level) for each user per character';
COMMENT ON TABLE user_badges IS 'Tracks earned badges for each user per character';
COMMENT ON TABLE goal_activity_log IS 'Logs all goal-related activities for streak calculation and analytics';

-- ============================================
-- Notes:
-- - One gamification record per user per character
-- - Badges are unique per type per user per character
-- - Activity log tracks all events for streak calculation
-- - Points are cumulative and level is calculated from total_points
-- ============================================


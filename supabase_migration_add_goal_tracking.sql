-- ============================================
-- Migration: Add Goal Tracking System
-- Purpose: Track user goals, milestones, and progress
-- Date: 2024
-- ============================================

-- Create user_goals table
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  character_name TEXT NOT NULL, -- Which character is helping with this goal
  
  -- Goal content
  goal_text TEXT NOT NULL,
  current_status TEXT NOT NULL CHECK (current_status IN ('Not Started', 'In Progress', 'Stuck', 'Completed')),
  current_milestone_index INTEGER DEFAULT 0,
  
  -- Milestones (stored as JSONB array)
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Progress tracking
  progress_summary TEXT,
  last_check_in TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_goals_google_user_id ON user_goals(google_user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_character ON user_goals(google_user_id, character_name);
CREATE INDEX IF NOT EXISTS idx_user_goals_updated_at ON user_goals(updated_at);

-- Add comment for documentation
COMMENT ON TABLE user_goals IS 'Stores user goals and milestone progress for goal-tracking chatbot feature';
COMMENT ON COLUMN user_goals.milestones IS 'JSONB array of milestone objects: [{id, title, status, order}, ...]';
COMMENT ON COLUMN user_goals.current_status IS 'Overall goal status: Not Started, In Progress, Stuck, or Completed';

-- ============================================
-- Notes:
-- - One active goal per user per character
-- - Milestones stored as JSONB for flexibility
-- - Status can only be one of the 4 defined values
-- ============================================


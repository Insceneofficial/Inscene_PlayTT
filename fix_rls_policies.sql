-- ============================================
-- Fix RLS Policies for video_sessions and chat_sessions
-- Run this in your Supabase SQL Editor
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public select on video_sessions" ON video_sessions;
DROP POLICY IF EXISTS "Allow public select on chat_sessions" ON chat_sessions;

-- Create SELECT policies (needed for .select() after updates)
CREATE POLICY "Allow public select on video_sessions"
  ON video_sessions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public select on chat_sessions"
  ON chat_sessions FOR SELECT TO anon, authenticated USING (true);

-- Verify UPDATE policies exist (recreate if needed)
DROP POLICY IF EXISTS "Allow public updates on video_sessions" ON video_sessions;
DROP POLICY IF EXISTS "Allow public updates on chat_sessions" ON chat_sessions;

CREATE POLICY "Allow public updates on video_sessions"
  ON video_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public updates on chat_sessions"
  ON chat_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);


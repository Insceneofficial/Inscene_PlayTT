-- ============================================
-- Exclude Privileged Users from Leaderboards
-- ============================================
-- These users have full access but should not appear in leaderboards
-- Run this SQL in Supabase SQL Editor after running supabase_setup.sql and goals_schema.sql

-- Update Creator Leaderboard View to exclude privileged users
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
  AND (u.email IS NULL OR u.email NOT IN (
    'insceneofficial@gmail.com',
    'Chiragcsaini09@gmail.com',
    'rajatwork2000@gmail.com'
  ))
ORDER BY up.creator_id, up.total_points DESC;

-- Update Global Leaderboard View to exclude privileged users
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
  AND (u.email IS NULL OR u.email NOT IN (
    'insceneofficial@gmail.com',
    'Chiragcsaini09@gmail.com',
    'rajatwork2000@gmail.com'
  ))
GROUP BY up.google_user_id, u.name, u.avatar_url
ORDER BY total_points DESC;

-- ============================================
-- DONE!
-- ============================================
-- After running this, privileged users will be excluded from all leaderboards
-- They will still have full access to all episodes and unlimited chats

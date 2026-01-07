-- ============================================
-- Migration: Add prompt_version to chat_sessions
-- Purpose: Track prompt version for each chat session to enable automatic migration
-- Date: 2024
-- ============================================

-- Add prompt_version column to chat_sessions table
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS prompt_version TEXT;

-- Add index for faster queries by prompt version
CREATE INDEX IF NOT EXISTS idx_chat_sessions_prompt_version 
ON chat_sessions(character_name, prompt_version);

-- Add comment for documentation
COMMENT ON COLUMN chat_sessions.prompt_version IS 'Version of the character prompt used for this session (e.g., "v2.0"). Used to detect when prompt updates require new sessions.';

-- ============================================
-- Notes:
-- - Existing rows will have NULL prompt_version (treated as v1.0)
-- - New sessions will automatically get the current prompt version
-- - When prompt version changes, old sessions continue with old behavior
-- - New sessions always use the latest prompt version
-- ============================================






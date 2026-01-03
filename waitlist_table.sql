-- ============================================
-- WAITLIST TABLE
-- Stores users who want to join premium subscription waitlist
-- ============================================
CREATE TABLE IF NOT EXISTS premium_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  google_user_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  
  -- Timestamp
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'notified', 'subscribed'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_google_user_id ON premium_waitlist(google_user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON premium_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_joined_at ON premium_waitlist(joined_at);

-- RLS Policies
ALTER TABLE premium_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public inserts on premium_waitlist"
  ON premium_waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on premium_waitlist"
  ON premium_waitlist FOR SELECT TO anon, authenticated USING (true);


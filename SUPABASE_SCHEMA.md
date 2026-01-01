# Supabase Analytics Schema for Inscene PlayTT

This document describes the database schema for tracking analytics in the Inscene PlayTT app.

## Authentication

The app uses **native Google OAuth 2.0** (not Supabase Auth) for user authentication.

### Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add your domains to **Authorized JavaScript origins**:
   - `http://localhost:5173` (for development)
   - `https://yourdomain.com` (for production)
7. Copy the **Client ID**
8. Add to your `.env.local`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

## Environment Variables

Add these to your `.env.local` file:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## Tables Overview

### 1. `users` - Google OAuth Users

Stores users who sign in with Google.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| google_id | TEXT | Google's user ID (unique) |
| email | TEXT | User's email |
| name | TEXT | User's display name |
| avatar_url | TEXT | Google profile picture URL |
| first_sign_in | TIMESTAMPTZ | First login timestamp |
| last_sign_in | TIMESTAMPTZ | Most recent login |

### 2. `viewers` - Persistent Anonymous Visitors

Tracks unique visitors using localStorage-based IDs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| viewer_id | TEXT | Unique ID stored in localStorage |
| google_user_id | TEXT | Links to users.google_id when logged in |
| first_seen_at | TIMESTAMPTZ | First visit timestamp |
| last_seen_at | TIMESTAMPTZ | Most recent visit |
| visit_count | INTEGER | Total visits |
| device_type | TEXT | mobile/tablet/desktop |
| browser | TEXT | Chrome/Safari/Firefox/etc |

### 3. `video_sessions` - Video Watch Tracking

Tracks each video view with detailed engagement metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| viewer_id | TEXT | Links to viewers table |
| session_id | TEXT | Browser session ID |
| google_user_id | TEXT | Links to users when logged in |
| series_id | TEXT | e.g., 'heart-beats' |
| series_title | TEXT | e.g., 'Heart Beats' |
| episode_id | INTEGER | Episode number |
| episode_label | TEXT | e.g., 'Episode 01' |
| started_at | TIMESTAMPTZ | When video started |
| ended_at | TIMESTAMPTZ | When video ended |
| watch_duration_seconds | INTEGER | Actual time watched |
| video_duration_seconds | INTEGER | Total video length |
| completion_percentage | DECIMAL | 0-100% watched |
| is_completed | BOOLEAN | Watched to end |
| paused_count | INTEGER | Number of pauses |
| seek_count | INTEGER | Number of seeks |
| muted_at_start | BOOLEAN | Started muted |
| unmuted_during_watch | BOOLEAN | Unmuted while watching |
| entry_point | TEXT | How they got here |

### 4. `chat_sessions` - Chat Engagement Tracking

Tracks each chat session with message counts and duration.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| viewer_id | TEXT | Links to viewers table |
| session_id | TEXT | Browser session ID |
| google_user_id | TEXT | Links to users when logged in |
| character_name | TEXT | e.g., 'Priyank', 'Arzoo' |
| series_id | TEXT | Context series (optional) |
| series_title | TEXT | Context series title |
| episode_id | INTEGER | Context episode |
| started_at | TIMESTAMPTZ | When chat started |
| ended_at | TIMESTAMPTZ | When chat ended |
| duration_seconds | INTEGER | Total time in chat |
| message_count | INTEGER | Total messages |
| user_message_count | INTEGER | User messages |
| assistant_message_count | INTEGER | AI responses |
| entry_point | TEXT | video_sidebar/video_end_screen/choice_modal/chat_history |
| is_whatsapp_style | BOOLEAN | UI style used |

### 5. `page_views` - Traffic Tracking

Tracks navigation and page views for traffic analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| viewer_id | TEXT | Links to viewers table |
| session_id | TEXT | Browser session ID |
| google_user_id | TEXT | Links to users when logged in |
| view_type | TEXT | app_open/discover/chats_tab/series_modal/video/chat |
| series_id | TEXT | Content context |
| episode_id | INTEGER | Content context |
| character_name | TEXT | Chat context |
| tab_name | TEXT | 'For you', 'Grow with me', 'Dream World' |
| viewed_at | TIMESTAMPTZ | When viewed |
| referrer | TEXT | Traffic source |

## Analytics Views

Pre-built views for easy querying:

### `video_analytics`
Aggregated video stats per series/episode:
- Total views, unique viewers, logged-in viewers
- Total/avg/max watch time
- Completion rates
- Rewatch rates

### `chat_analytics`
Aggregated chat stats per character:
- Total sessions, unique chatters
- Total/avg duration
- Message counts
- Entry point breakdown

### `viewer_summary`
Per-viewer stats:
- Videos watched, total watch time
- Chat sessions, total chat time
- Characters interacted with

### `daily_traffic`
Daily traffic summary:
- Total page views, unique visitors
- Breakdown by view type
- Tab engagement

### `user_analytics`
Per-registered-user stats:
- Videos watched, watch time
- Chat sessions, chat time
- Total messages

## Setup Instructions

1. Go to your Supabase project → **SQL Editor**
2. Copy the contents of `supabase_setup.sql`
3. Run the SQL to create tables, indexes, and views
4. Get your credentials from **Settings** → **API**
5. Set up Google OAuth (see above)
6. Add environment variables to `.env.local`

## How It Works

### Viewer Identification
- **viewer_id**: Stored in `localStorage`, persists across browser sessions
- **session_id**: Stored in `sessionStorage`, resets on browser close
- **google_user_id**: Links anonymous data to Google user after sign-in

### User Flow
1. User visits → anonymous `viewer_id` created
2. All activity tracked with `viewer_id` and `session_id`
3. If user signs in with Google → `google_user_id` added to records
4. Previous anonymous activity is linked to the signed-in user

### Entry Points Tracked
- `discover_grid` - From main discover page
- `video_sidebar` - From chat button during video
- `video_end_screen` - From end screen after video
- `choice_modal` - From story choice modal
- `chat_history` - From chat history tab
- `next_episode_button` - From next episode button

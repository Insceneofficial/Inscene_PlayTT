# Goal Tracking System Implementation

## Overview
This document describes the goal-tracking companion feature that allows the chatbot to help users set goals, break them into milestones, and track progress.

## Database Schema

### `user_goals` Table
- `id` - UUID primary key
- `google_user_id` - Links to user
- `character_name` - Which character is helping
- `goal_text` - The user's goal
- `current_status` - One of: 'Not Started', 'In Progress', 'Stuck', 'Completed'
- `current_milestone_index` - Which milestone (0-based)
- `milestones` - JSONB array of milestone objects
- `progress_summary` - Text summary of progress
- `last_check_in` - Last check-in timestamp
- `created_at`, `updated_at` - Timestamps

## Workflow

### 1. Goal Discovery
- User mentions a goal/aspiration
- Bot asks: "What is the one goal you are currently working toward?"
- Waits for user response

### 2. Goal Confirmation & Breakdown
- Bot acknowledges the goal
- Breaks goal into 3-5 milestones using LLM
- Presents milestones in numbered list
- Asks: "Does this look right?"

### 3. Status Tracking
- Bot checks in: "Which milestone are you currently working on?"
- Asks: "What have you done in the last few days?"
- Determines status based on response

### 4. Goal Status Report
When user asks "What's my goal status?":
- Shows current goal
- Shows current status (Not Started, In Progress, Stuck, Completed)
- Shows current milestone
- Shows progress summary
- Suggests next action

### 5. Status Labels (Strict)
Only these 4 labels are used:
- Not Started
- In Progress
- Stuck
- Completed

## Files Created

1. **`lib/goalTracking.ts`** - Core goal tracking functions
   - `getCurrentGoal()` - Get user's goal
   - `saveGoal()` - Save/update goal
   - `updateGoalStatus()` - Update status
   - `formatGoalStatusReport()` - Format status report

2. **`lib/goalTrackingPrompts.ts`** - Goal tracking prompts and detection
   - `getGoalTrackingSystemPrompt()` - System prompt for goal tracking
   - `generateMilestones()` - Generate milestones using LLM
   - `isGoalRelatedQuery()` - Detect goal-related messages
   - `isGoalDeclaration()` - Detect goal declarations
   - `isStatusCheckQuery()` - Detect status check queries

3. **`supabase_migration_add_goal_tracking.sql`** - Database migration

## Integration Points

### Character System
- `buildSystemPrompt()` now accepts optional `goalContext`
- `getCharacterPrompt()` now accepts optional `goalContext`
- Goal context is injected into system prompt when available

### ChatPanel (To Be Implemented)
- Load current goal on mount
- Detect goal-related queries
- Handle goal creation/updates
- Inject goal context into system prompt
- Handle status checks

## Next Steps

1. **Run Database Migration**
   ```sql
   -- Execute: supabase_migration_add_goal_tracking.sql
   ```

2. **Integrate into ChatPanel**
   - Add goal loading on mount
   - Add goal detection in handleSend
   - Add goal context to system prompt
   - Handle goal creation/updates

3. **Add Daily Check-in**
   - Schedule 12 PM check-in
   - Send check-in message
   - Record check-in timestamp

4. **Test Workflow**
   - Test goal discovery
   - Test milestone breakdown
   - Test status tracking
   - Test status reports

## Example Interactions

### Goal Discovery
**User:** "I want to become a professional cricketer."
**Bot:** "What is the one goal you are currently working toward?"

### Goal Breakdown
**Bot:** "Got it. Your goal is: Become a professional cricketer

Let's break this into milestones:
1. Build daily fitness + stamina routine
2. Improve batting/bowling fundamentals
3. Play competitive matches regularly
4. Get evaluated by a coach or academy

Does this look right?"

### Status Check
**User:** "What's my goal status?"
**Bot:** "Goal: Become a professional cricketer

Current Status: In Progress
Current Milestone: Daily fitness & stamina routine

Progress Summary:
- You are training consistently
- Competitive match exposure hasn't started yet

Suggested Next Action:
Start playing at least 1 local match or net session per week to move to the next milestone."


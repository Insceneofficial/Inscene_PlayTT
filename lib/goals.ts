import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// Types
// ============================================

export interface Goal {
  id: string;
  google_user_id: string;
  creator_id: string;
  title: string;
  daily_task: string;
  difficulty_level: number;
  commitment_days: number;
  blocker?: string;
  target_date?: string;
  duration_days: number;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface GoalWithStreak extends Goal {
  current_streak: number;
  last_completed_date?: string;
  completed_today?: boolean;
}

export interface GoalProgress {
  id: string;
  goal_id: string;
  date: string;
  completed: boolean;
  streak_count: number;
  ai_feedback?: string;
  created_at: string;
}

export interface CreateGoalInput {
  title: string;
  daily_task: string;
  difficulty_level?: number;
  commitment_days?: number;
  blocker?: string;
  target_date?: string;
  duration_days?: number;
}

// ============================================
// Helper Functions
// ============================================

const getGoogleUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const savedUser = localStorage.getItem('inscene_google_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      return user?.id || null;
    }
    return null;
  } catch {
    return null;
  }
};

// ============================================
// Goal CRUD Operations
// ============================================

/**
 * Get the active goal for a specific creator
 */
export const getActiveGoal = async (creatorId: string): Promise<GoalWithStreak | null> => {
  console.log('[Goals] getActiveGoal called for creator:', creatorId);
  
  if (!isSupabaseConfigured()) {
    console.log('[Goals] Supabase not configured');
    return null;
  }
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) {
    console.log('[Goals] No google user ID found');
    return null;
  }
  
  console.log('[Goals] Fetching goal for user:', googleUserId);
  
  try {
    // First get the goal - use maybeSingle() to handle 0 rows without error
    const { data: goals, error: goalError } = await supabase
      .from('goals')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const goal = goals?.[0] || null;
    
    console.log('[Goals] Query result:', { goal, goalError, rowCount: goals?.length || 0 });
    
    if (goalError) {
      console.log('[Goals] Query error:', goalError?.message);
      return null;
    }
    
    if (!goal) {
      console.log('[Goals] No active goal found for this user/creator (this is normal for new users)');
      return null;
    }
    
    // Get the latest progress entry for streak info
    const { data: progressData } = await supabase
      .from('goal_progress')
      .select('*')
      .eq('goal_id', goal.id)
      .order('date', { ascending: false })
      .limit(1);
    
    const latestProgress = progressData?.[0];
    
    // Check if completed today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayProgress } = await supabase
      .from('goal_progress')
      .select('completed')
      .eq('goal_id', goal.id)
      .eq('date', today)
      .single();
    
    return {
      ...goal,
      current_streak: latestProgress?.streak_count || 0,
      last_completed_date: latestProgress?.completed ? latestProgress.date : undefined,
      completed_today: todayProgress?.completed || false
    } as GoalWithStreak;
  } catch (error) {
    console.warn('Goals: Failed to get active goal', error);
    return null;
  }
};

/**
 * Create a new goal
 */
export const createGoal = async (
  creatorId: string,
  input: CreateGoalInput
): Promise<Goal | null> => {
  console.log('[Goals] createGoal called:', { creatorId, input });
  
  if (!isSupabaseConfigured()) {
    console.log('[Goals] Supabase not configured, cannot create goal');
    return null;
  }
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) {
    console.log('[Goals] No google user ID, cannot create goal');
    return null;
  }
  
  console.log('[Goals] Creating goal for user:', googleUserId);
  
  try {
    // Deactivate any existing active goals for this creator
    await supabase
      .from('goals')
      .update({ status: 'paused' })
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .eq('status', 'active');
    
    // Calculate target date if not provided (default 30 days from now)
    const durationDays = input.duration_days || 30;
    const targetDate = input.target_date || new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Create new goal
    const { data, error } = await supabase
      .from('goals')
      .insert({
        google_user_id: googleUserId,
        creator_id: creatorId,
        title: input.title,
        daily_task: input.daily_task,
        difficulty_level: input.difficulty_level || 1,
        commitment_days: input.commitment_days || 5,
        blocker: input.blocker,
        target_date: targetDate,
        duration_days: durationDays,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Goals] Error creating goal:', error);
      throw error;
    }
    console.log('[Goals] Goal created successfully:', data);
    return data as Goal;
  } catch (error) {
    console.error('[Goals] Failed to create goal:', error);
    return null;
  }
};

/**
 * Update an existing goal
 */
export const updateGoal = async (
  goalId: string,
  updates: Partial<CreateGoalInput & { status: Goal['status'] }>
): Promise<Goal | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return null;
  
  try {
    const { data, error } = await supabase
      .from('goals')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', goalId)
      .eq('google_user_id', googleUserId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Goal;
  } catch (error) {
    console.warn('Goals: Failed to update goal', error);
    return null;
  }
};

/**
 * Pause a goal
 */
export const pauseGoal = async (goalId: string): Promise<boolean> => {
  const result = await updateGoal(goalId, { status: 'paused' });
  return result !== null;
};

/**
 * Resume a paused goal
 */
export const resumeGoal = async (goalId: string): Promise<boolean> => {
  const result = await updateGoal(goalId, { status: 'active' });
  return result !== null;
};

/**
 * Complete a goal
 */
export const completeGoal = async (goalId: string): Promise<boolean> => {
  const result = await updateGoal(goalId, { status: 'completed' });
  return result !== null;
};

// ============================================
// Progress Tracking
// ============================================

/**
 * Mark today's task as done
 */
export const markTaskDone = async (goalId: string): Promise<GoalProgress | null> => {
  if (!isSupabaseConfigured()) return null;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get the current streak from the most recent progress entry
    const { data: latestProgress } = await supabase
      .from('goal_progress')
      .select('streak_count, date')
      .eq('goal_id', goalId)
      .order('date', { ascending: false })
      .limit(1);
    
    const lastEntry = latestProgress?.[0];
    let newStreak = 1;
    
    if (lastEntry) {
      const lastDate = new Date(lastEntry.date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // If last completion was yesterday, increment streak
      // If same day, keep the streak
      // If more than 1 day gap, reset streak
      if (diffDays === 1) {
        newStreak = lastEntry.streak_count + 1;
      } else if (diffDays === 0) {
        newStreak = lastEntry.streak_count;
      }
      // else newStreak stays at 1 (reset)
    }
    
    // Upsert today's progress
    const { data, error } = await supabase
      .from('goal_progress')
      .upsert({
        goal_id: goalId,
        date: today,
        completed: true,
        streak_count: newStreak
      }, {
        onConflict: 'goal_id,date'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as GoalProgress;
  } catch (error) {
    console.warn('Goals: Failed to mark task done', error);
    return null;
  }
};

/**
 * Get streak and progress info for a goal
 */
export const getGoalProgress = async (goalId: string, days: number = 7): Promise<GoalProgress[]> => {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('goal_progress')
      .select('*')
      .eq('goal_id', goalId)
      .order('date', { ascending: false })
      .limit(days);
    
    if (error) throw error;
    return (data || []) as GoalProgress[];
  } catch (error) {
    console.warn('Goals: Failed to get progress', error);
    return [];
  }
};

/**
 * Reduce difficulty when user misses days
 */
export const reduceDifficulty = async (goalId: string): Promise<Goal | null> => {
  if (!isSupabaseConfigured()) return null;
  
  try {
    // Get current difficulty
    const { data: goal } = await supabase
      .from('goals')
      .select('difficulty_level')
      .eq('id', goalId)
      .single();
    
    if (!goal) return null;
    
    const newDifficulty = Math.max(1, goal.difficulty_level - 1);
    return await updateGoal(goalId, { difficulty_level: newDifficulty });
  } catch (error) {
    console.warn('Goals: Failed to reduce difficulty', error);
    return null;
  }
};

// ============================================
// Goal Context for AI
// ============================================

/**
 * Get goal context string for AI system prompt
 */
export const getGoalContextForAI = async (creatorId: string): Promise<string> => {
  const goal = await getActiveGoal(creatorId);
  
  if (!goal) {
    return `
USER GOAL STATUS: No active goal set.

PRIORITY: This is a coaching session. Your main purpose is to help the user set and achieve a goal related to the video content they just watched.

GOAL-SETTING FLOW (follow strictly, ONE question per message):
1. FIRST MESSAGE: Reference the video they watched. Ask "Based on what you just saw, what's one thing you'd like to work on or improve?"
2. AFTER THEY ANSWER: "That's great! How many days per week can you realistically commit to this?"
3. AFTER THEY ANSWER: "What usually gets in the way of your consistency?"
4. THEN: Propose a SPECIFIC goal with a daily micro-task (10-20 mins). Example:
   "Here's what I suggest:
   Goal: [specific goal based on their answer]
   Daily Task: [10-20 min actionable task]
   Does this work for you?"
5. On confirmation: Great! Goal is set. Encourage them to come back daily.

IMPORTANT:
- If user seems uninterested or keeps deflecting, that's okay. Don't push too hard.
- After ~8-10 messages without goal interest, wrap up gracefully.
- Always be warm and encouraging, never pushy.
`;
  }
  
  const today = new Date().toISOString().split('T')[0];
  const isCompletedToday = goal.completed_today;
  
  // Check if there's a gap (missed days)
  let missedDays = 0;
  if (goal.last_completed_date) {
    const lastDate = new Date(goal.last_completed_date);
    const todayDate = new Date(today);
    missedDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) - 1;
    if (missedDays < 0) missedDays = 0;
  }
  
  return `
USER GOAL STATUS:
- Goal: "${goal.title}"
- Today's Task: "${goal.daily_task}"
- Current Streak: ${goal.current_streak} days
- Difficulty Level: ${goal.difficulty_level}/5
- Commitment: ${goal.commitment_days} days/week
${goal.blocker ? `- Known Blocker: "${goal.blocker}"` : ''}
- Completed Today: ${isCompletedToday ? 'YES ✓' : 'NO - needs to complete'}
${missedDays > 0 ? `- MISSED DAYS: ${missedDays} (be encouraging, don't shame)` : ''}

INSTRUCTIONS:
${isCompletedToday 
  ? '- Congratulate them! Celebrate the streak. Suggest what they could do next or just chat casually.'
  : '- Remind them of today\'s task. Encourage completion. If they say "done", acknowledge and celebrate the streak.'}
${missedDays > 1 ? '- Be extra encouraging. Life happens. Focus on getting back on track TODAY.' : ''}
`;
};

/**
 * Parse goal from AI conversation (simple extraction)
 * Used when AI proposes a goal and user confirms
 */
export const parseGoalFromMessage = (message: string): CreateGoalInput | null => {
  // Look for patterns like "Goal: ...", "Daily task: ...", etc.
  const goalMatch = message.match(/goal[:\s]+["']?([^"'\n]+)["']?/i);
  const taskMatch = message.match(/(?:daily\s*)?task[:\s]+["']?([^"'\n]+)["']?/i);
  
  if (goalMatch && taskMatch) {
    return {
      title: goalMatch[1].trim(),
      daily_task: taskMatch[1].trim(),
      difficulty_level: 1,
      commitment_days: 5
    };
  }
  
  return null;
};

// ============================================
// Calendar / All Goals Functions
// ============================================

/**
 * Get all goals for the current user (for calendar view)
 */
export const getAllGoals = async (): Promise<GoalWithStreak[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return [];
  
  try {
    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .eq('google_user_id', googleUserId)
      .order('created_at', { ascending: false });
    
    if (error || !goals) return [];
    
    // Get progress info for each goal
    const goalsWithStreak: GoalWithStreak[] = await Promise.all(
      goals.map(async (goal) => {
        const { data: progressData } = await supabase
          .from('goal_progress')
          .select('*')
          .eq('goal_id', goal.id)
          .order('date', { ascending: false })
          .limit(1);
        
        const latestProgress = progressData?.[0];
        
        const today = new Date().toISOString().split('T')[0];
        const { data: todayProgress } = await supabase
          .from('goal_progress')
          .select('completed')
          .eq('goal_id', goal.id)
          .eq('date', today)
          .single();
        
        return {
          ...goal,
          current_streak: latestProgress?.streak_count || 0,
          last_completed_date: latestProgress?.completed ? latestProgress.date : undefined,
          completed_today: todayProgress?.completed || false
        } as GoalWithStreak;
      })
    );
    
    return goalsWithStreak;
  } catch (error) {
    console.warn('Goals: Failed to get all goals', error);
    return [];
  }
};

/**
 * Get goals grouped by date for calendar rendering
 */
export const getGoalsByDate = async (): Promise<Record<string, GoalWithStreak[]>> => {
  const goals = await getAllGoals();
  const goalsByDate: Record<string, GoalWithStreak[]> = {};
  
  goals.forEach(goal => {
    if (goal.target_date) {
      if (!goalsByDate[goal.target_date]) {
        goalsByDate[goal.target_date] = [];
      }
      goalsByDate[goal.target_date].push(goal);
    }
  });
  
  return goalsByDate;
};

/**
 * Get progress history for a goal (for calendar dots)
 */
export const getGoalProgressHistory = async (goalId: string): Promise<Record<string, boolean>> => {
  if (!isSupabaseConfigured()) return {};
  
  try {
    const { data, error } = await supabase
      .from('goal_progress')
      .select('date, completed')
      .eq('goal_id', goalId);
    
    if (error) throw error;
    
    const history: Record<string, boolean> = {};
    (data || []).forEach(entry => {
      history[entry.date] = entry.completed;
    });
    
    return history;
  } catch (error) {
    console.warn('Goals: Failed to get progress history', error);
    return {};
  }
};

// ============================================
// Goal State for Chat Context
// ============================================

export interface GoalState {
  hasGoal: boolean;
  goal: GoalWithStreak | null;
  contextForAI: string;
}

/**
 * Get complete goal state for a creator
 */
export const getGoalState = async (creatorId: string): Promise<GoalState> => {
  const goal = await getActiveGoal(creatorId);
  const contextForAI = await getGoalContextForAI(creatorId);
  
  return {
    hasGoal: goal !== null,
    goal,
    contextForAI
  };
};

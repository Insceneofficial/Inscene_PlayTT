import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// Types
// ============================================

export interface UserStreak {
  id: string;
  google_user_id: string;
  creator_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  last_video_watch_date: string | null;
  last_chat_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  google_user_id: string;
  creator_id: string;
  activity_date: string;
  watched_video: boolean;
  chatted: boolean;
  completed_goal: boolean;
  videos_watched: number;
  messages_sent: number;
  video_watch_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface UserPoints {
  id: string;
  google_user_id: string;
  creator_id: string | null;
  total_points: number;
  streak_points: number;
  goal_points: number;
  video_points: number;
  chat_points: number;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  google_user_id: string;
  creator_id: string | null;
  points: number;
  transaction_type: TransactionType;
  metadata: Record<string, any>;
  created_at: string;
}

export type TransactionType = 
  | 'streak_daily'
  | 'streak_milestone'
  | 'goal_completed'
  | 'video_watched'
  | 'video_completed'
  | 'chat_session'
  | 'chat_messages'
  | 'first_activity';

export interface LeaderboardEntry {
  google_user_id: string;
  user_name: string | null;
  avatar_url: string | null;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  rank: number;
  total_users: number;
  top_percentage: number;
}

export interface UserRankInfo {
  rank: number;
  total_users: number;
  top_percentage: number;
  total_points: number;
  current_streak: number;
}

// ============================================
// Points Configuration
// ============================================

export const POINTS_CONFIG = {
  STREAK_DAILY: 5,
  STREAK_MILESTONE_7: 50,
  STREAK_MILESTONE_14: 100,
  STREAK_MILESTONE_30: 200,
  STREAK_MILESTONE_100: 500,
  GOAL_COMPLETED: 100,
  VIDEO_WATCHED: 10,
  VIDEO_COMPLETED: 20,
  CHAT_SESSION: 5,
  CHAT_MESSAGE: 1,
  CHAT_MESSAGE_DAILY_CAP: 10,
  FIRST_ACTIVITY: 25,
};

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

const getToday = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getYesterday = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

// ============================================
// Streak Management
// ============================================

/**
 * Get user's streak for a specific creator
 */
export const getUserStreak = async (creatorId: string): Promise<UserStreak | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.warn('[Streaks] Error fetching streak:', error);
      return null;
    }
    
    return data as UserStreak | null;
  } catch (error) {
    console.warn('[Streaks] Failed to get user streak:', error);
    return null;
  }
};

/**
 * Get all streaks for current user
 */
export const getAllUserStreaks = async (): Promise<UserStreak[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return [];
  
  try {
    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('google_user_id', googleUserId)
      .order('current_streak', { ascending: false });
    
    if (error) throw error;
    return (data || []) as UserStreak[];
  } catch (error) {
    console.warn('[Streaks] Failed to get all streaks:', error);
    return [];
  }
};

/**
 * Record daily activity and update streak
 * This should be called when user watches a video or chats
 */
export const recordActivity = async (
  creatorId: string,
  activityType: 'video' | 'chat' | 'goal',
  metadata?: { videoWatchSeconds?: number; messageCount?: number }
): Promise<{ streak: UserStreak | null; pointsEarned: number }> => {
  if (!isSupabaseConfigured()) {
    return { streak: null, pointsEarned: 0 };
  }
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) {
    return { streak: null, pointsEarned: 0 };
  }
  
  const today = getToday();
  const yesterday = getYesterday();
  let totalPointsEarned = 0;
  
  try {
    // 1. Get or create daily activity record
    let { data: dailyActivity } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .eq('activity_date', today)
      .single();
    
    const isNewDailyRecord = !dailyActivity;
    
    if (!dailyActivity) {
      // Create new daily activity record
      const { data: newActivity, error: insertError } = await supabase
        .from('daily_activity')
        .insert({
          google_user_id: googleUserId,
          creator_id: creatorId,
          activity_date: today,
          watched_video: activityType === 'video',
          chatted: activityType === 'chat',
          completed_goal: activityType === 'goal',
          videos_watched: activityType === 'video' ? 1 : 0,
          messages_sent: metadata?.messageCount || 0,
          video_watch_seconds: metadata?.videoWatchSeconds || 0,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      dailyActivity = newActivity;
    } else {
      // Update existing daily activity
      const updates: Partial<DailyActivity> = {
        updated_at: new Date().toISOString(),
      };
      
      if (activityType === 'video') {
        updates.watched_video = true;
        updates.videos_watched = (dailyActivity.videos_watched || 0) + 1;
        updates.video_watch_seconds = (dailyActivity.video_watch_seconds || 0) + (metadata?.videoWatchSeconds || 0);
      }
      if (activityType === 'chat') {
        updates.chatted = true;
        updates.messages_sent = (dailyActivity.messages_sent || 0) + (metadata?.messageCount || 0);
      }
      if (activityType === 'goal') {
        updates.completed_goal = true;
      }
      
      await supabase
        .from('daily_activity')
        .update(updates)
        .eq('id', dailyActivity.id);
    }
    
    // 2. Get or create user streak record
    let { data: streak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .single();
    
    const isFirstActivity = !streak;
    
    if (!streak) {
      // Create new streak record
      const { data: newStreak, error: streakError } = await supabase
        .from('user_streaks')
        .insert({
          google_user_id: googleUserId,
          creator_id: creatorId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
          last_video_watch_date: activityType === 'video' ? today : null,
          last_chat_date: activityType === 'chat' ? today : null,
        })
        .select()
        .single();
      
      if (streakError) throw streakError;
      streak = newStreak;
      
      // Award first activity bonus
      await awardPoints(creatorId, 'first_activity', POINTS_CONFIG.FIRST_ACTIVITY);
      totalPointsEarned += POINTS_CONFIG.FIRST_ACTIVITY;
    } else {
      // Update existing streak
      const lastActivityDate = streak.last_activity_date;
      let newStreak = streak.current_streak;
      
      // Check if this is a continuation of streak
      if (lastActivityDate === yesterday) {
        // Streak continues!
        newStreak += 1;
      } else if (lastActivityDate !== today) {
        // Streak broken - reset to 1
        newStreak = 1;
      }
      // If lastActivityDate === today, streak stays the same
      
      const longestStreak = Math.max(newStreak, streak.longest_streak || 0);
      
      const { data: updatedStreak, error: updateError } = await supabase
        .from('user_streaks')
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_activity_date: today,
          last_video_watch_date: activityType === 'video' ? today : streak.last_video_watch_date,
          last_chat_date: activityType === 'chat' ? today : streak.last_chat_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', streak.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      streak = updatedStreak;
      
      // Check for streak milestones
      if (newStreak > (streak.current_streak || 0)) {
        // Award daily streak points only once per day (when streak increases)
        if (isNewDailyRecord) {
          await awardPoints(creatorId, 'streak_daily', POINTS_CONFIG.STREAK_DAILY);
          totalPointsEarned += POINTS_CONFIG.STREAK_DAILY;
        }
        
        // Check for milestone bonuses
        if (newStreak === 7) {
          await awardPoints(creatorId, 'streak_milestone', POINTS_CONFIG.STREAK_MILESTONE_7, { milestone: 7 });
          totalPointsEarned += POINTS_CONFIG.STREAK_MILESTONE_7;
        } else if (newStreak === 14) {
          await awardPoints(creatorId, 'streak_milestone', POINTS_CONFIG.STREAK_MILESTONE_14, { milestone: 14 });
          totalPointsEarned += POINTS_CONFIG.STREAK_MILESTONE_14;
        } else if (newStreak === 30) {
          await awardPoints(creatorId, 'streak_milestone', POINTS_CONFIG.STREAK_MILESTONE_30, { milestone: 30 });
          totalPointsEarned += POINTS_CONFIG.STREAK_MILESTONE_30;
        } else if (newStreak === 100) {
          await awardPoints(creatorId, 'streak_milestone', POINTS_CONFIG.STREAK_MILESTONE_100, { milestone: 100 });
          totalPointsEarned += POINTS_CONFIG.STREAK_MILESTONE_100;
        }
      }
    }
    
    // 3. Award activity-specific points
    if (activityType === 'video') {
      await awardPoints(creatorId, 'video_watched', POINTS_CONFIG.VIDEO_WATCHED);
      totalPointsEarned += POINTS_CONFIG.VIDEO_WATCHED;
    } else if (activityType === 'chat' && isNewDailyRecord) {
      // Only award chat session points for first chat of the day
      await awardPoints(creatorId, 'chat_session', POINTS_CONFIG.CHAT_SESSION);
      totalPointsEarned += POINTS_CONFIG.CHAT_SESSION;
    }
    
    console.log('[Streaks] Activity recorded:', { 
      creatorId, 
      activityType, 
      streak: streak?.current_streak,
      pointsEarned: totalPointsEarned 
    });
    
    return { streak: streak as UserStreak, pointsEarned: totalPointsEarned };
  } catch (error) {
    console.warn('[Streaks] Failed to record activity:', error);
    return { streak: null, pointsEarned: 0 };
  }
};

/**
 * Record video completion (called when video is watched to >90%)
 */
export const recordVideoCompletion = async (creatorId: string): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return 0;
  
  try {
    await awardPoints(creatorId, 'video_completed', POINTS_CONFIG.VIDEO_COMPLETED);
    return POINTS_CONFIG.VIDEO_COMPLETED;
  } catch (error) {
    console.warn('[Streaks] Failed to record video completion:', error);
    return 0;
  }
};

/**
 * Record chat messages (awards points up to daily cap)
 */
export const recordChatMessages = async (creatorId: string, messageCount: number): Promise<number> => {
  if (!isSupabaseConfigured() || messageCount <= 0) return 0;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return 0;
  
  const today = getToday();
  
  try {
    // Check how many message points we've already given today
    const { data: todaysTransactions } = await supabase
      .from('points_transactions')
      .select('points')
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .eq('transaction_type', 'chat_messages')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);
    
    const pointsGivenToday = (todaysTransactions || []).reduce((sum, t) => sum + t.points, 0);
    const remainingCap = POINTS_CONFIG.CHAT_MESSAGE_DAILY_CAP - pointsGivenToday;
    
    if (remainingCap <= 0) return 0;
    
    const pointsToAward = Math.min(messageCount * POINTS_CONFIG.CHAT_MESSAGE, remainingCap);
    
    if (pointsToAward > 0) {
      await awardPoints(creatorId, 'chat_messages', pointsToAward, { messageCount });
    }
    
    return pointsToAward;
  } catch (error) {
    console.warn('[Streaks] Failed to record chat messages:', error);
    return 0;
  }
};

/**
 * Record goal completion
 */
export const recordGoalCompletion = async (creatorId: string, goalId: string): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return 0;
  
  try {
    // Record the activity for streak
    await recordActivity(creatorId, 'goal');
    
    // Award goal completion points
    await awardPoints(creatorId, 'goal_completed', POINTS_CONFIG.GOAL_COMPLETED, { goalId });
    
    return POINTS_CONFIG.GOAL_COMPLETED;
  } catch (error) {
    console.warn('[Streaks] Failed to record goal completion:', error);
    return 0;
  }
};

// ============================================
// Points Management
// ============================================

/**
 * Award points to current user
 */
const awardPoints = async (
  creatorId: string | null,
  transactionType: TransactionType,
  points: number,
  metadata: Record<string, any> = {}
): Promise<boolean> => {
  if (!isSupabaseConfigured() || points <= 0) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;
  
  try {
    // 1. Log the transaction
    await supabase
      .from('points_transactions')
      .insert({
        google_user_id: googleUserId,
        creator_id: creatorId,
        points,
        transaction_type: transactionType,
        metadata,
      });
    
    // 2. Update user points total
    const { data: existingPoints } = await supabase
      .from('user_points')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .single();
    
    // Determine which category to add points to
    const pointsCategory = getPointsCategory(transactionType);
    
    if (existingPoints) {
      await supabase
        .from('user_points')
        .update({
          total_points: existingPoints.total_points + points,
          [pointsCategory]: (existingPoints[pointsCategory] || 0) + points,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPoints.id);
    } else {
      await supabase
        .from('user_points')
        .insert({
          google_user_id: googleUserId,
          creator_id: creatorId,
          total_points: points,
          [pointsCategory]: points,
        });
    }
    
    return true;
  } catch (error) {
    console.warn('[Points] Failed to award points:', error);
    return false;
  }
};

const getPointsCategory = (transactionType: TransactionType): keyof UserPoints => {
  switch (transactionType) {
    case 'streak_daily':
    case 'streak_milestone':
      return 'streak_points';
    case 'goal_completed':
      return 'goal_points';
    case 'video_watched':
    case 'video_completed':
      return 'video_points';
    case 'chat_session':
    case 'chat_messages':
      return 'chat_points';
    case 'first_activity':
      return 'streak_points'; // Count as streak/engagement
    default:
      return 'total_points';
  }
};

/**
 * Get user's total points for a creator
 */
export const getUserPoints = async (creatorId: string): Promise<UserPoints | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_points')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('creator_id', creatorId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.warn('[Points] Error fetching points:', error);
      return null;
    }
    
    return data as UserPoints | null;
  } catch (error) {
    console.warn('[Points] Failed to get user points:', error);
    return null;
  }
};

/**
 * Get user's total points across all creators
 */
export const getTotalUserPoints = async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return 0;
  
  try {
    const { data, error } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('google_user_id', googleUserId);
    
    if (error) throw error;
    
    return (data || []).reduce((sum, p) => sum + (p.total_points || 0), 0);
  } catch (error) {
    console.warn('[Points] Failed to get total points:', error);
    return 0;
  }
};

// ============================================
// Leaderboard
// ============================================

/**
 * Get leaderboard for a specific creator
 */
export const getCreatorLeaderboard = async (
  creatorId: string,
  limit: number = 50
): Promise<LeaderboardEntry[]> => {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const { data, error } = await supabase
      .from('creator_leaderboard')
      .select('*')
      .eq('creator_id', creatorId)
      .order('rank', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return (data || []) as LeaderboardEntry[];
  } catch (error) {
    console.warn('[Leaderboard] Failed to get creator leaderboard:', error);
    return [];
  }
};

/**
 * Get user's rank for a specific creator
 */
export const getUserRankForCreator = async (creatorId: string): Promise<UserRankInfo | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return null;
  
  try {
    const { data, error } = await supabase
      .from('creator_leaderboard')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('google_user_id', googleUserId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.warn('[Leaderboard] Error fetching user rank:', error);
      return null;
    }
    
    if (!data) return null;
    
    return {
      rank: data.rank,
      total_users: data.total_users,
      top_percentage: data.top_percentage,
      total_points: data.total_points,
      current_streak: data.current_streak || 0,
    };
  } catch (error) {
    console.warn('[Leaderboard] Failed to get user rank:', error);
    return null;
  }
};

/**
 * Get recent points transactions for a user
 */
export const getRecentTransactions = async (
  creatorId?: string,
  limit: number = 20
): Promise<PointTransaction[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return [];
  
  try {
    let query = supabase
      .from('points_transactions')
      .select('*')
      .eq('google_user_id', googleUserId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as PointTransaction[];
  } catch (error) {
    console.warn('[Points] Failed to get recent transactions:', error);
    return [];
  }
};

// ============================================
// User Engagement Summary
// ============================================

export interface UserEngagementSummary {
  creatorId: string;
  streak: UserStreak | null;
  points: UserPoints | null;
  rank: UserRankInfo | null;
}

/**
 * Get full engagement summary for a user with a creator
 */
export const getUserEngagementSummary = async (
  creatorId: string
): Promise<UserEngagementSummary> => {
  const [streak, points, rank] = await Promise.all([
    getUserStreak(creatorId),
    getUserPoints(creatorId),
    getUserRankForCreator(creatorId),
  ]);
  
  return {
    creatorId,
    streak,
    points,
    rank,
  };
};

// ============================================
// Utility Functions
// ============================================

/**
 * Format points for display
 */
export const formatPoints = (points: number): string => {
  if (points >= 1000000) {
    return `${(points / 1000000).toFixed(1)}M`;
  }
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}K`;
  }
  return points.toString();
};

/**
 * Get streak status message
 */
export const getStreakStatus = (streak: UserStreak | null): string => {
  if (!streak || streak.current_streak === 0) {
    return 'Start your streak today!';
  }
  
  const today = getToday();
  const lastActivity = streak.last_activity_date;
  
  if (lastActivity === today) {
    if (streak.current_streak === 1) {
      return 'Great start! Keep it going tomorrow!';
    }
    return `🔥 ${streak.current_streak} day streak! Keep it up!`;
  }
  
  const yesterday = getYesterday();
  if (lastActivity === yesterday) {
    return `Your ${streak.current_streak} day streak is at risk! Come back today!`;
  }
  
  return 'Your streak ended. Start a new one today!';
};

/**
 * Get top percentage badge text
 */
export const getTopPercentageBadge = (topPercentage: number): string => {
  if (topPercentage <= 1) return 'Top 1%';
  if (topPercentage <= 5) return 'Top 5%';
  if (topPercentage <= 10) return 'Top 10%';
  if (topPercentage <= 25) return 'Top 25%';
  if (topPercentage <= 50) return 'Top 50%';
  return '';
};

/**
 * Get transaction type display name
 */
export const getTransactionTypeName = (type: TransactionType): string => {
  switch (type) {
    case 'streak_daily': return 'Daily Streak';
    case 'streak_milestone': return 'Streak Milestone';
    case 'goal_completed': return 'Goal Completed';
    case 'video_watched': return 'Video Watched';
    case 'video_completed': return 'Video Completed';
    case 'chat_session': return 'Chat Session';
    case 'chat_messages': return 'Chat Messages';
    case 'first_activity': return 'First Activity';
    default: return type;
  }
};

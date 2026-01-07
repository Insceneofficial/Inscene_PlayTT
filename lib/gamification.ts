/**
 * Gamification System
 * 
 * Manages streaks, badges, points, and levels for goal tracking
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// Types
// ============================================

export type BadgeType = 
  | 'first_goal'
  | 'first_milestone'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'milestone_master'
  | 'consistent'
  | 'goal_completed';

export type ActivityType = 
  | 'check_in'
  | 'milestone_started'
  | 'milestone_completed'
  | 'goal_completed'
  | 'badge_earned';

export interface UserGamification {
  id: string;
  google_user_id: string;
  character_name: string;
  current_streak: number;
  longest_streak: number;
  last_check_in_date: string | null;
  total_points: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface UserBadge {
  id: string;
  google_user_id: string;
  character_name: string;
  badge_type: BadgeType;
  earned_at: string;
}

export interface ActivityLog {
  id: string;
  google_user_id: string;
  character_name: string;
  goal_id: string | null;
  activity_type: ActivityType;
  points_earned: number;
  metadata: any;
  created_at: string;
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
  } catch (e) {
    return null;
  }
};

// ============================================
// Points System
// ============================================

export const getPointsForActivity = (activityType: ActivityType): number => {
  const pointsMap: Record<ActivityType, number> = {
    check_in: 10,
    milestone_started: 25,
    milestone_completed: 50,
    goal_completed: 200,
    badge_earned: 75, // Average badge points
  };
  return pointsMap[activityType] || 0;
};

export const getPointsForBadge = (badgeType: BadgeType): number => {
  const pointsMap: Record<BadgeType, number> = {
    first_goal: 50,
    first_milestone: 50,
    streak_3: 75,
    streak_7: 100,
    streak_30: 150,
    milestone_master: 100,
    consistent: 75,
    goal_completed: 200,
  };
  return pointsMap[badgeType] || 50;
};

export const getLevelFromPoints = (points: number): number => {
  if (points < 100) return 1;
  if (points < 250) return 2;
  if (points < 500) return 3;
  if (points < 1000) return 4;
  // Level 5+: increments of 500
  return 5 + Math.floor((points - 1000) / 500);
};

export const getPointsForNextLevel = (currentLevel: number): number => {
  if (currentLevel === 1) return 100;
  if (currentLevel === 2) return 250;
  if (currentLevel === 3) return 500;
  if (currentLevel === 4) return 1000;
  // Level 5+: increments of 500
  return 1000 + (currentLevel - 4) * 500;
};

// ============================================
// Gamification Management
// ============================================

/**
 * Get or create user gamification record
 */
const getOrCreateGamification = async (characterName: string): Promise<UserGamification | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return null;

  try {
    // Try to get existing record
    const { data: existing, error: fetchError } = await supabase
      .from('user_gamification')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .single();

    if (existing && !fetchError) {
      return existing;
    }

    // Create new record if doesn't exist
    const { data: newRecord, error: createError } = await supabase
      .from('user_gamification')
      .insert({
        google_user_id: googleUserId,
        character_name: characterName,
        current_streak: 0,
        longest_streak: 0,
        total_points: 0,
        level: 1,
      })
      .select()
      .single();

    if (createError) throw createError;
    return newRecord;
  } catch (error) {
    console.warn('Gamification: Failed to get or create gamification', error);
    return null;
  }
};

/**
 * Get user's gamification stats
 */
export const getUserGamification = async (characterName: string): Promise<UserGamification | null> => {
  return getOrCreateGamification(characterName);
};

/**
 * Calculate streak from activity log
 */
export const calculateStreak = async (characterName: string): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return 0;

  try {
    // Get all check-ins, ordered by date descending
    const { data: activities, error } = await supabase
      .from('goal_activity_log')
      .select('created_at')
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .eq('activity_type', 'check_in')
      .order('created_at', { ascending: false })
      .limit(30); // Check last 30 days

    if (error) throw error;
    if (!activities || activities.length === 0) return 0;

    // Group by date (ignore time)
    const dates = new Set<string>();
    activities.forEach(activity => {
      const date = new Date(activity.created_at).toISOString().split('T')[0];
      dates.add(date);
    });

    const sortedDates = Array.from(dates).sort().reverse();
    if (sortedDates.length === 0) return 0;

    // Check if today or yesterday is in the list
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // If no check-in today or yesterday, streak is broken
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      return 0;
    }

    // Calculate consecutive days
    let streak = 1;
    let currentDate = new Date(sortedDates[0]);
    
    for (let i = 1; i < sortedDates.length; i++) {
      const nextDate = new Date(sortedDates[i]);
      const daysDiff = Math.floor((currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        streak++;
        currentDate = nextDate;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.warn('Gamification: Failed to calculate streak', error);
    return 0;
  }
};

/**
 * Record activity and update gamification
 */
export const recordActivity = async (
  characterName: string,
  activityType: ActivityType,
  goalId?: string,
  metadata?: any
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;

  try {
    const points = getPointsForActivity(activityType);

    // Log activity
    const { error: logError } = await supabase
      .from('goal_activity_log')
      .insert({
        google_user_id: googleUserId,
        character_name: characterName,
        goal_id: goalId || null,
        activity_type: activityType,
        points_earned: points,
        metadata: metadata || {},
      });

    if (logError) throw logError;

    // Update gamification stats
    const gamification = await getOrCreateGamification(characterName);
    if (!gamification) return false;

    const newTotalPoints = gamification.total_points + points;
    const newLevel = getLevelFromPoints(newTotalPoints);
    
    // Calculate streak if it's a check-in
    let newStreak = gamification.current_streak;
    let newLongestStreak = gamification.longest_streak;
    let lastCheckInDate = gamification.last_check_in_date;

    if (activityType === 'check_in') {
      const calculatedStreak = await calculateStreak(characterName);
      newStreak = calculatedStreak;
      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak;
      }
      lastCheckInDate = new Date().toISOString().split('T')[0];
    }

    // Update gamification record
    const { error: updateError } = await supabase
      .from('user_gamification')
      .update({
        current_streak: newStreak,
        longest_streak: newLongestStreak,
        last_check_in_date: lastCheckInDate,
        total_points: newTotalPoints,
        level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gamification.id);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.warn('Gamification: Failed to record activity', error);
    return false;
  }
};

/**
 * Record check-in (convenience function)
 */
export const recordCheckIn = async (characterName: string, goalId?: string): Promise<boolean> => {
  return recordActivity(characterName, 'check_in', goalId);
};

/**
 * Get earned badges
 */
export const getEarnedBadges = async (characterName: string): Promise<UserBadge[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return [];

  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('Gamification: Failed to get earned badges', error);
    return [];
  }
};

/**
 * Check if badge is earned
 */
export const hasBadge = async (characterName: string, badgeType: BadgeType): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;

  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('id')
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .eq('badge_type', badgeType)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return !!data;
  } catch (error) {
    console.warn('Gamification: Failed to check badge', error);
    return false;
  }
};

/**
 * Award badge
 */
export const awardBadge = async (
  characterName: string,
  badgeType: BadgeType,
  goalId?: string
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;

  try {
    // Check if already earned
    const alreadyEarned = await hasBadge(characterName, badgeType);
    if (alreadyEarned) return true;

    // Award badge
    const { error: badgeError } = await supabase
      .from('user_badges')
      .insert({
        google_user_id: googleUserId,
        character_name: characterName,
        badge_type: badgeType,
      });

    if (badgeError) throw badgeError;

    // Award points for badge
    const badgePoints = getPointsForBadge(badgeType);
    await recordActivity(characterName, 'badge_earned', goalId, { badge_type: badgeType, points: badgePoints });

    return true;
  } catch (error) {
    console.warn('Gamification: Failed to award badge', error);
    return false;
  }
};

/**
 * Check and award badges based on current stats
 */
export const checkAndAwardBadges = async (characterName: string, goalId?: string): Promise<BadgeType[]> => {
  const awarded: BadgeType[] = [];
  
  const gamification = await getUserGamification(characterName);
  if (!gamification) return awarded;

  // Check streak badges
  if (gamification.current_streak >= 3 && !(await hasBadge(characterName, 'streak_3'))) {
    await awardBadge(characterName, 'streak_3', goalId);
    awarded.push('streak_3');
  }
  if (gamification.current_streak >= 7 && !(await hasBadge(characterName, 'streak_7'))) {
    await awardBadge(characterName, 'streak_7', goalId);
    awarded.push('streak_7');
  }
  if (gamification.current_streak >= 30 && !(await hasBadge(characterName, 'streak_30'))) {
    await awardBadge(characterName, 'streak_30', goalId);
    awarded.push('streak_30');
  }

  // Check consistent badge (10 check-ins)
  if (!isSupabaseConfigured()) return awarded;
  const googleUserId = getGoogleUserId();
  if (googleUserId) {
    const { count } = await supabase
      .from('goal_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .eq('activity_type', 'check_in');

    if (count && count >= 10 && !(await hasBadge(characterName, 'consistent'))) {
      await awardBadge(characterName, 'consistent', goalId);
      awarded.push('consistent');
    }
  }

  return awarded;
};

/**
 * Get badge display info
 */
export const getBadgeInfo = (badgeType: BadgeType): { name: string; description: string; emoji: string } => {
  const badgeMap: Record<BadgeType, { name: string; description: string; emoji: string }> = {
    first_goal: { name: 'First Goal', description: 'Set your first goal', emoji: '🎯' },
    first_milestone: { name: 'First Step', description: 'Complete your first milestone', emoji: '🏁' },
    streak_3: { name: 'On Fire', description: '3-day check-in streak', emoji: '🔥' },
    streak_7: { name: 'Week Warrior', description: '7-day check-in streak', emoji: '💪' },
    streak_30: { name: 'Streak Master', description: '30-day check-in streak', emoji: '⚡' },
    milestone_master: { name: 'Milestone Master', description: 'Complete all milestones', emoji: '👑' },
    consistent: { name: 'Consistent', description: '10 check-ins completed', emoji: '⭐' },
    goal_completed: { name: 'Goal Achiever', description: 'Complete your entire goal', emoji: '🏆' },
  };
  return badgeMap[badgeType];
};


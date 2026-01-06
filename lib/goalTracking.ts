/**
 * Goal Tracking System
 * 
 * Manages user goals, milestones, and progress tracking
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// Types
// ============================================

export type GoalStatus = 'Not Started' | 'In Progress' | 'Stuck' | 'Completed';

export interface Milestone {
  id: string;
  title: string;
  status: GoalStatus;
  order: number;
}

export interface UserGoal {
  id: string;
  google_user_id: string;
  character_name: string;
  goal_text: string;
  current_status: GoalStatus;
  current_milestone_index: number;
  milestones: Milestone[];
  progress_summary?: string;
  last_check_in?: string;
  created_at: string;
  updated_at: string;
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
// Goal Management
// ============================================

/**
 * Get user's current goal for a character
 */
export const getCurrentGoal = async (characterName: string): Promise<UserGoal | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return null;

  try {
    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
  } catch (error) {
    console.warn('GoalTracking: Failed to get current goal', error);
    return null;
  }
};

/**
 * Create or update user goal
 */
export const saveGoal = async (
  characterName: string,
  goalText: string,
  milestones: Milestone[]
): Promise<UserGoal | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return null;

  try {
    // Check if goal exists
    const existingGoal = await getCurrentGoal(characterName);
    
    const goalData = {
      google_user_id: googleUserId,
      character_name: characterName,
      goal_text: goalText,
      current_status: 'Not Started' as GoalStatus,
      current_milestone_index: 0,
      milestones: milestones,
      updated_at: new Date().toISOString()
    };

    if (existingGoal) {
      // Update existing goal
      const { data, error } = await supabase
        .from('user_goals')
        .update(goalData)
        .eq('id', existingGoal.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new goal
      const { data, error } = await supabase
        .from('user_goals')
        .insert({
          ...goalData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.warn('GoalTracking: Failed to save goal', error);
    return null;
  }
};

/**
 * Update goal status and current milestone
 */
export const updateGoalStatus = async (
  characterName: string,
  status: GoalStatus,
  milestoneIndex: number,
  progressSummary?: string
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;

  try {
    const goal = await getCurrentGoal(characterName);
    if (!goal) return false;

    const updateData: any = {
      current_status: status,
      current_milestone_index: milestoneIndex,
      updated_at: new Date().toISOString()
    };

    if (progressSummary) {
      updateData.progress_summary = progressSummary;
    }

    const { error } = await supabase
      .from('user_goals')
      .update(updateData)
      .eq('id', goal.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('GoalTracking: Failed to update goal status', error);
    return false;
  }
};

/**
 * Record a check-in
 */
export const recordCheckIn = async (characterName: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;

  try {
    const goal = await getCurrentGoal(characterName);
    if (!goal) return false;

    const { error } = await supabase
      .from('user_goals')
      .update({
        last_check_in: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', goal.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('GoalTracking: Failed to record check-in', error);
    return false;
  }
};

/**
 * Format goal status report for display
 * Uses TYPE 1 structured formatting with proper line breaks
 * Clean, crisp format with tick emoji for status
 */
export const formatGoalStatusReport = (goal: UserGoal): string => {
  if (!goal) return '';

  const currentMilestone = goal.milestones[goal.current_milestone_index];
  const milestoneText = currentMilestone ? currentMilestone.title : 'Not set';

  // Get status emoji
  const getStatusEmoji = (status: string): string => {
    switch (status) {
      case 'Completed': return '✅';
      case 'In Progress': return '🔄';
      case 'Stuck': return '⚠️';
      case 'Not Started': return '⏸️';
      default: return '📌';
    }
  };

  // Build clean, crisp report
  let report = `Here's your current goal update\n\n`;
  
  report += `Goal:\n${goal.goal_text}\n\n`;
  
  report += `Current Status:\n`;
  report += `${getStatusEmoji(goal.current_status)} ${goal.current_status}\n`;
  report += `📍 Current Milestone: ${milestoneText}\n`;
  
  // Only show blocker if stuck or if there's a specific blocker
  if (goal.current_status === 'Stuck' || (goal.progress_summary && goal.progress_summary.toLowerCase().includes('block'))) {
    const blockerText = goal.current_status === 'Stuck' ? 'Needs clarification' : goal.progress_summary;
    report += `🚧 Key blocker: ${blockerText}\n`;
  }
  
  report += `\nNext Step:\n`;

  // Determine next action - keep it simple and actionable
  if (goal.current_status === 'Stuck') {
    report += `Let's simplify. What is ONE small action you can do today?`;
  } else if (goal.current_status === 'Completed' && goal.current_milestone_index < goal.milestones.length - 1) {
    const nextMilestone = goal.milestones[goal.current_milestone_index + 1];
    report += `Move to: ${nextMilestone.title}`;
  } else if (goal.current_status === 'In Progress' && goal.current_milestone_index < goal.milestones.length - 1) {
    const nextMilestone = goal.milestones[goal.current_milestone_index + 1];
    report += `Start working on: ${nextMilestone.title}`;
  } else {
    report += `Continue working on: ${milestoneText}`;
  }

  return report;
};


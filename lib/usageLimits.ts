import { getUserMessageCount } from './chatStorage';
import { getCompletedEpisodesCount } from './analytics';
import { isUserLoggedIn } from './chatStorage';

// ============================================
// Constants
// ============================================

export const MAX_CHAT_MESSAGES = 5;
export const MAX_EPISODES = 3;

// ============================================
// Usage Tracking Functions
// ============================================

/**
 * Get the current chat message count for the authenticated user
 */
export const getChatMessageCount = async (): Promise<number> => {
  if (!isUserLoggedIn()) return 0;
  return await getUserMessageCount();
};

/**
 * Get the current completed episodes count for the authenticated user
 */
export const getCompletedEpisodesCountForUser = async (): Promise<number> => {
  if (!isUserLoggedIn()) return 0;
  return await getCompletedEpisodesCount();
};

// ============================================
// Limit Checking Functions
// ============================================

/**
 * Check if user has reached the chat message limit
 */
export const checkChatLimit = async (): Promise<boolean> => {
  if (!isUserLoggedIn()) return false;
  const count = await getChatMessageCount();
  return count >= MAX_CHAT_MESSAGES;
};

/**
 * Check if user has reached the episode completion limit
 */
export const checkEpisodeLimit = async (): Promise<boolean> => {
  if (!isUserLoggedIn()) return false;
  const count = await getCompletedEpisodesCountForUser();
  return count >= MAX_EPISODES;
};

// ============================================
// Episode Access Control
// ============================================

/**
 * Check if user can access a specific episode
 * - Guests can only access Episode 1
 * - Authenticated users can access any episode (subject to completion limits)
 */
export const canAccessEpisode = (episodeId: number, isAuthenticated: boolean): boolean => {
  if (!isAuthenticated) {
    // Guest users can only access Episode 1
    return episodeId === 1;
  }
  // Authenticated users can access any episode
  return true;
};

// ============================================
// Sign-up Prompt Tracking
// ============================================

const SIGNUP_PROMPT_KEY = 'inscene_signup_prompt_shown';

/**
 * Check if sign-up prompt has been shown
 */
export const hasShownSignupPrompt = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIGNUP_PROMPT_KEY) === 'true';
};

/**
 * Mark sign-up prompt as shown
 */
export const markSignupPromptShown = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SIGNUP_PROMPT_KEY, 'true');
};

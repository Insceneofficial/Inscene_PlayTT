import { getUserMessageCount, hasUnlimitedMessages } from './chatStorage';
import { getTotalEpisodeViewsCount } from './analytics';
import { isUserLoggedIn } from './chatStorage';

// ============================================
// Constants
// ============================================

export const MAX_CHAT_MESSAGES = 5;
export const MAX_EPISODES = 5;
export const MAX_GUEST_EPISODES = 5;
export const MAX_GUEST_CHATS = 5;

// Guest tracking localStorage keys
const GUEST_EPISODE_COUNT_KEY = 'inscene_guest_episode_count';
const GUEST_CHAT_COUNT_KEY = 'inscene_guest_chat_count';

// ============================================
// Guest Usage Tracking Functions
// ============================================

/**
 * Get the current episode count for guest users (from localStorage)
 */
export const getGuestEpisodeCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const count = localStorage.getItem(GUEST_EPISODE_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
};

/**
 * Increment the guest episode count
 */
export const incrementGuestEpisodeCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const currentCount = getGuestEpisodeCount();
  const newCount = currentCount + 1;
  localStorage.setItem(GUEST_EPISODE_COUNT_KEY, newCount.toString());
  return newCount;
};

/**
 * Get the current chat count for guest users (from localStorage)
 */
export const getGuestChatCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const count = localStorage.getItem(GUEST_CHAT_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
};

/**
 * Increment the guest chat count
 */
export const incrementGuestChatCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const currentCount = getGuestChatCount();
  const newCount = currentCount + 1;
  localStorage.setItem(GUEST_CHAT_COUNT_KEY, newCount.toString());
  return newCount;
};

/**
 * Check if guest has reached EITHER the episode OR chat limit
 * Returns true when EITHER count >= 5
 */
export const checkGuestLimit = (): boolean => {
  const episodeCount = getGuestEpisodeCount();
  const chatCount = getGuestChatCount();
  return episodeCount >= MAX_GUEST_EPISODES || chatCount >= MAX_GUEST_CHATS;
};

/**
 * Reset guest usage counts (used after sign-in)
 */
export const resetGuestCounts = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_EPISODE_COUNT_KEY);
  localStorage.removeItem(GUEST_CHAT_COUNT_KEY);
};

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
 * Get the total episode views count for the authenticated user
 * Counts ALL episode views (even rewatches) not just unique episodes
 */
export const getEpisodeViewsCountForUser = async (): Promise<number> => {
  if (!isUserLoggedIn()) return 0;
  return await getTotalEpisodeViewsCount();
};

// ============================================
// Limit Checking Functions
// ============================================

/**
 * Check if user has reached the chat message limit
 * Returns false for privileged/dev users (unlimited access)
 */
export const checkChatLimit = async (): Promise<boolean> => {
  if (!isUserLoggedIn()) return false;
  // Privileged/dev users have unlimited messages
  if (hasUnlimitedMessages()) return false;
  const count = await getChatMessageCount();
  return count >= MAX_CHAT_MESSAGES;
};

/**
 * Check if user has reached the episode view limit
 * Counts ALL episode views (even rewatches) not just unique episodes
 * Returns false for privileged/dev users (unlimited access)
 */
export const checkEpisodeLimit = async (): Promise<boolean> => {
  if (!isUserLoggedIn()) return false;
  // Privileged/dev users have unlimited episodes
  if (hasUnlimitedMessages()) return false;
  const count = await getEpisodeViewsCountForUser();
  return count >= MAX_EPISODES;
};

// ============================================
// Episode Access Control
// ============================================

/**
 * Check if user can access a specific episode
 * - Guests can now access ALL episodes until they hit the guest limit
 * - Authenticated users can access any episode (subject to completion limits)
 */
export const canAccessEpisode = (episodeId: number, isAuthenticated: boolean): boolean => {
  // Both guests and authenticated users can access all episodes
  // Guest limits are now handled by checkGuestLimit() instead
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

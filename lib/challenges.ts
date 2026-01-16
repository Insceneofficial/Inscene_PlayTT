/**
 * Challenge definitions for each episode
 * Challenges are set through chat and must be completed before proceeding
 */

// Challenges for Anish's series
export const ANISH_CHALLENGES: Record<number, string> = {
  2: "Think about launching a very small AI prototype in 7 days and getting feedback from 10 real users",
  3: "Update on the AI prototype using no code tools like lovable replit",
  4: "Test with 3 friends",
  5: "Launch with 10 friends"
};

/**
 * Get challenge for a specific episode
 */
export const getChallengeForEpisode = (seriesId: string, episodeId: number): string | null => {
  if (seriesId === 'startup-boy-anish') {
    return ANISH_CHALLENGES[episodeId] || null;
  }
  return null;
};

/**
 * Check if challenge is completed for an episode
 * Completion is tracked when user mentions completion in chat
 */
export const isChallengeCompleted = (seriesId: string, episodeId: number): boolean => {
  if (typeof window === 'undefined') return false;
  const storageKey = `inscene_challenge_${seriesId}_ep${episodeId}`;
  return localStorage.getItem(storageKey) === 'completed';
};

/**
 * Mark challenge as completed
 */
export const markChallengeCompleted = (seriesId: string, episodeId: number): void => {
  if (typeof window === 'undefined') return;
  const storageKey = `inscene_challenge_${seriesId}_ep${episodeId}`;
  localStorage.setItem(storageKey, 'completed');
};

/**
 * Check if user can proceed to next episode (challenge must be completed)
 */
export const canProceedToEpisode = (seriesId: string, episodeId: number): boolean => {
  // Episode 1 doesn't require a challenge
  if (episodeId === 1) return true;
  
  // Episode 2 doesn't require a challenge (episode 1 has no challenge)
  if (episodeId === 2) return true;
  
  // For episodes 3-5, check if previous episode's challenge is completed
  const previousEpisodeId = episodeId - 1;
  return isChallengeCompleted(seriesId, previousEpisodeId);
};

/**
 * Get challenge prompt for chat system
 * This should be included in the initialHook or system prompt
 */
export const getChallengePrompt = (seriesId: string, episodeId: number): string | null => {
  const challenge = getChallengeForEpisode(seriesId, episodeId);
  if (!challenge) return null;
  
  const isCompleted = isChallengeCompleted(seriesId, episodeId);
  
  if (isCompleted) {
    return null; // Don't prompt if already completed
  }
  
  return `IMPORTANT: The user just finished watching episode ${episodeId}. Their challenge is: "${challenge}". 

Your role:
1. First, help them set this challenge as a goal/commitment
2. Once they've committed to it, track their progress
3. Only when they explicitly mention they've completed the challenge (e.g., "I finished", "I completed it", "I'm done", "I did it"), acknowledge their completion and congratulate them
4. Until they complete it, gently nudge them towards completing this challenge in your responses
5. Do NOT mark it as complete until they explicitly say they've finished it

Be encouraging and supportive, but keep them focused on this specific challenge.`;
};

/**
 * Get the first message to send when a video ends
 * Checks if previous challenge is complete and either asks about it or sets next challenge
 */
export const getFirstChallengeMessage = (seriesId: string, episodeId: number): string | null => {
  // Episode 1 has no challenge, episode 2 has no previous challenge
  if (episodeId <= 2) {
    const challenge = getChallengeForEpisode(seriesId, episodeId);
    if (challenge) {
      return `Great job finishing episode ${episodeId}! Your challenge is: "${challenge}". Let's set this as your goal and work on it together!`;
    }
    return null;
  }
  
  // For episodes 3-5, check if previous challenge is complete
  const previousEpisodeId = episodeId - 1;
  const previousChallenge = getChallengeForEpisode(seriesId, previousEpisodeId);
  const isPreviousComplete = isChallengeCompleted(seriesId, previousEpisodeId);
  
  if (!isPreviousComplete && previousChallenge) {
    // Previous challenge not complete - ask about it
    return `Hey! Before we move to the next challenge, how's your progress on: "${previousChallenge}"? Have you completed it yet?`;
  }
  
  // Previous challenge is complete (or doesn't exist) - set next challenge
  const currentChallenge = getChallengeForEpisode(seriesId, episodeId);
  if (currentChallenge) {
    return `Awesome! Now that you've completed the previous challenge, your next challenge for episode ${episodeId} is: "${currentChallenge}". Let's set this as your new goal!`;
  }
  
  return null;
};

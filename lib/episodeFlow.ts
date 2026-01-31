/**
 * Episode Flow Configuration Utility
 * Maps JSON episode flow to existing numeric ID system
 */

import episodeFlowConfig from '../config/episodeFlow.json';

export interface EpisodeFlowConfig {
  startEpisode: string;
  globalRules: {
    defaultReturn: string;
    chatbot: {
      name: string;
      imageUpload: {
        enabled: boolean;
        analyze: boolean;
      };
    };
  };
  episodes: Record<string, EpisodeConfig>;
}

export interface EpisodeConfig {
  title: string;
  videoUrl: string;
  type: 'hub' | 'leaf' | 'sequence' | 'step' | 'single';
  ctas?: Array<{ label: string; target: string }>;
  chatRequired?: boolean;
  triggerChatOn?: ('complete' | 'skip')[];
  postAction?: {
    chat?: {
      prompt: string;
    };
    returnTo?: string;
  };
  sequence?: string[];
  next?: string;
}

// Map JSON string IDs to numeric IDs for compatibility
// This creates a stable mapping: ep1 -> 1, ep2 -> 2, etc.
const stringIdToNumericId = new Map<string, number>();
const numericIdToStringId = new Map<number, string>();

// Initialize mappings from JSON
let nextNumericId = 1;
Object.keys(episodeFlowConfig.episodes).forEach((stringId) => {
  stringIdToNumericId.set(stringId, nextNumericId);
  numericIdToStringId.set(nextNumericId, stringId);
  nextNumericId++;
});

/**
 * Convert JSON string episode ID to numeric ID
 */
export function getNumericId(stringId: string): number | null {
  return stringIdToNumericId.get(stringId) || null;
}

/**
 * Convert numeric episode ID to JSON string ID
 */
export function getStringId(numericId: number): string | null {
  return numericIdToStringId.get(numericId) || null;
}

/**
 * Get episode config by string ID
 */
export function getEpisodeConfig(stringId: string): EpisodeConfig | null {
  return episodeFlowConfig.episodes[stringId] || null;
}

/**
 * Get episode config by numeric ID
 */
export function getEpisodeConfigByNumericId(numericId: number): EpisodeConfig | null {
  const stringId = getStringId(numericId);
  if (!stringId) return null;
  return getEpisodeConfig(stringId);
}

/**
 * Get global rules
 */
export function getGlobalRules() {
  return episodeFlowConfig.globalRules;
}

/**
 * Get start episode string ID
 */
export function getStartEpisode(): string {
  return episodeFlowConfig.startEpisode;
}

/**
 * Get all episode string IDs
 */
export function getAllEpisodeIds(): string[] {
  return Object.keys(episodeFlowConfig.episodes);
}

/**
 * Merge JSON episode config into existing episode object
 * Preserves all existing fields, adds JSON fields
 */
export function mergeEpisodeConfig(existingEpisode: any, stringId: string): any {
  const config = getEpisodeConfig(stringId);
  if (!config) return existingEpisode;

  const merged = { ...existingEpisode };

  // Map videoUrl to url if url doesn't exist
  if (config.videoUrl && !merged.url) {
    merged.url = config.videoUrl;
  } else if (config.videoUrl) {
    // If both exist, prefer videoUrl from JSON (single source of truth)
    merged.url = config.videoUrl;
  }

  // Add JSON fields
  merged.title = config.title || merged.label || merged.title;
  merged.episodeType = config.type;
  merged.ctas = config.ctas;
  merged.postAction = config.postAction;
  merged.sequence = config.sequence;
  merged.chatRequired = config.chatRequired;
  merged.triggerChatOn = config.triggerChatOn;
  merged.next = config.next;

  // Convert CTA targets from string IDs to numeric IDs
  if (merged.ctas) {
    merged.ctas = merged.ctas.map((cta: any) => ({
      ...cta,
      targetEpisodeId: getNumericId(cta.target),
      target: cta.target, // Keep original for reference
    }));
  }

  // Preserve existing fields
  return merged;
}

/**
 * Get returnTo episode ID (numeric) from episode config
 */
export function getReturnToEpisodeId(episode: any): number | null {
  // Check postAction.returnTo first
  if (episode?.postAction?.returnTo) {
    const numericId = getNumericId(episode.postAction.returnTo);
    if (numericId !== null) return numericId;
  }

  // Fallback to global default
  const globalDefault = getGlobalRules().defaultReturn;
  return getNumericId(globalDefault);
}

/**
 * Check if episode is part of a sequence (either a sequence container or a step in a sequence)
 */
export function isSequenceEpisode(episode: any): boolean {
  // Check if episode is a sequence container
  if (episode?.episodeType === 'sequence' || episode?.type === 'sequence') {
    return true;
  }
  
  // Check if episode is a step in a sequence
  const currentStringId = getStringId(episode?.id);
  if (!currentStringId) return false;
  
  // Check if this episode ID appears in any sequence
  const allStringIds = getAllEpisodeIds();
  for (const stringId of allStringIds) {
    const config = getEpisodeConfig(stringId);
    if (config?.sequence && Array.isArray(config.sequence) && config.sequence.includes(currentStringId)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the sequence array that contains this episode
 */
function getSequenceForEpisode(episode: any): string[] | null {
  const currentStringId = getStringId(episode?.id);
  if (!currentStringId) return null;
  
  // Check if this episode is a sequence container
  if (episode?.sequence && Array.isArray(episode.sequence)) {
    return episode.sequence;
  }
  
  // Check if this episode is a step in another episode's sequence
  const allStringIds = getAllEpisodeIds();
  for (const stringId of allStringIds) {
    const config = getEpisodeConfig(stringId);
    if (config?.sequence && Array.isArray(config.sequence) && config.sequence.includes(currentStringId)) {
      return config.sequence;
    }
  }
  
  return null;
}

/**
 * Get first step in sequence (for sequence containers)
 */
export function getFirstInSequence(episode: any): string | null {
  // Check if this episode is a sequence container
  if (episode?.episodeType === 'sequence' || episode?.type === 'sequence') {
    if (episode?.sequence && Array.isArray(episode.sequence) && episode.sequence.length > 0) {
      return episode.sequence[0];
    }
  }
  
  // Also check by string ID
  const currentStringId = getStringId(episode?.id);
  if (currentStringId) {
    const config = getEpisodeConfig(currentStringId);
    if (config?.type === 'sequence' && config?.sequence && Array.isArray(config.sequence) && config.sequence.length > 0) {
      return config.sequence[0];
    }
  }
  
  return null;
}

/**
 * Get next episode in sequence
 */
export function getNextInSequence(currentEpisode: any): string | null {
  // If this is a sequence container, return the first step
  const firstStep = getFirstInSequence(currentEpisode);
  if (firstStep) {
    return firstStep;
  }
  
  // Otherwise, find the next step in the sequence
  const sequence = getSequenceForEpisode(currentEpisode);
  if (!sequence) return null;

  const currentStringId = getStringId(currentEpisode.id);
  if (!currentStringId) return null;

  const currentIndex = sequence.indexOf(currentStringId);
  if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
    return null;
  }

  return sequence[currentIndex + 1];
}

/**
 * Check if target episode is valid for sequence navigation
 */
export function isValidSequenceTarget(currentEpisode: any, targetStringId: string): boolean {
  if (!isSequenceEpisode(currentEpisode)) {
    return true; // Not a sequence episode, allow any navigation
  }

  const nextInSequence = getNextInSequence(currentEpisode);
  return nextInSequence === targetStringId;
}

/**
 * Check if episode is ep3 or part of ep3's sequence
 * Ep3 requires CTA-only progression (no auto-navigation)
 */
export function isEp3OrStep(episode: any): boolean {
  const currentStringId = getStringId(episode?.id);
  if (!currentStringId) return false;
  
  // Check if it's ep3 itself
  if (currentStringId === 'ep3') return true;
  
  // Check if it's part of ep3's sequence
  const ep3Config = getEpisodeConfig('ep3');
  if (ep3Config?.sequence && Array.isArray(ep3Config.sequence)) {
    return ep3Config.sequence.includes(currentStringId);
  }
  
  return false;
}

/**
 * Check if episode requires chat
 */
export function requiresChat(episode: any): boolean {
  // Check if episode has chatRequired flag
  if (episode?.chatRequired === true) {
    return true;
  }
  
  // Also check by string ID
  const currentStringId = getStringId(episode?.id);
  if (currentStringId) {
    const config = getEpisodeConfig(currentStringId);
    return config?.chatRequired === true;
  }
  
  return false;
}

/**
 * Check if chat should be triggered on video completion
 */
export function shouldTriggerChatOnComplete(episode: any): boolean {
  if (!requiresChat(episode)) return false;
  
  const currentStringId = getStringId(episode?.id);
  if (currentStringId) {
    const config = getEpisodeConfig(currentStringId);
    return config?.triggerChatOn?.includes('complete') ?? false;
  }
  
  // Fallback: check episode object directly
  return episode?.triggerChatOn?.includes('complete') ?? false;
}

/**
 * Check if chat should be triggered on swipe/skip
 */
export function shouldTriggerChatOnSkip(episode: any): boolean {
  if (!requiresChat(episode)) return false;
  
  const currentStringId = getStringId(episode?.id);
  if (currentStringId) {
    const config = getEpisodeConfig(currentStringId);
    return config?.triggerChatOn?.includes('skip') ?? false;
  }
  
  // Fallback: check episode object directly
  return episode?.triggerChatOn?.includes('skip') ?? false;
}

/**
 * Get episode-specific coaching instructions for guided chat sessions
 * Returns coaching behavior instructions based on episode title
 */
export function getEpisodeCoachingInstructions(episodeTitle: string): string | null {
  const title = episodeTitle?.trim() || '';
  
  // Map episode titles to their coaching instructions
  const coachingInstructions: Record<string, string> = {
    'Cover Drive': `IMPORTANT: This is a GUIDED CHAT SESSION for Cover Drive coaching. Act like an on-ground batting coach.

Your coaching flow:
1. First, DIAGNOSE: Listen to their issue and identify the root cause (footwork, head position, bat swing, or timing)
2. Then, EXPLAIN: Simply explain what's causing the problem
3. Then, CORRECT: Give ONE clear correction cue + ONE drill they can practice
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Focus on one fix at a time.`,

    'Cut Shot': `IMPORTANT: This is a GUIDED CHAT SESSION for Cut Shot coaching.

Your coaching flow:
1. First, DIAGNOSE: Determine if it's a judgment issue (shot selection) or execution issue (hands, timing)
2. Then, EXPLAIN: Simply explain the root cause
3. Then, CORRECT: Provide progressive drills (easy → advanced) focusing on shot selection, hands, and timing
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable.`,

    'On Drive': `IMPORTANT: This is a GUIDED CHAT SESSION for On Drive coaching.

Your coaching flow:
1. First, DIAGNOSE: Identify the issue (balance, alignment, or front-shoulder control)
2. Then, EXPLAIN: Simply explain what's causing the problem
3. Then, CORRECT: Give ONE simple mental cue + ONE repetition-based drill
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Focus on balance and timing.`,

    'Power Shot': `IMPORTANT: This is a GUIDED CHAT SESSION for Power Shot coaching.

Your coaching flow:
1. First, DIAGNOSE: Identify where power is lost (base, core, or bat speed)
2. Then, EXPLAIN: Simply explain the root cause
3. Then, CORRECT: Suggest technique-first correction + optional strength drill. Avoid brute-force advice.
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Focus on safe power generation.`,

    'Pull Shot': `IMPORTANT: This is a GUIDED CHAT SESSION for Pull Shot coaching.

Your coaching flow:
1. First, DIAGNOSE: Identify if it's decision-making (when to pull vs leave) or body position issue
2. Then, EXPLAIN: Simply explain the root cause
3. Then, CORRECT: Use confidence-building progressions to help them fix it safely
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Build confidence while fixing technique.`,

    'Speed Exercise 1': `IMPORTANT: This is a GUIDED CHAT SESSION for Speed Exercise 1 coaching.

Your coaching flow:
1. First, LISTEN: If they say "No" → simplify the exercise and motivate them. If they say "Yes" → assess their form
2. Then, EXPLAIN: Simply explain what needs improvement or what they did well
3. Then, CORRECT: If No → suggest a simpler version. If Yes → suggest form improvements
4. Finally, ASK: End by asking them to try it and report back

Never shame them. Be encouraging and supportive.`,

    'Speed Exercise 2': `IMPORTANT: This is a GUIDED CHAT SESSION for Speed Exercise 2 coaching.

Your coaching flow:
1. First, LISTEN: Understand their effort level and fatigue
2. Then, EXPLAIN: Simply explain what their response means
3. Then, CORRECT: Calibrate intensity - suggest recovery, volume change, or progression based on their response
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Adjust based on their feedback.`,

    'Speed Exercise 3': `IMPORTANT: This is a GUIDED CHAT SESSION for Speed Exercise 3 coaching.

Your coaching flow:
1. First, DIAGNOSE: Identify if it's a coordination issue or balance issue
2. Then, EXPLAIN: Simply explain the root cause
3. Then, CORRECT: Give ONE corrective drill + ONE coaching cue
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Focus on fixing footwork.`,

    'Speed Exercise 4': `IMPORTANT: This is a GUIDED CHAT SESSION for Speed Exercise 4 coaching.

Your coaching flow:
1. First, DIAGNOSE: Identify if consistency dropped due to fatigue or technique breakdown
2. Then, EXPLAIN: Simply explain the root cause
3. Then, CORRECT: Teach pacing and repeatability techniques
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Focus on maintaining consistency.`,

    'Speed Exercise 5': `IMPORTANT: This is a GUIDED CHAT SESSION for Speed Exercise 5 coaching.

Your coaching flow:
1. First, ACKNOWLEDGE: Celebrate completing all speed exercises
2. Then, SHIFT: Move to progression mindset - help them set a benchmark → next goal → plan
3. Then, GUIDE: Help them decide if they want to improve further or maintain this level
4. Finally, ASK: End by asking what they want to focus on next

Keep responses concise and forward-looking.`,

    'Endurance (Yo-Yo Test)': `IMPORTANT: This is a GUIDED CHAT SESSION for Endurance coaching.

Your coaching flow:
1. First, LISTEN: Get their Yo-Yo / Euro Test benchmark score
2. Then, EXPLAIN: Honestly interpret what their score means
3. Then, CORRECT: Provide a simple weekly endurance improvement plan
4. Finally, ASK: End by asking them to try it and report back

Keep responses concise and actionable. Be realistic about their current level.`,

    'Professional Mindset': `IMPORTANT: This is a GUIDED CHAT SESSION for Professional Mindset coaching.

Your coaching flow:
1. First, LISTEN: Understand their doubts and concerns about pursuing professional cricket
2. Then, EXPLAIN: Address their fears, timelines, and controllables with realism
3. Then, GUIDE: Help them think clearly and practically. No fake motivation.
4. Finally, ASK: End by asking what specific step they want to take next

Keep responses honest and practical. Be a realistic coach, not a cheerleader.`,

    'Age Selection & Applications': `IMPORTANT: This is a GUIDED CHAT SESSION for Age Selection & Applications coaching.

Your coaching flow:
1. First, LISTEN: Get their age and current level
2. Then, EXPLAIN: Provide structured guidance on eligibility → trials → documents
3. Then, GUIDE: Give them the exact pathway based on their age and level
4. Finally, ASK: End by asking what their next immediate action will be

Keep responses concise and actionable. Provide clear, structured guidance.`
  };
  
  return coachingInstructions[title] || null;
}
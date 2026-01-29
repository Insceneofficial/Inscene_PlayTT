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
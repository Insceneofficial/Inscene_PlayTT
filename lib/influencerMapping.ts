// Utility to map influencers/characters to their series and create influencer-specific routes

import { CHARACTER_PROFILES } from './characters';

export interface InfluencerInfo {
  id: string; // URL-friendly ID (e.g., 'startupboyanish', 'fit___monk', 'debuthefilmguy')
  name: string; // Display name (e.g., 'Anish', 'Chirag', 'Debu')
  seriesId: string; // ID of the series they belong to
  seriesTitle: string; // Title of the series
  avatar: string;
  greeting: string;
  description: string;
  theme: 'blue' | 'pink' | 'purple' | 'cyan' | 'green';
}

/**
 * Series catalog storage - will be set by App.tsx
 */
let seriesCatalog: any[] = [];

export const setSeriesCatalog = (catalog: any[]) => {
  seriesCatalog = catalog;
};

/**
 * Map influencer name to URL-friendly slug
 */
const INFLUENCER_SLUGS: Record<string, string> = {
  'Anish': 'startupboyanish',
  'Chirag': 'fit___monk',
  'Debu': 'debuthefilmguy',
};

const SLUG_TO_NAME: Record<string, string> = {
  'startupboyanish': 'Anish',
  'fit___monk': 'Chirag',
  'debuthefilmguy': 'Debu',
};

export const getInfluencerSlug = (name: string): string => {
  return INFLUENCER_SLUGS[name] || name.toLowerCase();
};

/**
 * Get influencer info by slug
 */
export const getInfluencerBySlug = (slug: string): InfluencerInfo | null => {
  // Look up the name from the slug
  const name = SLUG_TO_NAME[slug];
  if (!name) {
    return null;
  }
  
  // Find the series that contains this influencer
  for (const series of seriesCatalog) {
    if (series.avatars && series.avatars[name]) {
      const character = CHARACTER_PROFILES[name];
      if (character) {
        return {
          id: slug,
          name: name,
          seriesId: series.id,
          seriesTitle: series.title,
          avatar: series.avatars[name],
          greeting: character.greeting,
          description: character.description,
          theme: character.theme
        };
      }
    }
  }
  
  return null;
};

/**
 * Get all influencers with their info
 */
export const getAllInfluencers = (): InfluencerInfo[] => {
  const influencers: InfluencerInfo[] = [];
  const seen = new Set<string>();
  
  // List of influencers that should have pages
  const allowedInfluencers = new Set(['Anish', 'Chirag', 'Debu']);
  
  for (const series of seriesCatalog) {
    if (series.avatars) {
      for (const [charName, avatar] of Object.entries(series.avatars)) {
        // Skip any influencers not in allowed list
        if (!allowedInfluencers.has(charName)) {
          continue;
        }
        
        if (!seen.has(charName)) {
          seen.add(charName);
          const character = CHARACTER_PROFILES[charName];
          if (character) {
            influencers.push({
              id: getInfluencerSlug(charName),
              name: charName,
              seriesId: series.id,
              seriesTitle: series.title,
              avatar: avatar as string,
              greeting: character.greeting,
              description: character.description,
              theme: character.theme
            });
          }
        }
      }
    }
  }
  
  return influencers;
};

/**
 * Get series for a specific influencer
 */
export const getSeriesForInfluencer = (influencerSlug: string) => {
  const influencer = getInfluencerBySlug(influencerSlug);
  if (!influencer) return null;
  
  return seriesCatalog.find(s => s.id === influencer.seriesId) || null;
};


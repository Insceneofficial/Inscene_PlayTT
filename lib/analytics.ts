import { supabase, isSupabaseConfigured } from './supabase';
import { recordActivity, recordVideoCompletion } from './streaksAndPoints';

// ============================================
// ID Generation - Persistent Viewer & Session
// ============================================

/**
 * Get or create a persistent viewer ID (survives browser close)
 */
export const getViewerId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  
  let id = localStorage.getItem('inscene_viewer_id');
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('inscene_viewer_id', id);
  }
  return id;
};

/**
 * Get or create a session ID (resets on browser close)
 */
export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  
  let id = sessionStorage.getItem('inscene_session_id');
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('inscene_session_id', id);
  }
  return id;
};

/**
 * Get current Google user ID (if logged in via native Google OAuth)
 */
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

/**
 * Get device type from user agent
 */
const getDeviceType = (): string => {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
};

/**
 * Get browser name from user agent
 */
const getBrowser = (): string => {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  return 'Other';
};

// ============================================
// Viewer Tracking
// ============================================

/**
 * Track or update viewer on app load
 */
export const trackViewer = async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  const viewerId = getViewerId();
  const googleUserId = getGoogleUserId();
  
  try {
    // Try to update existing viewer
    const { data: existing } = await supabase
      .from('viewers')
      .select('id, visit_count')
      .eq('viewer_id', viewerId)
      .single();
    
    if (existing) {
      // Update existing viewer
      await supabase
        .from('viewers')
        .update({
          last_seen_at: new Date().toISOString(),
          visit_count: (existing.visit_count || 0) + 1,
          ...(googleUserId && { google_user_id: googleUserId })
        })
        .eq('viewer_id', viewerId);
    } else {
      // Create new viewer
      await supabase
        .from('viewers')
        .insert({
          viewer_id: viewerId,
          google_user_id: googleUserId,
          device_type: getDeviceType(),
          browser: getBrowser(),
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          visit_count: 1
        });
    }
  } catch (error) {
    console.warn('Analytics: Failed to track viewer', error);
  }
};

// ============================================
// Video Session Tracking
// ============================================

interface VideoSessionData {
  seriesId: string;
  seriesTitle: string;
  episodeId: number;
  episodeLabel: string;
  videoUrl?: string;
  entryPoint?: string;
  isMuted?: boolean;
}

/**
 * Start tracking a video session
 * Returns the session record ID for updates
 */
export const trackVideoStart = async (data: VideoSessionData): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  
  try {
    const { data: result, error } = await supabase
      .from('video_sessions')
      .insert({
        viewer_id: getViewerId(),
        session_id: getSessionId(),
        google_user_id: googleUserId,
        series_id: data.seriesId,
        series_title: data.seriesTitle,
        episode_id: data.episodeId,
        episode_label: data.episodeLabel,
        video_url: data.videoUrl,
        entry_point: data.entryPoint || 'discover_grid',
        muted_at_start: data.isMuted || false,
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) throw error;
    
    // Record streak activity for watching video
    // Extract creator from series (first character in the series)
    if (googleUserId && data.seriesId) {
      // Map series to creator - we'll get this from the series context
      recordActivity(data.seriesId, 'video', { 
        videoWatchSeconds: 0 
      }).then(result => {
        console.log('[Video Streaks] Activity recorded:', result);
      }).catch(err => {
        console.warn('[Video Streaks] Failed to record activity:', err);
      });
    }
    
    return result?.id || null;
  } catch (error) {
    console.warn('Analytics: Failed to start video session', error);
    return null;
  }
};

/**
 * Update video watch progress (call every 10 seconds)
 */
export const updateVideoProgress = async (
  recordId: string,
  watchDurationSeconds: number,
  videoDurationSeconds: number,
  pausedCount?: number,
  seekCount?: number
): Promise<void> => {
  if (!isSupabaseConfigured() || !recordId) return;
  
  const completionPercentage = videoDurationSeconds > 0
    ? Math.min(100, (watchDurationSeconds / videoDurationSeconds) * 100)
    : 0;
  
  try {
    await supabase
      .from('video_sessions')
      .update({
        video_duration_seconds: Math.floor(videoDurationSeconds),
        completion_percentage: Math.round(completionPercentage * 100) / 100,
        paused_count: pausedCount,
        seek_count: seekCount
      })
      .eq('id', recordId);
  } catch (error) {
    console.warn('Analytics: Failed to update video progress', error);
  }
};

/**
 * End video session
 */
export const trackVideoEnd = async (
  recordId: string,
  watchDurationSeconds: number,
  videoDurationSeconds: number,
  isCompleted: boolean,
  unmutedDuringWatch?: boolean,
  creatorId?: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !recordId) {
    console.warn('[Analytics] trackVideoEnd called without recordId or Supabase not configured');
    return;
  }
  
  const completionPercentage = videoDurationSeconds > 0
    ? Math.min(100, (watchDurationSeconds / videoDurationSeconds) * 100)
    : 0;
  
  const endedAt = new Date().toISOString();
  
  console.log('[Analytics] Attempting to update video_sessions:', {
    recordId,
    endedAt,
    watchDurationSeconds,
    videoDurationSeconds,
    isCompleted
  });
  
  try {
    // First, verify the record exists (using .maybeSingle() to avoid throwing on no match)
    const { data: existingRecord, error: selectError } = await supabase
      .from('video_sessions')
      .select('id, started_at')
      .eq('id', recordId)
      .maybeSingle();
    
    if (selectError) {
      console.error('[Analytics] ❌ Error checking if record exists for video_sessions:', {
        recordId,
        error: selectError?.message,
        code: selectError?.code
      });
      // Continue anyway - maybe it's an RLS issue but UPDATE will work
    } else if (!existingRecord) {
      console.error('[Analytics] ❌ Record not found for video_sessions:', {
        recordId,
        hint: 'The record might not exist or INSERT might have failed. Check if INSERT succeeded.'
      });
      // Continue anyway - try UPDATE to see what error we get
    } else {
      console.log('[Analytics] Found existing record, updating:', {
        recordId,
        startedAt: existingRecord.started_at
      });
    }
    
    console.log('[Analytics] Found existing record, updating:', {
      recordId,
      startedAt: existingRecord.started_at
    });
    
    // Now update the record
    // Note: watch_duration_seconds is a generated column, so we don't update it
    const { data, error } = await supabase
      .from('video_sessions')
      .update({
        video_duration_seconds: Math.floor(videoDurationSeconds),
        completion_percentage: Math.round(completionPercentage * 100) / 100,
        is_completed: isCompleted || completionPercentage >= 90,
        unmuted_during_watch: unmutedDuringWatch,
        ended_at: endedAt
      })
      .eq('id', recordId)
      .select();
    
    if (error) {
      console.error('[Analytics] ❌ video_sessions UPDATE failed:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        recordId,
        code: error.code
      });
    } else {
      console.log('[Analytics] ✓ video_sessions UPDATE success:', {
        recordId,
        rowsUpdated: data?.length || 0,
        endedAt: data?.[0]?.ended_at,
        fullData: data?.[0]
      });
      if (!data || data.length === 0) {
        console.error('[Analytics] ⚠️ UPDATE returned no rows despite record existing - possible RLS issue');
      }
      
      // Award completion points if video was completed (90%+)
      const googleUserId = getGoogleUserId();
      if (googleUserId && (isCompleted || completionPercentage >= 90) && creatorId) {
        recordVideoCompletion(creatorId).then(points => {
          if (points > 0) {
            console.log('[Video Points] Awarded', points, 'points for completing video');
          }
        }).catch(err => {
          console.warn('[Video Points] Failed to award completion points:', err);
        });
      }
    }
  } catch (error) {
    console.error('[Analytics] ❌ Failed to end video session:', error);
  }
};

// ============================================
// Chat Session Tracking
// ============================================

interface ChatSessionData {
  characterName: string;
  seriesId?: string;
  seriesTitle?: string;
  episodeId?: number;
  episodeLabel?: string;
  isWhatsAppStyle: boolean;
  entryPoint: 'video_sidebar' | 'video_end_screen' | 'choice_modal' | 'chat_history';
}

/**
 * Start tracking a chat session
 * Returns the session record ID for updates
 */
export const trackChatStart = async (data: ChatSessionData): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  
  const googleUserId = getGoogleUserId();
  // Generate ID client-side to avoid needing SELECT permission after INSERT
  const recordId = crypto.randomUUID();
  
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .insert({
        id: recordId,
        viewer_id: getViewerId(),
        session_id: getSessionId(),
        google_user_id: googleUserId,
        character_name: data.characterName,
        series_id: data.seriesId,
        series_title: data.seriesTitle,
        episode_id: data.episodeId,
        episode_label: data.episodeLabel,
        is_whatsapp_style: data.isWhatsAppStyle,
        entry_point: data.entryPoint,
        started_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('[Analytics] ❌ chat_sessions INSERT failed:', error.message, error.details, error.hint);
      throw error;
    }
    
    console.log('[Analytics] ✓ chat_sessions INSERT success, id:', recordId);
    return recordId;
  } catch (error) {
    console.warn('Analytics: Failed to start chat session', error);
    return null;
  }
};

/**
 * Update chat message counts
 */
export const updateChatMessages = async (
  recordId: string,
  messageCount: number,
  userMessageCount: number,
  assistantMessageCount: number
): Promise<void> => {
  if (!isSupabaseConfigured() || !recordId) return;
  
  try {
    await supabase
      .from('chat_sessions')
      .update({
        message_count: messageCount,
        user_message_count: userMessageCount,
        assistant_message_count: assistantMessageCount
      })
      .eq('id', recordId);
  } catch (error) {
    console.warn('Analytics: Failed to update chat messages', error);
  }
};

/**
 * End chat session
 */
export const trackChatEnd = async (
  recordId: string,
  durationSeconds: number,
  messageCount: number,
  userMessageCount: number,
  assistantMessageCount: number
): Promise<void> => {
  if (!isSupabaseConfigured() || !recordId) {
    console.warn('[Analytics] trackChatEnd called without recordId or Supabase not configured');
    return;
  }
  
  const endedAt = new Date().toISOString();
  
  console.log('[Analytics] Attempting to update chat_sessions:', {
    recordId,
    endedAt,
    durationSeconds,
    messageCount
  });
  
  try {
    // First, verify the record exists (using .maybeSingle() to avoid throwing on no match)
    const { data: existingRecord, error: selectError } = await supabase
      .from('chat_sessions')
      .select('id, started_at')
      .eq('id', recordId)
      .maybeSingle();
    
    if (selectError) {
      console.error('[Analytics] ❌ Error checking if record exists for chat_sessions:', {
        recordId,
        error: selectError?.message,
        code: selectError?.code
      });
      // Continue anyway - maybe it's an RLS issue but UPDATE will work
    } else if (!existingRecord) {
      console.error('[Analytics] ❌ Record not found for chat_sessions:', {
        recordId,
        hint: 'The record might not exist or INSERT might have failed. Check if INSERT succeeded.'
      });
      // Continue anyway - try UPDATE to see what error we get
    } else {
      console.log('[Analytics] Found existing record, updating:', {
        recordId,
        startedAt: existingRecord.started_at
      });
    }
    
    // Now update the record
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({
        duration_seconds: durationSeconds,
        message_count: messageCount,
        user_message_count: userMessageCount,
        assistant_message_count: assistantMessageCount,
        ended_at: endedAt
      })
      .eq('id', recordId)
      .select();
    
    if (error) {
      console.error('[Analytics] ❌ chat_sessions UPDATE failed:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        recordId,
        code: error.code
      });
    } else {
      console.log('[Analytics] ✓ chat_sessions UPDATE success:', {
        recordId,
        rowsUpdated: data?.length || 0,
        endedAt: data?.[0]?.ended_at,
        fullData: data?.[0]
      });
      if (!data || data.length === 0) {
        console.error('[Analytics] ⚠️ UPDATE returned no rows despite record existing - possible RLS issue');
      }
    }
  } catch (error) {
    console.error('[Analytics] ❌ Failed to end chat session:', error);
  }
};

// ============================================
// Page View Tracking
// ============================================

interface PageViewData {
  viewType: 'app_open' | 'discover' | 'chats_tab' | 'series_modal' | 'video' | 'chat';
  seriesId?: string;
  episodeId?: number;
  characterName?: string;
  tabName?: string;
}

/**
 * Track a page view
 */
export const trackPageView = async (data: PageViewData): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  const googleUserId = getGoogleUserId();
  
  try {
    await supabase
      .from('page_views')
      .insert({
        viewer_id: getViewerId(),
        session_id: getSessionId(),
        google_user_id: googleUserId,
        view_type: data.viewType,
        series_id: data.seriesId,
        episode_id: data.episodeId,
        character_name: data.characterName,
        tab_name: data.tabName,
        referrer: typeof document !== 'undefined' ? document.referrer : null,
        viewed_at: new Date().toISOString()
      });
  } catch (error) {
    console.warn('Analytics: Failed to track page view', error);
  }
};

// ============================================
// Video Progress Tracking (for UI display)
// ============================================

export interface EpisodeWatchStatus {
  episodeId: number;
  isCompleted: boolean;
  completionPercentage: number;
  watchedAt: string | null;
}

export interface SeriesProgress {
  seriesId: string;
  totalEpisodes: number;
  completedEpisodes: number;
  episodeStatuses: EpisodeWatchStatus[];
  overallProgress: number;
}

/**
 * Get watched episode status for a series
 */
export const getSeriesProgress = async (
  seriesId: string,
  episodeIds: number[]
): Promise<SeriesProgress> => {
  const defaultProgress: SeriesProgress = {
    seriesId,
    totalEpisodes: episodeIds.length,
    completedEpisodes: 0,
    episodeStatuses: episodeIds.map(id => ({
      episodeId: id,
      isCompleted: false,
      completionPercentage: 0,
      watchedAt: null
    })),
    overallProgress: 0
  };
  
  if (!isSupabaseConfigured()) return defaultProgress;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return defaultProgress;
  
  try {
    // Get best watch session for each episode
    const { data, error } = await supabase
      .from('video_sessions')
      .select('episode_id, is_completed, completion_percentage, ended_at')
      .eq('google_user_id', googleUserId)
      .eq('series_id', seriesId)
      .in('episode_id', episodeIds)
      .order('completion_percentage', { ascending: false });
    
    if (error) throw error;
    
    // Build a map of best progress per episode
    const episodeProgressMap = new Map<number, { isCompleted: boolean; completionPercentage: number; watchedAt: string | null }>();
    
    (data || []).forEach(session => {
      const existing = episodeProgressMap.get(session.episode_id);
      // Keep the best progress (highest completion %)
      if (!existing || (session.completion_percentage || 0) > existing.completionPercentage) {
        episodeProgressMap.set(session.episode_id, {
          isCompleted: session.is_completed || (session.completion_percentage >= 90),
          completionPercentage: session.completion_percentage || 0,
          watchedAt: session.ended_at
        });
      }
    });
    
    // Build episode statuses
    const episodeStatuses: EpisodeWatchStatus[] = episodeIds.map(id => {
      const progress = episodeProgressMap.get(id);
      return {
        episodeId: id,
        isCompleted: progress?.isCompleted || false,
        completionPercentage: progress?.completionPercentage || 0,
        watchedAt: progress?.watchedAt || null
      };
    });
    
    const completedEpisodes = episodeStatuses.filter(e => e.isCompleted).length;
    const overallProgress = episodeIds.length > 0 
      ? Math.round((completedEpisodes / episodeIds.length) * 100) 
      : 0;
    
    return {
      seriesId,
      totalEpisodes: episodeIds.length,
      completedEpisodes,
      episodeStatuses,
      overallProgress
    };
  } catch (error) {
    console.warn('Analytics: Failed to get series progress', error);
    return defaultProgress;
  }
};

/**
 * Get total count of unique completed episodes across all series for the current user
 * An episode is considered completed if is_completed = true or completion_percentage >= 90
 */
export const getCompletedEpisodesCount = async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return 0;
  
  try {
    // Get all completed video sessions
    const { data, error } = await supabase
      .from('video_sessions')
      .select('series_id, episode_id, is_completed, completion_percentage')
      .eq('google_user_id', googleUserId)
      .or('is_completed.eq.true,completion_percentage.gte.90');
    
    if (error) throw error;
    
    if (!data || data.length === 0) return 0;
    
    // Create a set of unique episode identifiers (series_id + episode_id)
    const uniqueEpisodes = new Set<string>();
    
    data.forEach(session => {
      const isCompleted = session.is_completed || (session.completion_percentage && session.completion_percentage >= 90);
      if (isCompleted) {
        // Use combination of series_id and episode_id as unique identifier
        const episodeKey = `${session.series_id}_${session.episode_id}`;
        uniqueEpisodes.add(episodeKey);
      }
    });
    
    return uniqueEpisodes.size;
  } catch (error) {
    console.warn('Analytics: Failed to get completed episodes count', error);
    return 0;
  }
};
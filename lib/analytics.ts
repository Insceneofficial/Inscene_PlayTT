import { supabase, isSupabaseConfigured } from './supabase';

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
        watch_duration_seconds: Math.floor(watchDurationSeconds),
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
  unmutedDuringWatch?: boolean
): Promise<void> => {
  if (!isSupabaseConfigured() || !recordId) return;
  
  const completionPercentage = videoDurationSeconds > 0
    ? Math.min(100, (watchDurationSeconds / videoDurationSeconds) * 100)
    : 0;
  
  try {
    await supabase
      .from('video_sessions')
      .update({
        watch_duration_seconds: Math.floor(watchDurationSeconds),
        video_duration_seconds: Math.floor(videoDurationSeconds),
        completion_percentage: Math.round(completionPercentage * 100) / 100,
        is_completed: isCompleted || completionPercentage >= 90,
        unmuted_during_watch: unmutedDuringWatch,
        ended_at: new Date().toISOString()
      })
      .eq('id', recordId);
  } catch (error) {
    console.warn('Analytics: Failed to end video session', error);
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
  if (!isSupabaseConfigured() || !recordId) return;
  
  try {
    await supabase
      .from('chat_sessions')
      .update({
        duration_seconds: Math.floor(durationSeconds),
        message_count: messageCount,
        user_message_count: userMessageCount,
        assistant_message_count: assistantMessageCount,
        ended_at: new Date().toISOString()
      })
      .eq('id', recordId);
  } catch (error) {
    console.warn('Analytics: Failed to end chat session', error);
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

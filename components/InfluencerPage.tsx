import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Logo from './Logo.tsx';
import ChatPanel from './ChatPanel.tsx';
import UserMenu from './UserMenu.tsx';
import AuthModal from './AuthModal.tsx';
import WaitlistModal from './WaitlistModal.tsx';
import ChatWidget from './ChatWidget.tsx';
import LeaderboardModal from './LeaderboardModal.tsx';
import StreakWidget from './StreakWidget.tsx';
import SeriesProgressCard from './SeriesProgressCard.tsx';
import GoalsModal from './GoalsModal.tsx';
import EpisodeView from './EpisodeView.tsx';
import { useAuth } from '../lib/auth';
import { canProceedToEpisode } from '../lib/challenges';
import { getUserMessageCount, MAX_USER_MESSAGES, hasUnlimitedMessages } from '../lib/chatStorage';
import { getInfluencerBySlug, getSeriesForInfluencer, setSeriesCatalog } from '../lib/influencerMapping';
import { getCharacterAvatar } from '../lib/characters';
import { SERIES_CATALOG } from '../App';
import { trackPageView, trackVideoStart, updateVideoProgress, trackVideoEnd, getSeriesProgress, SeriesProgress } from '../lib/analytics';

/**
 * Utility function to get user's path choice for a series
 */
const getPathChoice = (seriesId: string): 'building' | 'exploring' | null => {
  if (typeof window === 'undefined') return null;
  const storageKey = `inscene_path_choice_${seriesId}`;
  const choice = localStorage.getItem(storageKey);
  if (choice === 'building' || choice === 'exploring') {
    return choice;
  }
  return null;
};

/**
 * Utility function to filter episodes based on path choice and challenge completion
 */
const getFilteredEpisodes = (episodes: any[], seriesId: string): any[] => {
  const pathChoice = getPathChoice(seriesId);
  console.log('[getFilteredEpisodes] seriesId:', seriesId, 'pathChoice:', pathChoice, 'total episodes:', episodes.length);
  
  // If no path choice made yet, only show episode 1
  if (!pathChoice) {
    const filtered = episodes.filter((ep: any) => ep.id === 1);
    console.log('[getFilteredEpisodes] No path choice, showing only episode 1:', filtered.length);
    return filtered;
  }
  
  // Get base episodes based on path
  let baseEpisodes: number[];
  if (pathChoice === 'building') {
    baseEpisodes = [1, 2, 3, 4, 5];
  } else if (pathChoice === 'exploring') {
    baseEpisodes = [1, 3, 5];
  } else {
    const filtered = episodes.filter((ep: any) => ep.id === 1);
    console.log('[getFilteredEpisodes] Invalid path choice, showing only episode 1:', filtered.length);
    return filtered;
  }
  
  console.log('[getFilteredEpisodes] Base episodes for path', pathChoice, ':', baseEpisodes);
  
  // Filter episodes - show all episodes in baseEpisodes (no challenge completion check)
  const filtered = episodes.filter((ep: any) => {
    const isIncluded = baseEpisodes.includes(ep.id);
    console.log('[getFilteredEpisodes] Episode', ep.id, 'included:', isIncluded);
    return isIncluded;
  });
  
  console.log('[getFilteredEpisodes] Final filtered episodes:', filtered.map((ep: any) => ep.id));
  return filtered;
};

/**
 * VIDEO END SCREEN - Shows path choice modal for episode 1, otherwise auto-redirects to chat
 */
const VideoEndScreen: React.FC<{
  episode: any;
  series: any;
  influencerName: string;
  onEnterStory: (char: string, intro: string, hook: string, entryPoint: string) => void;
  onNextEpisode: () => void;
  onShowPathChoice?: () => void;
}> = ({ episode, series, influencerName, onEnterStory, onNextEpisode, onShowPathChoice }) => {
  const [countdown, setCountdown] = useState(5);
  const [userInteracted, setUserInteracted] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get the trigger for this influencer
  const primaryTrigger = episode.triggers?.find((t: any) => t.char === influencerName) || episode.triggers?.[0];

  // For episode 1, ALWAYS show path choice modal instead of auto-redirect
  // Note: This useEffect runs even if component returns null
  useEffect(() => {
    console.log('[VideoEndScreen] useEffect for path choice - episode.id:', episode.id, 'onShowPathChoice:', !!onShowPathChoice);
    if (episode.id === 1 && onShowPathChoice) {
      console.log('[VideoEndScreen] Episode 1 detected, ALWAYS showing path choice modal');
      // Trigger path choice modal immediately
      // This will always trigger regardless of previous choices
      console.log('[VideoEndScreen] Calling onShowPathChoice immediately');
      onShowPathChoice();
    }
  }, [episode.id, onShowPathChoice]);

  useEffect(() => {
    console.log('[VideoEndScreen] Mounted - episode:', episode.id, 'primaryTrigger:', primaryTrigger?.char);
    
    // For episode 1, don't start countdown - path choice modal will be shown instead
    if (episode.id === 1 && onShowPathChoice) {
      // Don't auto-redirect for episode 1
      return;
    }
    
    // For episodes 2-5, auto-redirect to chat immediately (no countdown) to set challenge
    if (episode.id > 1 && primaryTrigger) {
      // Small delay then auto-redirect to chat
      const timer = setTimeout(() => {
        if (!userInteracted) {
          console.log('[VideoEndScreen] Auto-redirecting to chat for episode', episode.id, 'to set challenge');
          onEnterStory(primaryTrigger.char, primaryTrigger.intro, primaryTrigger.hook, 'video_end_screen');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    // For other episodes (if any), start countdown for auto-redirect
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Auto-redirect to chat
          if (!userInteracted && primaryTrigger) {
            console.log('[VideoEndScreen] Countdown finished - auto-redirecting to chat with:', primaryTrigger.char);
            onEnterStory(primaryTrigger.char, primaryTrigger.intro, primaryTrigger.hook, 'video_end_screen');
          }
          return 0;
        }
        console.log('[VideoEndScreen] Countdown:', prev - 1);
        return prev - 1;
      });
    }, 1000);

    return () => {
      console.log('[VideoEndScreen] Cleanup - clearing interval');
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [userInteracted, primaryTrigger, onEnterStory, episode.id, onShowPathChoice]);

  const handleManualChat = (t: any) => {
    setUserInteracted(true);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    onEnterStory(t.char, t.intro, t.hook, 'video_end_screen');
  };

  const handleNextEpisode = () => {
    setUserInteracted(true);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    onNextEpisode();
  };

  const influencerTriggers = episode.triggers?.filter((t: any) => t.char === influencerName) || [];

  // For episode 1, don't show the chat redirect UI - path choice modal will be shown instead
  if (episode.id === 1 && onShowPathChoice) {
    return null; // Don't render the end screen UI for episode 1
  }
  
  // For episodes 2-5, don't show the countdown UI - auto-redirect to chat happens immediately
  if (episode.id > 1 && episode.id <= 5) {
    return null; // Don't render the end screen UI, chat will open automatically
  }
  
  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-black/60 backdrop-blur-xl animate-fade-in pointer-events-auto">
      <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight">Continue your journey</h3>
      
      {/* Auto-redirect countdown */}
      <div className="flex items-center gap-3 mb-8">
        <p className="text-white/60 text-sm">
          Connecting to {primaryTrigger?.char || 'coach'} in
        </p>
        <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <span className="text-white font-semibold text-lg">{countdown}</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-3 mb-10 w-full max-w-[280px]">
        {influencerTriggers.length > 0 ? (
          influencerTriggers.map((t: any, idx: number) => (
            <ChatWidget
              key={idx}
              characterName={t.char}
              avatar={series.avatars[t.char]}
              onClick={() => handleManualChat(t)}
              isOnline={true}
            />
          ))
        ) : (
          episode.triggers?.map((t: any, idx: number) => (
            <ChatWidget
              key={idx}
              characterName={t.char}
              avatar={series.avatars[t.char]}
              onClick={() => handleManualChat(t)}
              isOnline={true}
            />
          ))
        )}
      </div>

      <button onClick={handleNextEpisode} className="flex flex-col items-center gap-2 group">
        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>
        </div>
        <span className="text-[13px] text-white/50 group-hover:text-white/80 transition-colors">Next</span>
      </button>
    </div>
  );
};

// Character Avatar Component - Refined minimal style
const CharacterDP: React.FC<{ src: string, name: string, theme: 'blue' | 'pink' | 'purple' | 'cyan' | 'green', size?: string, isOnline?: boolean, isDark?: boolean }> = ({ src, name, theme, size = "w-16 h-16", isOnline = true, isDark = false }) => {
  const [error, setError] = useState(false);

  return (
    <div className={`relative ${size} rounded-full flex items-center justify-center overflow-hidden shadow-lg transition-all duration-300`}>
      {isOnline && <div className={`absolute bottom-0 right-0 w-3 h-3 bg-[#4A7C59] border-2 ${isDark ? 'border-[#0a0a0f]' : 'border-white'} rounded-full z-30`} />}
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
        {!error ? (
          <img 
            src={src} 
            alt={name} 
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <span className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-[#1A1A1A]'}`}>{name[0]}</span>
        )}
      </div>
    </div>
  );
};

// Reel Item Component for influencer page
const ReelItem: React.FC<{
  episode: any;
  series: any;
  influencerName: string;
  influencerTheme: 'blue' | 'pink' | 'purple' | 'cyan' | 'green';
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  onEnterStory: (char: string, intro: string, hook: string, entryPoint: string) => void;
  onNextEpisode: () => void;
  isChatOpen?: boolean;
  showEndScreen?: boolean;
  onShowPathChoice?: () => void;
}> = ({ episode, series, influencerName, influencerTheme, isActive, isMuted, toggleMute, onEnterStory, onNextEpisode, isChatOpen = false, showEndScreen = true, onShowPathChoice }) => {
  console.log('[InfluencerPage ReelItem] Component rendering - isActive:', isActive, 'episode:', episode?.label);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isUIHidden, setIsUIHidden] = useState(false);

  // Analytics tracking
  const analyticsRecordId = React.useRef<string | null>(null);
  const inactivityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityHandlerRef = React.useRef<((event?: Event) => void) | null>(null);
  const mouseMoveHandlerRef = React.useRef<((event?: Event) => void) | null>(null);
  const lastMouseMoveTimeRef = React.useRef<number>(0);
  const trackVideoStartPromise = React.useRef<Promise<string | null> | null>(null);
  const progressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const seekCountRef = React.useRef(0);
  const pauseCountRef = React.useRef(0);
  const wasUnmutedRef = React.useRef(false);
  const initialMutedRef = React.useRef(isMuted);
  const isEndingSession = React.useRef(false);
  const sessionStartTime = React.useRef<number | null>(null);
  const hasTriggeredNextScroll = React.useRef(false);
  const lastEpisodeIdRef = React.useRef<string | number | null>(null);
  
  // Swipe gesture detection refs
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const touchStartTime = React.useRef<number | null>(null);
  const minSwipeDistance = 30; // Minimum distance in pixels to consider it a swipe
  const maxSwipeTime = 300; // Maximum time in ms to consider it a swipe

  // iOS fix: Set webkit-playsinline attribute for older iOS versions
  React.useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('playsinline', 'true');
    }
  }, []);

  // Cleanup: Ensure video is paused and muted when component unmounts
  React.useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.muted = true;
      }
    };
  }, []);

  // Pause video when chat opens, resume when chat closes
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    
    if (isChatOpen) {
      video.pause();
    } else if (video.paused && !isEnded) {
      video.play().catch(() => {});
    }
  }, [isChatOpen, isActive, isEnded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      console.log('[Video] useEffect - Video ref not available');
      return;
    }
    
    if (isActive) {
      console.log('[Video] useEffect - Video became active - Episode:', episode.label, {
        url: episode.url,
        isMuted: isMuted,
        readyState: video.readyState,
        networkState: video.networkState,
        paused: video.paused
      });
      
      setIsEnded(false);
      
      // Only reset video position if this is a different episode
      const isNewEpisode = lastEpisodeIdRef.current !== episode.id;
      if (isNewEpisode) {
        console.log('[Video] New episode detected, resetting video');
        video.currentTime = 0;
        lastEpisodeIdRef.current = episode.id;
      }
      
      video.preload = "auto";
      
      // iOS fix: Explicitly load the video when it becomes active
      // This is especially important for new episodes
      if (isNewEpisode || !video.readyState || video.readyState < 2) {
        console.log('[Video] Calling video.load() - isNewEpisode:', isNewEpisode, 'readyState:', video.readyState);
        video.load();
      } else {
        console.log('[Video] Video already loaded, readyState:', video.readyState);
      }
      
      // Reset tracking state
      seekCountRef.current = 0;
      pauseCountRef.current = 0;
      wasUnmutedRef.current = false;
      initialMutedRef.current = isMuted;
      isEndingSession.current = false;
      sessionStartTime.current = null;
      hasTriggeredNextScroll.current = false; // Reset scroll trigger flag
      
      // Only start a new session if we don't already have one in progress
      if (!analyticsRecordId.current && !trackVideoStartPromise.current) {
        const startPromise = trackVideoStart({
          seriesId: series.id,
          seriesTitle: series.title,
          episodeId: episode.id,
          episodeLabel: episode.label,
          videoUrl: episode.url,
          entryPoint: 'influencer_page',
          isMuted: isMuted
        });
        
        trackVideoStartPromise.current = startPromise;
        
        startPromise.then(recordId => {
          if (recordId) {
            analyticsRecordId.current = recordId;
            sessionStartTime.current = Date.now();
          }
        }).catch(error => {
          console.error('[Video Analytics] Error starting session:', error);
        });
      }
      
      // Update progress every 10 seconds
      progressIntervalRef.current = setInterval(() => {
        if (video && analyticsRecordId.current && !video.paused) {
          updateVideoProgress(
            analyticsRecordId.current,
            video.currentTime,
            video.duration || 0,
            pauseCountRef.current,
            seekCountRef.current
          );
        }
      }, 10000);
      
      // iOS fix: Wait a bit for video to be ready before playing
      const attemptPlay = () => {
        console.log('[Video] attemptPlay called - Episode:', episode.label, {
          readyState: video.readyState,
          networkState: video.networkState,
          paused: video.paused,
          muted: video.muted,
          src: video.src
        });
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Video started playing successfully
              console.log('[Video] Play started successfully - Episode:', episode.label);
            })
            .catch((error) => {
              console.warn('[Video] Play failed - Episode:', episode.label, {
                error: error,
                errorName: error.name,
                errorMessage: error.message,
                readyState: video.readyState,
                networkState: video.networkState
              });
              // On iOS, autoplay might fail without user interaction
              // Hide loading after a delay so user can see video and tap to play
              setTimeout(() => {
                if (video && isActive && video.readyState >= 3) {
                  console.log('[Video] Fallback: Hiding loading after play failed (readyState >= 3)');
                  // Video is loaded enough to show, just not playing
                  setLoading(false);
                }
              }, 2000);
            });
        } else {
          console.log('[Video] play() returned undefined - Episode:', episode.label);
        }
      };

      // Store cleanup handlers
      let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
      let onCanPlayHandler: (() => void) | null = null;
      let onPlayingHandler: (() => void) | null = null;

      // For iOS, wait for video to be ready
      if (video.readyState >= 2) {
        console.log('[Video] Video readyState >= 2, attempting play immediately - Episode:', episode.label);
        attemptPlay();
        // Also add fallback timeout for when video is already ready
        // Safari fix: Clear loading if video has enough data to display (readyState >= 2)
        fallbackTimeout = setTimeout(() => {
          if (video && isActive && video.readyState >= 2) {
            console.log('[Video] Fallback: Hiding loading after timeout (video ready to display) - Episode:', episode.label);
            setLoading(false);
          }
        }, 2000);
        
        onPlayingHandler = () => {
          console.log('[Video] Playing handler fired, cleaning up - Episode:', episode.label);
          if (fallbackTimeout) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
          }
          if (onPlayingHandler) {
            video.removeEventListener('playing', onPlayingHandler);
          }
        };
        video.addEventListener('playing', onPlayingHandler);
      } else {
        console.log('[Video] Video readyState < 2, waiting for canplay event - Episode:', episode.label, 'readyState:', video.readyState);
        // Wait for video to load
        onCanPlayHandler = () => {
          console.log('[Video] canplay event fired, attempting play - Episode:', episode.label);
          attemptPlay();
          if (onCanPlayHandler) {
            video.removeEventListener('canplay', onCanPlayHandler);
          }
        };
        video.addEventListener('canplay', onCanPlayHandler);
        
        // Fallback: If video doesn't start playing after 2 seconds, hide loading
        // Safari fix: Clear loading if video has enough data to display (readyState >= 2)
        // This ensures user can see the video and tap to play
        fallbackTimeout = setTimeout(() => {
          if (video && isActive && video.readyState >= 2) {
            console.log('[Video] Fallback: Hiding loading after timeout (video ready to display) - Episode:', episode.label);
            setLoading(false);
          }
        }, 2000);
        
        // Clean up timeout when video starts playing
        onPlayingHandler = () => {
          console.log('[Video] Playing handler fired (from canplay path), cleaning up - Episode:', episode.label);
          if (fallbackTimeout) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
          }
          if (onPlayingHandler) {
            video.removeEventListener('playing', onPlayingHandler);
          }
        };
        video.addEventListener('playing', onPlayingHandler);
      }

      return () => {
        endVideoSession(false);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        // Ensure video is paused and muted on cleanup
        if (video) {
          video.pause();
          video.muted = true;
        }
        // Cleanup video event listeners and timeout
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
        }
        if (onCanPlayHandler && video) {
          video.removeEventListener('canplay', onCanPlayHandler);
        }
        if (onPlayingHandler && video) {
          video.removeEventListener('playing', onPlayingHandler);
        }
      };
    } else {
      // When video becomes inactive, pause, mute, and stop it completely
      video.pause();
      video.muted = true;
      video.preload = "none";
      endVideoSession(false);
      
      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        // Ensure video is fully stopped on cleanup
        if (video) {
          video.pause();
          video.muted = true;
        }
      };
    }
  }, [isActive, series, episode]);

  const endVideoSession = async (isCompleted: boolean = false) => {
    if (isEndingSession.current) return;
    
    if (!analyticsRecordId.current && trackVideoStartPromise.current) {
      try {
        const recordId = await trackVideoStartPromise.current;
        if (recordId) analyticsRecordId.current = recordId;
      } catch (error) {
        console.error('[Video Analytics] Error:', error);
      }
    }
    
    if (!analyticsRecordId.current) return;
    
    isEndingSession.current = true;
    const recordIdToEnd = analyticsRecordId.current;
    
    await trackVideoEnd(
      recordIdToEnd,
      videoRef.current?.currentTime || 0,
      videoRef.current?.duration || 0,
      isCompleted,
      wasUnmutedRef.current
    );
    
    analyticsRecordId.current = null;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      endVideoSession(false);
    };
  }, []);

  useEffect(() => {
    // When video ends, mark for end screen display and end analytics session
    if (isEnded && isActive) {
      // End analytics session if available
      if (analyticsRecordId.current && !hasTriggeredNextScroll.current) {
        hasTriggeredNextScroll.current = true; // Mark as triggered to prevent multiple calls
        endVideoSession(true);
      }
      
      // For episode 1, ALWAYS trigger path choice modal immediately when video ends
      if (episode.id === 1 && onShowPathChoice) {
        console.log('[InfluencerPage ReelItem] Episode 1 ended - triggering path choice modal immediately');
        // Trigger immediately without delay to ensure it shows
        onShowPathChoice();
        return;
      }
      
      // NOTE: We no longer auto-scroll to next episode
      // Instead, the VideoEndScreen will handle auto-redirect to chat
      if (!hasTriggeredNextScroll.current) {
        console.log('[InfluencerPage ReelItem] Video ended - showing end screen with chat redirect');
        hasTriggeredNextScroll.current = true;
      }
    }
  }, [isEnded, isActive, episode.id, onShowPathChoice]);

  // Inactivity detection - hide UI after 5 seconds of inactivity
  useEffect(() => {
    console.log('[InfluencerPage Inactivity] Effect running - isActive:', isActive, 'isEnded:', isEnded);
    
    if (!isActive || isEnded) {
      console.log('[InfluencerPage Inactivity] Video not active or ended, resetting UI visibility');
      setIsUIHidden(false);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const resetInactivityTimer = () => {
      console.log('[InfluencerPage Inactivity] Resetting timer - showing UI');
      setIsUIHidden(false);
      
      if (inactivityTimerRef.current) {
        console.log('[InfluencerPage Inactivity] Clearing existing timer');
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      
      console.log('[InfluencerPage Inactivity] Setting new timer for 5 seconds');
      inactivityTimerRef.current = setTimeout(() => {
        console.log('[InfluencerPage Inactivity] Timer fired - hiding UI');
        setIsUIHidden(true);
      }, 5000);
    };

    const handleActivity = (event?: Event) => {
      const eventType = event?.type || 'unknown';
      console.log('[InfluencerPage Inactivity] Activity detected:', eventType);
      resetInactivityTimer();
    };
    
    // Throttled handler for mouse movements - only reset timer once per second
    const handleMouseMove = (event?: Event) => {
      const now = Date.now();
      // Only reset if it's been at least 1 second since last mouse move reset
      if (now - lastMouseMoveTimeRef.current >= 1000) {
        console.log('[InfluencerPage Inactivity] Mouse movement detected (throttled)');
        lastMouseMoveTimeRef.current = now;
        resetInactivityTimer();
      }
    };
    
    activityHandlerRef.current = handleActivity;
    mouseMoveHandlerRef.current = handleMouseMove;

    const setupTimeout = setTimeout(() => {
      const container = containerRef.current;
      const video = videoRef.current;
      
      console.log('[InfluencerPage Inactivity] Refs check - container:', !!container, 'video:', !!video);
      
      if (!container || !video) {
        console.log('[InfluencerPage Inactivity] Refs not ready after timeout');
        return;
      }
      
      console.log('[InfluencerPage Inactivity] Setting up inactivity detection');
      resetInactivityTimer();

      const handler = activityHandlerRef.current;
      const mouseMoveHandler = mouseMoveHandlerRef.current;
      if (handler && mouseMoveHandler) {
        console.log('[InfluencerPage Inactivity] Attaching event listeners');
        // Immediate handlers for clicks/touches
        container.addEventListener('mousedown', handler);
        container.addEventListener('touchstart', handler, { passive: true });
        container.addEventListener('touchmove', handler, { passive: true });
        container.addEventListener('click', handler);
        container.addEventListener('wheel', handler, { passive: true });
        
        // Throttled handlers for mouse movements
        container.addEventListener('mousemove', mouseMoveHandler, { passive: true });
        container.addEventListener('pointermove', mouseMoveHandler, { passive: true });
        
        video.addEventListener('mousedown', handler);
        video.addEventListener('touchstart', handler, { passive: true });
        video.addEventListener('touchmove', handler, { passive: true });
        video.addEventListener('click', handler);
        video.addEventListener('mousemove', mouseMoveHandler, { passive: true });
        video.addEventListener('pointermove', mouseMoveHandler, { passive: true });
        console.log('[InfluencerPage Inactivity] Event listeners attached');
      }
    }, 500);

    return () => {
      console.log('[InfluencerPage Inactivity] Cleanup - clearing timers');
      clearTimeout(setupTimeout);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      
      const container = containerRef.current;
      const video = videoRef.current;
      const handler = activityHandlerRef.current;
      const mouseMoveHandler = mouseMoveHandlerRef.current;
      
      if (container && handler && mouseMoveHandler) {
        container.removeEventListener('mousedown', handler);
        container.removeEventListener('touchstart', handler);
        container.removeEventListener('touchmove', handler);
        container.removeEventListener('click', handler);
        container.removeEventListener('wheel', handler);
        container.removeEventListener('mousemove', mouseMoveHandler);
        container.removeEventListener('pointermove', mouseMoveHandler);
      }
      
      if (video && handler && mouseMoveHandler) {
        video.removeEventListener('mousedown', handler);
        video.removeEventListener('touchstart', handler);
        video.removeEventListener('touchmove', handler);
        video.removeEventListener('click', handler);
        video.removeEventListener('mousemove', mouseMoveHandler);
        video.removeEventListener('pointermove', mouseMoveHandler);
      }
    };
  }, [isActive, isEnded]);

  // Debug: Log UI hidden state changes
  useEffect(() => {
    console.log('[InfluencerPage Inactivity] UI Hidden state changed:', isUIHidden);
  }, [isUIHidden]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100 || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setProgress(parseFloat(e.target.value));
      seekCountRef.current += 1;
      // Reset inactivity timer on seek
      setIsUIHidden(false);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
          setIsUIHidden(true);
        }, 5000);
      }
    }
  };

  const handlePause = () => {
    pauseCountRef.current += 1;
  };
  
  // Handle swipe gestures - pause video and show UI
  const handleSwipe = useCallback(() => {
    const video = videoRef.current;
    if (!video || isEnded || video.paused || !isActive) return;
    
    // Pause the video
    video.pause();
    
    // Show UI
    setIsUIHidden(false);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        setIsUIHidden(true);
      }, 5000);
    }
  }, [isEnded, isActive]);
  
  // Touch event handlers for swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || touchStartTime.current === null) {
      return;
    }
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const deltaTime = Date.now() - touchStartTime.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // Reset touch start values
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTime.current = null;
    
    // Check if it's a swipe (not just a tap)
    if (deltaTime < maxSwipeTime && (absDeltaX > minSwipeDistance || absDeltaY > minSwipeDistance)) {
      // Determine swipe direction
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe (left or right)
        if (absDeltaX > minSwipeDistance) {
          handleSwipe();
        }
      } else {
        // Vertical swipe (up or down)
        if (absDeltaY > minSwipeDistance) {
          handleSwipe();
        }
      }
    }
  }, [handleSwipe]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const influencerTriggers = episode.triggers?.filter((t: any) => t.char === influencerName) || [];

  // Debug: Log render state
  if (isActive && !isEnded) {
    console.log('[InfluencerPage ReelItem] Render - isUIHidden:', isUIHidden, 'isActive:', isActive, 'isEnded:', isEnded);
  }

  return (
    <div 
      ref={containerRef} 
      className="reel-item flex items-center justify-center overflow-hidden bg-[#0a0a0f]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        src={episode.url}
        preload={isActive ? "auto" : "none"}
        className={`w-full h-full object-cover transition-all duration-1000 ${isEnded ? 'scale-105 blur-3xl opacity-40' : 'opacity-100'}`}
        playsInline
        autoPlay
        muted={isMuted}
        onLoadStart={() => {
          console.log('[Video] LoadStart - Episode:', episode.label, 'URL:', episode.url);
          setLoading(true);
        }}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          console.log('[Video] LoadedMetadata - Episode:', episode.label, {
            duration: video?.duration,
            videoWidth: video?.videoWidth,
            videoHeight: video?.videoHeight,
            readyState: video?.readyState,
            networkState: video?.networkState
          });
        }}
        onLoadedData={() => {
          const video = videoRef.current;
          console.log('[Video] LoadedData - Episode:', episode.label, {
            readyState: video?.readyState,
            networkState: video?.networkState,
            paused: video?.paused,
            muted: video?.muted
          });
          // Safari fix: Hide loading when video data is loaded, even if autoplay is blocked
          // This ensures the video is visible so users can interact with it
          if (video && video.readyState >= 2) {
            console.log('[Video] LoadedData - Hiding loading spinner (readyState >= 2)');
            setLoading(false);
          }
        }}
        onCanPlay={() => {
          const video = videoRef.current;
          console.log('[Video] CanPlay - Episode:', episode.label, {
            readyState: video?.readyState,
            paused: video?.paused
          });
        }}
        onCanPlayThrough={() => {
          const video = videoRef.current;
          console.log('[Video] CanPlayThrough - Episode:', episode.label, {
            readyState: video?.readyState,
            paused: video?.paused
          });
        }}
        onWaiting={() => {
          console.log('[Video] Waiting - Episode:', episode.label, 'Buffering...');
          setLoading(true);
        }}
        onPlaying={() => {
          const video = videoRef.current;
          console.log('[Video] Playing - Episode:', episode.label, {
            currentTime: video?.currentTime,
            duration: video?.duration,
            paused: video?.paused,
            muted: video?.muted
          });
          // iOS fix: Only hide loading when video actually starts playing
          setLoading(false);
        }}
        onPause={() => {
          const video = videoRef.current;
          console.log('[Video] Pause - Episode:', episode.label, {
            currentTime: video?.currentTime,
            ended: video?.ended
          });
          handlePause();
        }}
        onEnded={() => {
          console.log('[Video] Ended - Episode:', episode.label, 'Episode ID:', episode.id);
          setIsEnded(true);
          // For episode 1, immediately trigger path choice modal when video ends
          if (episode.id === 1 && onShowPathChoice) {
            console.log('[Video] onEnded - Episode 1 detected, triggering path choice modal');
            // Use setTimeout to ensure state is updated first
            setTimeout(() => {
              onShowPathChoice();
            }, 100);
          }
        }}
        onError={(e) => {
          const video = videoRef.current;
          const errorMessages: { [key: number]: string } = {
            1: 'MEDIA_ERR_ABORTED - The user aborted the loading',
            2: 'MEDIA_ERR_NETWORK - A network error caused the download to fail',
            3: 'MEDIA_ERR_DECODE - The video playback was aborted due to a corruption problem or unsupported codec',
            4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - The video format is not supported by Safari'
          };
          
          // Try to get error immediately
          if (video && video.error) {
            const error = video.error;
            console.error('[Video] Error loading video - Episode:', episode.label, {
              errorCode: error.code,
              errorMessage: errorMessages[error.code] || 'Unknown error',
              videoSrc: episode.url,
              networkState: video.networkState,
              readyState: video.readyState,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              src: video.src
            });
          } else {
            // Error not immediately available - try again after a short delay
            setTimeout(() => {
              if (video) {
                if (video.error) {
                  const error = video.error;
                  console.error('[Video] Error loading video (delayed check) - Episode:', episode.label, {
                    errorCode: error.code,
                    errorMessage: errorMessages[error.code] || 'Unknown error',
                    videoSrc: episode.url,
                    networkState: video.networkState,
                    readyState: video.readyState,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    src: video.src
                  });
                } else {
                  console.error('[Video] Error loading video (no error property) - Episode:', episode.label, {
                    videoSrc: episode.url,
                    networkState: video.networkState,
                    readyState: video.readyState,
                    src: video.src,
                    paused: video.paused,
                    muted: video.muted
                  });
                }
              }
            }, 100);
            
            // Log immediate state
            console.error('[Video] Error event fired - Episode:', episode.label, {
              videoSrc: episode.url,
              videoExists: !!video,
              networkState: video?.networkState,
              readyState: video?.readyState,
              src: video?.src
            });
          }
          setLoading(false);
        }}
        onTimeUpdate={handleTimeUpdate}
        onClick={() => {
          const video = videoRef.current;
          console.log('[Video] Click - Episode:', episode.label, 'Currently paused:', video?.paused);
          if (video?.paused) {
            video.play().catch((err) => {
              console.error('[Video] Play failed on click:', err);
            });
            // Show UI when playing
            setIsUIHidden(false);
            if (inactivityTimerRef.current) {
              clearTimeout(inactivityTimerRef.current);
              inactivityTimerRef.current = setTimeout(() => {
                setIsUIHidden(true);
              }, 5000);
            }
          } else {
            video?.pause();
            // Show UI when paused
            setIsUIHidden(false);
            if (inactivityTimerRef.current) {
              clearTimeout(inactivityTimerRef.current);
              inactivityTimerRef.current = setTimeout(() => {
                setIsUIHidden(true);
              }, 5000);
            }
          }
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          handleTouchStart(e);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          handleTouchEnd(e);
        }}
      />

      {loading && !isEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-white/60">Loading...</p>
          </div>
        </div>
      )}

      {!isEnded && (
        <>
          <div className={`absolute bottom-24 left-6 pointer-events-none z-50 transition-opacity duration-500 ${isUIHidden ? 'opacity-0' : 'opacity-100'}`}>
            <span className="text-[13px] font-medium text-white/90 drop-shadow-md">{episode.label}</span>
            <p className="text-white text-[12px] opacity-50 max-w-[200px] leading-tight mt-1">{series.reelHint || 'Chat with the coach to learn more'}</p>
          </div>

          <div className="absolute right-4 bottom-24 flex flex-col items-end gap-3 z-[100] pointer-events-auto max-w-[280px]">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                setIsUIHidden(false);
                if (inactivityTimerRef.current) {
                  clearTimeout(inactivityTimerRef.current);
                  inactivityTimerRef.current = setTimeout(() => {
                    setIsUIHidden(true);
                  }, 5000);
                }
                toggleMute(); 
              }}
              className={`flex flex-col items-center gap-1.5 active:scale-95 transition-all group mb-2 transition-opacity duration-500 ${isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:bg-white/20">
                {isMuted ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.535 7.465a.75.75 0 0 1 1.06 0L22.12 10l-2.525 2.525a.75.75 0 1 1-1.06-1.06L20 10l-1.465-1.465a.75.75 0 0 1 0-1.06Z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06 4.25 4.25 0 0 1 0 6.01.75.75 0 0 0 1.06 1.06 5.75 5.75 0 0 0 0-8.13ZM21.03 5.97a.75.75 0 0 0-1.06 1.06 8.5 8.5 0 0 1 0 12.02.75.75 0 1 0 1.06 1.06 10 10 0 0 0 0-14.14Z" /></svg>
                )}
              </div>
            </button>

            {influencerTriggers.map((t: any, idx: number) => (
              <div
                key={idx}
                data-chat-button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onEnterStory(t.char, t.intro, t.hook, 'video_sidebar'); 
                }}
                className="w-full animate-slide-up-side cursor-pointer"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="relative group">
                  {/* Speech Bubble */}
                  {isActive && !isEnded && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-full z-50 transition-all duration-500 ease-in-out pointer-events-none mr-2" style={{ opacity: 1 }}>
                      <div className={`relative bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg transition-all duration-500 ease-in-out ${isUIHidden ? 'max-w-[180px]' : 'max-w-[50px]'}`}>
                        <div className="text-[#1A1A1A] text-[12px] font-medium leading-tight transition-all duration-500 ease-in-out whitespace-nowrap flex items-center gap-0.5">
                          {isUIHidden ? 'Chat now' : (
                            <>
                              <span className="inline-block dot-bounce-1 text-[#4A7C59]">.</span>
                              <span className="inline-block dot-bounce-2 text-[#4A7C59]">.</span>
                              <span className="inline-block dot-bounce-3 text-[#4A7C59]">.</span>
                            </>
                          )}
                        </div>
                        {/* Tail pointing right */}
                        <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full w-0 h-0 border-l-[6px] border-t-[5px] border-b-[5px] border-l-white/95 border-t-transparent border-b-transparent"></div>
                      </div>
                    </div>
                  )}
                   <CharacterDP 
                    src={series.avatars[influencerName]} 
                    name={influencerName} 
                    theme="green"
                    size="w-12 h-12"
                    isOnline={true}
                    isDark={true}
                   />
                </div>
              </div>
            ))}
          </div>
        </>
      )}


      {!isEnded && (
        <div className={`absolute bottom-0 left-0 right-0 z-[70] pt-20 group/scrubber transition-all pointer-events-none transition-opacity duration-500 ${isUIHidden ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent h-20 pointer-events-none" />
          <div className={`relative px-5 pb-5 transition-all duration-300 ${isScrubbing ? 'translate-y-[-8px]' : 'translate-y-0'}`}>
            <div className="relative h-5 flex items-center">
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="0.1" 
                value={progress} 
                onChange={handleSeek} 
                onMouseDown={() => {
                  setIsScrubbing(true);
                  setIsUIHidden(false);
                }}
                onMouseUp={() => setIsScrubbing(false)}
                onTouchStart={() => {
                  setIsScrubbing(true);
                  setIsUIHidden(false);
                }}
                onTouchEnd={() => setIsScrubbing(false)}
                className="scrub-range w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer pointer-events-auto z-10" 
              />
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white rounded-full transition-all duration-75 pointer-events-none" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className={`mt-1.5 flex justify-between items-center transition-all duration-500 ${isScrubbing ? 'opacity-100' : 'opacity-50'}`}>
              <div className="text-[11px] text-white tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Premium cream background for main page
const CREAM_BG = '#FAF9F6';
const SAGE_GREEN = '#4A7C59';

const InfluencerPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [selectedSeries, setSelectedSeries] = useState<any>(null);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [chatData, setChatData] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [episodeProgress, setEpisodeProgress] = useState<SeriesProgress | null>(null);
  const [isCloseButtonHidden, setIsCloseButtonHidden] = useState(false);
  const [challengeVersion, setChallengeVersion] = useState(0); // Force re-render when challenge completion changes
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar closed by default
  const closeButtonInactivityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonActivityHandlerRef = React.useRef<((event?: Event) => void) | null>(null);
  const closeButtonMouseMoveHandlerRef = React.useRef<((event?: Event) => void) | null>(null);
  const lastCloseButtonMouseMoveTimeRef = React.useRef<number>(0);

  // Initialize series catalog immediately (not in useEffect) to avoid race conditions on direct navigation
  setSeriesCatalog(SERIES_CATALOG);

  const influencer = slug ? getInfluencerBySlug(slug) : null;
  
  // Get all series that contain this influencer
  const influencerSeries = influencer ? SERIES_CATALOG.filter((s: any) => 
    s.avatars && s.avatars[influencer.name]
  ) : [];
  
  // Auto-select the first series to skip series selection page
  useEffect(() => {
    if (influencerSeries.length > 0 && !selectedSeries) {
      setSelectedSeries(influencerSeries[0]);
    }
  }, [influencerSeries.length]);
  
  // Use selectedSeries if available, otherwise null
  const series = selectedSeries;

  // Track page view
  useEffect(() => {
    if (influencer) {
      trackPageView({ viewType: 'video' });
    }
  }, [influencer]);

  // Close button inactivity detection - hide close button after 5 seconds of inactivity
  useEffect(() => {
    if (selectedEpisodeIndex === null || chatData) {
      setIsCloseButtonHidden(false);
      if (closeButtonInactivityTimerRef.current) {
        clearTimeout(closeButtonInactivityTimerRef.current);
        closeButtonInactivityTimerRef.current = null;
      }
      return;
    }

    const resetCloseButtonInactivityTimer = () => {
      setIsCloseButtonHidden(false);
      
      if (closeButtonInactivityTimerRef.current) {
        clearTimeout(closeButtonInactivityTimerRef.current);
        closeButtonInactivityTimerRef.current = null;
      }
      
      closeButtonInactivityTimerRef.current = setTimeout(() => {
        setIsCloseButtonHidden(true);
      }, 5000);
    };

    const handleCloseButtonActivity = (event?: Event) => {
      resetCloseButtonInactivityTimer();
    };

    const handleCloseButtonMouseMove = (event?: Event) => {
      const now = Date.now();
      if (now - lastCloseButtonMouseMoveTimeRef.current >= 1000) {
        lastCloseButtonMouseMoveTimeRef.current = now;
        resetCloseButtonInactivityTimer();
      }
    };

    closeButtonActivityHandlerRef.current = handleCloseButtonActivity;
    closeButtonMouseMoveHandlerRef.current = handleCloseButtonMouseMove;

    const setupTimeout = setTimeout(() => {
      const container = document.querySelector('.reel-item');
      
      if (!container) {
        return;
      }
      
      resetCloseButtonInactivityTimer();

      const handler = closeButtonActivityHandlerRef.current;
      const mouseMoveHandler = closeButtonMouseMoveHandlerRef.current;
      if (handler && mouseMoveHandler) {
        container.addEventListener('mousedown', handler);
        container.addEventListener('touchstart', handler, { passive: true });
        container.addEventListener('touchmove', handler, { passive: true });
        container.addEventListener('click', handler);
        container.addEventListener('wheel', handler, { passive: true });
        container.addEventListener('mousemove', mouseMoveHandler, { passive: true });
        container.addEventListener('pointermove', mouseMoveHandler, { passive: true });
      }
    }, 500);

    return () => {
      clearTimeout(setupTimeout);
      if (closeButtonInactivityTimerRef.current) {
        clearTimeout(closeButtonInactivityTimerRef.current);
        closeButtonInactivityTimerRef.current = null;
      }
      
      const container = document.querySelector('.reel-item');
      const handler = closeButtonActivityHandlerRef.current;
      const mouseMoveHandler = closeButtonMouseMoveHandlerRef.current;
      
      if (container && handler && mouseMoveHandler) {
        container.removeEventListener('mousedown', handler);
        container.removeEventListener('touchstart', handler);
        container.removeEventListener('touchmove', handler);
        container.removeEventListener('click', handler);
        container.removeEventListener('wheel', handler);
        container.removeEventListener('mousemove', mouseMoveHandler);
        container.removeEventListener('pointermove', mouseMoveHandler);
      }
    };
  }, [selectedEpisodeIndex, chatData]);

  // Filter episodes to only show those with this influencer, then filter by path choice and challenge completion
  const influencerEpisodes = useMemo(() => {
    const allEpisodes = series?.episodes?.filter((ep: any) => 
      ep.triggers?.some((t: any) => t.char === influencer?.name)
    ) || [];
    
    // Apply path-based and challenge-based filtering if series exists
    if (series?.id) {
      return getFilteredEpisodes(allEpisodes, series.id);
    }
    
    return allEpisodes;
  }, [series?.episodes, series?.id, influencer?.name]);
  
  // Memoize episode IDs to prevent SeriesProgressCard re-renders
  const episodeIds = useMemo(() => {
    return influencerEpisodes.map((ep: any) => ep.id);
  }, [influencerEpisodes]);

  // Track if episode progress has been loaded for current series
  const episodeProgressLoadedRef = useRef<string | null>(null);
  
  // Reset progress loading ref when series changes
  useEffect(() => {
    if (!selectedSeries) {
      episodeProgressLoadedRef.current = null;
      setEpisodeProgress(null);
    }
  }, [selectedSeries]);
  
  // Load episode progress when series is selected
  useEffect(() => {
    const loadProgress = async () => {
      if (!selectedSeries || !isAuthenticated || episodeIds.length === 0) {
        return;
      }
      
      // Skip if already loaded for this series
      if (episodeProgressLoadedRef.current === selectedSeries.id) {
        return;
      }
      
      try {
        const progress = await getSeriesProgress(selectedSeries.id, episodeIds);
        setEpisodeProgress(progress);
        episodeProgressLoadedRef.current = selectedSeries.id;
      } catch (error) {
        console.error('[InfluencerPage] Failed to load episode progress:', error);
      }
    };
    
    loadProgress();
  }, [selectedSeries?.id, isAuthenticated, episodeIds]);

  // Handler to move to next episode
  const handleNextEpisode = useCallback(() => {
    if (selectedEpisodeIndex !== null && selectedEpisodeIndex < influencerEpisodes.length - 1) {
      const nextIdx = selectedEpisodeIndex + 1;
      setSelectedEpisodeIndex(nextIdx);
      setActiveIdx(nextIdx);
    } else {
      // If no more episodes, exit episode view
      setSelectedEpisodeIndex(null);
    }
  }, [selectedEpisodeIndex, influencerEpisodes.length]);

  // Handler to navigate to specific episode by ID
  const handleNavigateToEpisode = useCallback((episodeId: number) => {
    const targetIndex = influencerEpisodes.findIndex((ep: any) => ep.id === episodeId);
    if (targetIndex !== -1) {
      setSelectedEpisodeIndex(targetIndex);
      setActiveIdx(targetIndex);
    }
  }, [influencerEpisodes]);

  // Update activeIdx when selectedEpisodeIndex changes
  useEffect(() => {
    if (selectedEpisodeIndex !== null) {
      setActiveIdx(selectedEpisodeIndex);
    }
  }, [selectedEpisodeIndex]);

  const handleChatInit = async (chatDataConfig: any) => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    
    // Check message count limit (skip for unlimited users)
    if (!hasUnlimitedMessages()) {
      const messageCount = await getUserMessageCount();
      if (messageCount >= MAX_USER_MESSAGES) {
        setIsWaitlistModalOpen(true);
        return;
      }
    }
    
    setChatData(chatDataConfig);
  };

  if (!influencer) {
    return (
      <div className="flex flex-col min-h-[100dvh] h-[100dvh] overflow-hidden items-center justify-center" style={{ background: CREAM_BG, color: '#1A1A1A' }}>
        <h1 className="text-xl font-semibold mb-4">Page not found</h1>
        <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-[#4A7C59] text-white rounded-xl font-medium hover:bg-[#3D6549] transition-all">
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] h-[100dvh] overflow-hidden" style={{ background: CREAM_BG, color: '#1A1A1A' }}>
      <header className="fixed top-0 left-0 right-0 z-[1000] px-6 py-4 transition-all duration-500 bg-[#FAF9F6]/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          {/* Left side - Hamburger and Home */}
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm border border-black/[0.08] flex items-center justify-center active:scale-95 hover:bg-white transition-all shadow-sm"
              aria-label="Toggle sidebar"
              aria-expanded={isSidebarOpen}
            >
              <div className="flex flex-col gap-1.5 w-5">
                <span
                  className={`h-0.5 bg-[#4A4A4A] rounded-full transition-all duration-300 ${
                    isSidebarOpen ? 'rotate-45 translate-y-2' : ''
                  }`}
                />
                <span
                  className={`h-0.5 bg-[#4A4A4A] rounded-full transition-all duration-300 ${
                    isSidebarOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`h-0.5 bg-[#4A4A4A] rounded-full transition-all duration-300 ${
                    isSidebarOpen ? '-rotate-45 -translate-y-2' : ''
                  }`}
                />
              </div>
            </button>
            {/* Home button */}
            <div className="flex items-center gap-3 cursor-pointer group active:scale-[0.98] transition-transform" onClick={() => navigate('/')}>
              <Logo size={32} isPulsing={false} src="/icon_purple.png" />
              <span className="text-[#8A8A8A] text-sm font-medium">Home</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserMenu onSignInClick={() => setIsAuthModalOpen(true)} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-28 overflow-hidden relative">
        {/* Overlay for mobile when sidebar is open */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999] md:hidden transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar - Profile Details */}
        <aside
          className={`fixed md:absolute top-28 md:top-0 left-0 h-[calc(100vh-7rem)] md:h-full w-[320px] flex-shrink-0 overflow-y-auto bg-[#FAF9F6] border-r border-black/[0.06] px-6 py-6 z-[1000] transform transition-transform duration-300 ease-out shadow-xl md:shadow-none ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ willChange: 'transform' }}
        >
          {/* Close Button - Visible on all screens */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="w-8 h-8 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-all active:scale-95"
              aria-label="Close sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-[#8A8A8A]"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Influencer Header */}
          <div className="flex flex-col items-center gap-6 mb-6">
            <CharacterDP 
              src={influencer.avatar} 
              name={influencer.name} 
              theme="green"
              size="w-24 h-24"
              isOnline={true}
            />
            <div className="flex-1 text-center w-full">
              <h1 className="text-2xl font-semibold tracking-tight mb-1">{influencer.name}</h1>
              <p className="text-[#8A8A8A] text-[14px] leading-relaxed mb-4">{influencer.description}</p>
              
              {/* Streak Widget - Shows user's progress */}
              {isAuthenticated && (
                <div className="mb-4 w-full">
                  <StreakWidget
                    creatorId={influencer.name}
                    creatorName={influencer.name}
                    onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
                    compact={false}
                  />
                </div>
              )}
              
              {/* Leaderboard Button for non-authenticated users */}
              {!isAuthenticated && (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="mb-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#4A7C59]/10 to-[#C9A227]/10 rounded-xl border border-black/[0.06] text-[#4A4A4A] hover:border-[#4A7C59]/30 transition-all"
                >
                  <span className="text-lg">🏆</span>
                  <span className="text-[14px] font-medium">View Leaderboard</span>
                </button>
              )}
              
              {/* Chat Widget - Always visible */}
              {(() => {
                const firstSeries = influencerSeries[0];
                const firstEp = firstSeries?.episodes?.find((ep: any) => 
                  ep.triggers?.some((t: any) => t.char === influencer.name)
                );
                const firstTrigger = firstEp?.triggers?.find((t: any) => t.char === influencer.name);
                
                if (!firstTrigger) return null;
                
                return (
                  <div className="w-full">
                    <ChatWidget
                      characterName={influencer.name}
                      avatar={influencer.avatar}
                      onClick={() => handleChatInit({
                        char: firstTrigger.char,
                        intro: firstTrigger.intro,
                        hook: firstTrigger.hook,
                        isFromHistory: false,
                        isWhatsApp: true,
                        entryPoint: 'influencer_page',
                        seriesId: firstSeries.id,
                        seriesTitle: firstSeries.title
                      })}
                      isOnline={true}
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Series Progress & Goals - In Sidebar */}
          {selectedSeries && (
            <div className="mb-6">
              <SeriesProgressCard
                seriesId={selectedSeries.id}
                seriesTitle={selectedSeries.title}
                creatorId={influencer?.name || ''}
                episodeIds={episodeIds}
                onGoalClick={(goal) => {
                  setSelectedGoal(goal);
                  setIsGoalsModalOpen(true);
                }}
              />
            </div>
          )}
        </aside>

        {/* Main Content - Episodes */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* EPISODES VIEW */}
          {selectedSeries && (
            <>
              <h3 className="text-[13px] font-semibold tracking-wide text-[#8A8A8A] mb-4 uppercase">Episodes</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {influencerEpisodes.map((ep: any, idx: number) => {
                const thumbnailUrl = selectedSeries.thumbnail;
                const epProgress = episodeProgress?.episodeStatuses?.find(s => s.episodeId === ep.id);
                const isWatched = epProgress?.isCompleted || false;
                const watchProgress = epProgress?.completionPercentage || 0;
                const hasStarted = watchProgress > 0 && !isWatched;
                
                return (
                  <div
                    key={ep.id}
                    onClick={() => {
                      const index = influencerEpisodes.findIndex(e => e.id === ep.id);
                      setSelectedEpisodeIndex(index);
                    }}
                    className={`group cursor-pointer relative aspect-[9/16] rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md hover:-translate-y-1 active:scale-[0.98] bg-[#F5F3EE] ${
                      isWatched 
                        ? 'border-2 border-[#4A7C59]' 
                        : hasStarted 
                          ? 'border-2 border-[#C9A227]/50' 
                          : 'border border-black/[0.06]'
                    }`}
                  >
                    {/* Video thumbnail or placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#4A7C59]/10 to-[#4A90A4]/10 flex items-center justify-center">
                      {thumbnailUrl && (
                        <img 
                          src={thumbnailUrl} 
                          alt={ep.label} 
                          className={`w-full h-full object-cover ${isWatched ? 'opacity-50' : 'opacity-70'}`}
                        />
                      )}
                    </div>
                    
                    {/* Watched checkmark badge */}
                    {isWatched && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#4A7C59] flex items-center justify-center shadow-md z-10">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
                          <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    
                    {/* In-progress indicator */}
                    {hasStarted && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-[#C9A227] text-white text-[9px] font-semibold shadow-md z-10">
                        {Math.round(watchProgress)}%
                      </div>
                    )}
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20">
                      <div className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#1A1A1A] ml-0.5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>

                    {/* Episode label */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                      <span className="text-[12px] font-medium text-white">{ep.label}</span>
                    </div>
                    
                    {/* Progress bar at bottom */}
                    {hasStarted && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                        <div 
                          className="h-full bg-[#C9A227] transition-all"
                          style={{ width: `${watchProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {influencerEpisodes.length === 0 && (
              <div className="text-center py-16 text-[#8A8A8A]">
                <p className="text-[15px]">No episodes available yet</p>
              </div>
            )}
            </>
          )}
        </main>
      </div>

      {/* Video Player - Mobile-first EpisodeView */}
      {selectedSeries && selectedEpisodeIndex !== null && influencerEpisodes[selectedEpisodeIndex] && (
        <EpisodeView
          episode={influencerEpisodes[selectedEpisodeIndex]}
          series={selectedSeries}
          isMuted={isMuted}
          toggleMute={() => setIsMuted(!isMuted)}
          onEnterStory={(char, intro, hook, entryPoint) => {
            handleChatInit({
              char, intro, hook, 
              isFromHistory: false, 
              isWhatsApp: false,
              entryPoint,
              seriesId: selectedSeries.id,
              seriesTitle: selectedSeries.title,
              episodeId: influencerEpisodes[selectedEpisodeIndex].id,
              episodeLabel: influencerEpisodes[selectedEpisodeIndex].label
            });
          }}
          onNextEpisode={handleNextEpisode}
          onExit={() => {
            setSelectedEpisodeIndex(null);
            setActiveIdx(0);
          }}
          onNavigateToEpisode={handleNavigateToEpisode}
          isChatOpen={!!chatData}
        />
      )}

      {chatData && (
        <ChatPanel 
          character={chatData.char} 
          episodeLabel={chatData.episodeLabel || influencerEpisodes[selectedEpisodeIndex || 0]?.label || "Inscene History"}
          instantGreeting={chatData.intro || influencer.greeting}
          initialHook={chatData.hook || "Continuing conversation"}
          avatar={chatData.avatar || influencer.avatar}
          onClose={() => setChatData(null)}
          existingMessages={chatData.isFromHistory ? chatData.history : undefined}
          isWhatsApp={chatData.isWhatsApp}
          entryPoint={chatData.entryPoint || 'video_sidebar'}
          seriesId={chatData.seriesId}
          seriesTitle={chatData.seriesTitle}
          episodeId={chatData.episodeId}
          onWaitlistRequired={() => setIsWaitlistModalOpen(true)}
          onChallengeCompleted={(seriesId, episodeId) => {
            console.log('[InfluencerPage] Challenge completed callback - seriesId:', seriesId, 'episodeId:', episodeId);
            // Force re-render to update episode list
            setChallengeVersion(prev => prev + 1);
          }}
        />
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      {/* Goals Modal */}
      {isGoalsModalOpen && selectedGoal && (
        <GoalsModal
          goal={selectedGoal}
          onClose={() => {
            setIsGoalsModalOpen(false);
            setSelectedGoal(null);
          }}
          onMarkDone={async () => {
            // Mark the goal as done
            const { markTaskDone, getActiveGoal } = await import('../lib/goals');
            await markTaskDone(selectedGoal.id);
            // Refresh the goal
            const updatedGoal = await getActiveGoal(influencer?.name || '');
            setSelectedGoal(updatedGoal);
          }}
          onPause={async () => {
            const { pauseGoal } = await import('../lib/goals');
            await pauseGoal(selectedGoal.id);
            setIsGoalsModalOpen(false);
            setSelectedGoal(null);
          }}
          onEdit={() => {
            // Open chat to edit goal
            setIsGoalsModalOpen(false);
            const firstSeries = influencerSeries[0];
            const firstEp = firstSeries?.episodes?.find((ep: any) => 
              ep.triggers?.some((t: any) => t.char === influencer?.name)
            );
            const firstTrigger = firstEp?.triggers?.find((t: any) => t.char === influencer?.name);
            if (firstTrigger) {
              handleChatInit({
                char: firstTrigger.char,
                intro: "I want to change my goal",
                hook: firstTrigger.hook,
                isFromHistory: true,
                isWhatsApp: true,
                entryPoint: 'influencer_page',
                seriesId: firstSeries.id,
                seriesTitle: firstSeries.title
              });
            }
          }}
        />
      )}

      <WaitlistModal 
        isOpen={isWaitlistModalOpen} 
        onClose={() => setIsWaitlistModalOpen(false)} 
      />

      {/* Leaderboard Modal */}
      {isLeaderboardOpen && influencer && (
        <LeaderboardModal
          creatorId={influencer.name}
          creatorName={influencer.name}
          creatorAvatar={influencer.avatar}
          onClose={() => setIsLeaderboardOpen(false)}
        />
      )}


      {/* Bottom Navigation Bar - visible on series/episodes view */}
      {selectedEpisodeIndex === null && (
        <nav className="fixed bottom-0 left-0 right-0 z-[1001] px-4 pb-6 pt-2">
          <div className="max-w-md mx-auto h-14 rounded-2xl border border-black/[0.06] flex items-center shadow-lg relative overflow-hidden bg-white/80 backdrop-blur-xl">
            <button 
              onClick={() => navigate('/')}
              className="flex-1 flex flex-col items-center gap-0.5 transition-colors duration-300 ease-in-out justify-center h-full text-[#ACACAC] hover:text-[#4A7C59]"
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-6 h-6 transition-colors duration-300 ease-in-out"
              >
                <path d="M11.03 3.97a.75.75 0 0 1 1.06 0l7.452 7.453c.11.11.176.26.182.417v8.91a.75.75 0 0 1-.75.75H14.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-2a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75H5.274a.75.75 0 0 1-.75-.75V11.84c.006-.157.072-.307.182-.417L11.03 3.97Z" />
              </svg>
              <span className="text-[10px] font-semibold transition-colors duration-300 ease-in-out">Discover</span>
            </button>

            <button 
              onClick={() => navigate('/?view=chats')}
              className="flex-1 flex flex-col items-center gap-0.5 transition-colors duration-300 ease-in-out justify-center h-full text-[#ACACAC] hover:text-[#4A90A4]"
            >
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 transition-colors duration-300 ease-in-out">
                  <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.178.713a19.022 19.022 0 01-1.522 3.535c-.211.373.08.794.48.754a10.875 10.875 0 002.517-.504z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-[10px] font-semibold transition-colors duration-300 ease-in-out">Messages</span>
            </button>

          </div>
        </nav>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes slideUpSide {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-slide-up-side {
          animation: slideUpSide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .dot-bounce-1 { animation: dotBounce 1s ease-in-out infinite; }
        .dot-bounce-2 { animation: dotBounce 1s ease-in-out infinite 0.15s; }
        .dot-bounce-3 { animation: dotBounce 1s ease-in-out infinite 0.3s; }
        .reel-snap-container {
          scroll-snap-type: y mandatory;
          height: 100dvh;
          overflow-y: scroll;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          overflow-x: hidden;
        }
        .reel-item {
          scroll-snap-align: start;
          scroll-snap-stop: always;
          height: 100dvh;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
        .scrub-range { -webkit-appearance: none; }
        .scrub-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; }
      `}</style>
    </div>
  );
};

export default InfluencerPage;

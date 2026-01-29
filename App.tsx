import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from './components/Logo.tsx';
import ChatPanel from './components/ChatPanel.tsx';
import AuthModal from './components/AuthModal.tsx';
import WaitlistModal from './components/WaitlistModal.tsx';
import UserMenu from './components/UserMenu.tsx';
import InfluencerPage from './components/InfluencerPage.tsx';
import ChatWidget from './components/ChatWidget.tsx';
import HamburgerMenu from './components/HamburgerMenu.tsx';
import LeaderboardDrawer from './components/LeaderboardDrawer.tsx';
import EpisodeView from './components/EpisodeView.tsx';
import { AuthProvider, useAuth } from './lib/auth';
import { getUserMessageCount, MAX_USER_MESSAGES, hasUnlimitedMessages } from './lib/chatStorage';
import { Analytics } from "@vercel/analytics/react";
import { 
  trackViewer, 
  trackVideoStart, 
  updateVideoProgress, 
  trackVideoEnd,
  trackPageView
} from './lib/analytics';
import { loadAllChatHistories } from './lib/chatStorage';
import { AVATARS, getCharacterAvatar, getAllCharacterNames, CHARACTER_PROFILES } from './lib/characters';
import { setSeriesCatalog, getAllInfluencers, getInfluencerSlug, InfluencerInfo } from './lib/influencerMapping';
import { 
  mergeEpisodeConfig, 
  getReturnToEpisodeId, 
  getGlobalRules,
  getNumericId,
  getStringId,
  isSequenceEpisode,
  getNextInSequence,
  isValidSequenceTarget,
  getAllEpisodeIds,
  isEp3OrStep
} from './lib/episodeFlow';

// Re-export for backward compatibility with existing code
const CHIRAG_AVATAR = AVATARS.Chirag;

/**
 * Optimized Image Proxy Utility
 */
const getSmartImageUrl = (url: string, v: string = '1', w: number = 400, h: number = 400) => {
  if (!url) return '';
  if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) return url; 
  const cacheBuster = `v${v}_${new Date().getDate()}_${new Date().getHours()}`;
  const encodedUrl = encodeURIComponent(url);
  return `https://wsrv.nl/?url=${encodedUrl}&w=${w}&h=${h}&fit=cover&a=top&output=jpg&q=85&il&maxage=7d&t=${cacheBuster}`;
};

/**
 * Character Avatar Component - Refined minimal style
 */
const CharacterDP: React.FC<{ src: string, name: string, theme: 'blue' | 'pink' | 'purple' | 'cyan' | 'green', size?: string, isOnline?: boolean, isDark?: boolean }> = ({ src, name, theme, size = "w-16 h-16", isOnline = true, isDark = false }) => {
  const [error, setError] = useState(false);

  return (
    <div className={`relative ${size} rounded-full flex items-center justify-center overflow-hidden shadow-lg transition-all duration-300`}>
      {isOnline && <div className={`absolute bottom-0 right-0 w-3 h-3 bg-[#4A7C59] border-2 ${isDark ? 'border-black' : 'border-white'} rounded-full z-30`} />}
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

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * VIDEO END SCREEN - Shows path choice modal for episode 1, otherwise auto-redirects to chat
 */
const VideoEndScreen: React.FC<{
  episode: any;
  series: any;
  onEnterStory: (char: string, intro: string, hook: string, entryPoint: string) => void;
  onNextEpisode: () => void;
  onShowPathChoice?: () => void;
}> = ({ episode, series, onEnterStory, onNextEpisode, onShowPathChoice }) => {
  const [countdown, setCountdown] = useState(5);
  const [userInteracted, setUserInteracted] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get the first trigger (primary character for this episode)
  const primaryTrigger = episode.triggers[0];

  // For episode 1, show path choice modal instead of auto-redirect
  useEffect(() => {
    if (episode.id === 1 && onShowPathChoice) {
      // Trigger path choice modal after a short delay
      const timer = setTimeout(() => {
        onShowPathChoice();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [episode.id, onShowPathChoice]);

  useEffect(() => {
    // For episode 1, don't start countdown - path choice modal will be shown instead
    if (episode.id === 1 && onShowPathChoice) {
      return;
    }
    
    // For other episodes, start countdown for auto-redirect
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Auto-redirect to chat
          if (!userInteracted && primaryTrigger) {
            onEnterStory(primaryTrigger.char, primaryTrigger.intro, primaryTrigger.hook, 'video_end_screen');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
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

  // For episode 1, don't show the chat redirect UI - path choice modal will be shown instead
  if (episode.id === 1 && onShowPathChoice) {
    return null; // Don't render the end screen UI for episode 1
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
        {episode.triggers.map((t: any, idx: number) => (
          <ChatWidget
            key={idx}
            characterName={t.char}
            avatar={series.avatars[t.char]}
            onClick={() => handleManualChat(t)}
            isOnline={true}
          />
        ))}
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

/**
 * REEL ENGINE UI/UX
 */
const ReelItem: React.FC<{ 
  episode: any, 
  series: any,
  isActive: boolean,
  isMuted: boolean,
  toggleMute: () => void,
  onEnterStory: (char: string, intro: string, hook: string, entryPoint: string) => void,
  onNextEpisode: () => void,
  isChatOpen?: boolean;
  onShowPathChoice?: () => void;
}> = ({ episode, series, isActive, isMuted, toggleMute, onEnterStory, onNextEpisode, isChatOpen = false, onShowPathChoice }) => {
  console.log('[ReelItem] Component rendering - isActive:', isActive, 'episode:', episode?.label);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isUIHidden, setIsUIHidden] = useState(false);
  const lastEpisodeIdRef = useRef<string | number | null>(null);
  
  // Debug: Log on every render
  useEffect(() => {
    console.log('[ReelItem] Component mounted/updated - isActive:', isActive, 'isEnded:', isEnded);
  });

  // iOS fix: Set webkit-playsinline attribute for older iOS versions
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('playsinline', 'true');
    }
  }, []);

  // Cleanup: Ensure video is paused and muted when component unmounts
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.muted = true;
      }
    };
  }, []);
  
  // Analytics tracking refs
  const analyticsRecordId = useRef<string | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityHandlerRef = useRef<((event?: Event) => void) | null>(null);
  const mouseMoveHandlerRef = useRef<((event?: Event) => void) | null>(null);
  const lastMouseMoveTimeRef = useRef<number>(0);
  const trackVideoStartPromise = useRef<Promise<string | null> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekCountRef = useRef(0);
  const pauseCountRef = useRef(0);
  const wasUnmutedRef = useRef(false);
  const initialMutedRef = useRef(isMuted);
  const isEndingSession = useRef(false); // Prevent duplicate end calls
  const sessionStartTime = useRef<number | null>(null); // Track when session started
  
  // Swipe gesture detection refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const minSwipeDistance = 30; // Minimum distance in pixels to consider it a swipe
  const maxSwipeTime = 300; // Maximum time in ms to consider it a swipe

  // Track when unmuted during watch
  useEffect(() => {
    if (!isMuted && initialMutedRef.current) {
      wasUnmutedRef.current = true;
    }
  }, [isMuted]);

  // Debug: Log UI hidden state changes
  useEffect(() => {
    console.log('[Inactivity] UI Hidden state changed:', isUIHidden);
  }, [isUIHidden]);

  // Inactivity detection - hide UI after 5 seconds of inactivity
  useEffect(() => {
    console.log('[Inactivity] Effect running - isActive:', isActive, 'isEnded:', isEnded);
    
    if (!isActive || isEnded) {
      // Reset UI visibility when not active or video ended
      console.log('[Inactivity] Video not active or ended, resetting UI visibility');
      setIsUIHidden(false);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const resetInactivityTimer = () => {
      console.log('[Inactivity] Resetting timer - showing UI');
      // Show UI immediately on activity
      setIsUIHidden(false);
      
      // Clear existing timer
      if (inactivityTimerRef.current) {
        console.log('[Inactivity] Clearing existing timer');
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      
      // Set new timer to hide UI after 5 seconds
      console.log('[Inactivity] Setting new timer for 5 seconds');
      inactivityTimerRef.current = setTimeout(() => {
        console.log('[Inactivity] Timer fired - hiding UI');
        setIsUIHidden(true);
      }, 5000);
    };

    // Event handlers for user activity
    const handleActivity = (event?: Event) => {
      console.log('[Inactivity] Activity detected:', event?.type || 'unknown');
      resetInactivityTimer();
    };
    
    // Throttled handler for mouse movements - only reset timer once per second
    const handleMouseMove = (event?: Event) => {
      const now = Date.now();
      // Only reset if it's been at least 1 second since last mouse move reset
      if (now - lastMouseMoveTimeRef.current >= 1000) {
        console.log('[Inactivity] Mouse movement detected (throttled)');
        lastMouseMoveTimeRef.current = now;
        resetInactivityTimer();
      }
    };
    
    // Store handlers in refs for cleanup
    activityHandlerRef.current = handleActivity;
    mouseMoveHandlerRef.current = handleMouseMove;

    // Wait a bit for refs to be ready, then setup
    const setupTimeout = setTimeout(() => {
      const container = containerRef.current;
      const video = videoRef.current;
      
      console.log('[Inactivity] Refs check - container:', !!container, 'video:', !!video);
      console.log('[Inactivity] Container element:', container);
      console.log('[Inactivity] Video element:', video);
      
      if (!container || !video) {
        console.log('[Inactivity] Refs not ready after timeout');
        return;
      }
      
      console.log('[Inactivity] Setting up inactivity detection');
      
      // Initial timer setup
      console.log('[Inactivity] Setting up initial timer');
      resetInactivityTimer();

      // Add event listeners to container and video
      console.log('[Inactivity] Attaching event listeners');
      const handler = activityHandlerRef.current;
      const mouseMoveHandler = mouseMoveHandlerRef.current;
      if (handler && mouseMoveHandler) {
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
        console.log('[Inactivity] Event listeners attached');
      }
    }, 500);

    return () => {
      console.log('[Inactivity] Cleanup - clearing timers');
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

  // Helper function to end video session
  const endVideoSession = async (isCompleted: boolean = false) => {
    // Prevent duplicate calls
    if (isEndingSession.current) {
      console.log('[Video Analytics] Already ending session, skipping duplicate call');
      return;
    }
    
    // If recordId is not set, wait for the trackVideoStart promise to complete
    if (!analyticsRecordId.current && trackVideoStartPromise.current) {
      console.log('[Video Analytics] Waiting for trackVideoStart to complete...');
      try {
        const recordId = await trackVideoStartPromise.current;
        if (recordId) {
          analyticsRecordId.current = recordId;
          console.log('[Video Analytics] Got recordId from promise:', recordId);
        }
      } catch (error) {
        console.error('[Video Analytics] Error waiting for trackVideoStart:', error);
      }
    }
    
    if (!analyticsRecordId.current) {
      console.warn('[Video Analytics] No recordId available, cannot end session');
      // Clear interval even if no recordId
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }
    
    // Prevent ending session too quickly (likely from React StrictMode double-invocation)
    if (sessionStartTime.current) {
      const sessionDuration = Date.now() - sessionStartTime.current;
      if (sessionDuration < 1000 && !isCompleted) { // Less than 1 second and not completed
        console.log('[Video Analytics] Session too short (' + sessionDuration + 'ms), skipping end (likely StrictMode double-invocation)');
        return;
      }
    }
    
    // Mark as ending to prevent duplicate calls
    isEndingSession.current = true;
    const recordIdToEnd = analyticsRecordId.current; // Store before clearing
    
    const video = videoRef.current;
    let currentTime = 0;
    let duration = 0;
    
    if (video) {
      currentTime = video.currentTime || 0;
      duration = video.duration || 0;
    } else {
      console.warn('[Video Analytics] No video element available, using default values');
    }
    
    console.log('[Video Analytics] Ending session:', {
      recordId: recordIdToEnd,
      currentTime,
      duration,
      isCompleted
    });
    
    // Call trackVideoEnd and only clear refs after it completes
    await trackVideoEnd(
      recordIdToEnd,
      currentTime,
      duration,
      isCompleted,
      wasUnmutedRef.current
    );
    
    // Clear refs only after successful end
    analyticsRecordId.current = null;
    trackVideoStartPromise.current = null;
    isEndingSession.current = false;
    
    // Clear interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Pause video when chat opens, resume when chat closes
  useEffect(() => {
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
    if (!video) return;
    
    if (isActive) {
      setIsEnded(false);
      
      // Only reset video position if this is a different episode
      const isNewEpisode = lastEpisodeIdRef.current !== episode.id;
      if (isNewEpisode) {
        video.currentTime = 0;
        lastEpisodeIdRef.current = episode.id;
      }
      
      video.preload = "auto";
      
      // iOS fix: Explicitly load the video when it becomes active
      // This is especially important for new episodes
      if (isNewEpisode || !video.readyState || video.readyState < 2) {
        video.load();
      }
      
      // Reset tracking state
      seekCountRef.current = 0;
      pauseCountRef.current = 0;
      wasUnmutedRef.current = false;
      initialMutedRef.current = isMuted;
      isEndingSession.current = false; // Reset ending flag
      sessionStartTime.current = null; // Reset session start time
      
      // Only start a new session if we don't already have one in progress
      if (!analyticsRecordId.current && !trackVideoStartPromise.current) {
        // Start analytics tracking - store the promise so cleanup can await it
        const startPromise = trackVideoStart({
          seriesId: series.id,
          seriesTitle: series.title,
          episodeId: episode.id,
          episodeLabel: episode.label,
          videoUrl: episode.url,
          entryPoint: 'discover_grid',
          isMuted: isMuted
        });
        
        trackVideoStartPromise.current = startPromise;
        
        startPromise.then(recordId => {
          if (recordId) {
            console.log('[Video Analytics] Session started, recordId:', recordId);
            analyticsRecordId.current = recordId;
            sessionStartTime.current = Date.now(); // Track when session actually started
          } else {
            console.warn('[Video Analytics] Failed to get recordId from trackVideoStart');
          }
        }).catch(error => {
          console.error('[Video Analytics] Error starting session:', error);
        });
      } else {
        console.log('[Video Analytics] Session already in progress, skipping duplicate start');
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

      // Handle page unload/visibility change
      const handleBeforeUnload = () => {
        endVideoSession(false);
      };
      
      const handleVisibilityChange = () => {
        if (document.hidden) {
          endVideoSession(false);
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        // Cleanup: end session if component is unmounting or effect is re-running
        // The isEndingSession flag will prevent duplicate calls if isActive is changing to false
        // (in which case the else branch will also try to call it)
        endVideoSession(false);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      
      // End tracking when scrolling away (isActive became false)
      endVideoSession(false);
      
      // Cleanup when inactive - just clear interval, don't call endVideoSession again
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

  // Track video end
  useEffect(() => {
    if (isEnded && analyticsRecordId.current && videoRef.current) {
      endVideoSession(true);
    }
  }, [isEnded]);

  // Auto-open chat after video ends if postAction.chat exists
  useEffect(() => {
    if (isEnded && isActive && episode?.postAction?.chat) {
      const chatConfig = episode.postAction.chat;
      const globalRules = getGlobalRules();
      const chatbotName = globalRules.chatbot.name || 'Chirag';
      
      // Small delay to ensure video end screen doesn't conflict
      const timer = setTimeout(() => {
        // Call onEnterStory which will trigger handleChatInit
        // handleChatInit will check episode.postAction.chat and set guided chat config
        onEnterStory(
          chatbotName,
          chatConfig.prompt || '',
          chatConfig.prompt || '',
          'video_end_auto'
        );
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isEnded, isActive, episode, onEnterStory]);

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

  // Debug: Log render state
  if (isActive && !isEnded) {
    console.log('[Inactivity] Render - isUIHidden:', isUIHidden, 'isActive:', isActive, 'isEnded:', isEnded);
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
          console.log('[Video] Ended - Episode:', episode.label);
          setIsEnded(true);
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
            <p className="text-white text-[12px] opacity-50 max-w-[200px] leading-tight mt-1">{series.reelHint || 'Chat with the characters'}</p>
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

            {episode.triggers.map((t: any, idx: number) => (
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
                    src={series.avatars[t.char]} 
                    name={t.char} 
                    theme="green"
                    size="w-12 h-12"
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

/**
 * SERIES CATALOG
 */
// Base series catalog - will be merged with JSON flow data
const BASE_SERIES_CATALOG = [
  {
    id: 'cricket-coaching',
    title: 'Cricket Coaching',
    tagline: 'Athlete Mindset',
    thumbnail: getSmartImageUrl("https://lh3.googleusercontent.com/d/1vnGIc3ILJuslfqS035KflVhNEemOiyif", "chirag_thumb_v1", 400, 400),
    accentColor: '#10b981',
    reelHint: 'Ask Coach Chirag about cricket fitness and skills',
    avatars: {
      Chirag: CHIRAG_AVATAR
    },
    episodes: [
      { 
        id: 1, 
        label: "Coaching Intro", 
        url: "https://rgmeakgorodicnqgrffu.supabase.co/storage/v1/object/public/inscene-videos/Chirag/Ep1%20Circcourse%20Intro_sv.mp4", 
        triggers: [
          { char: 'Chirag', intro: "Ready to dominate the pitch? Fitness is 70% of the game. What's holding you back?", hook: "Athlete coaching session focused on cricket performance and doubt clearing." }
        ],
        ctaMapping: {
          'shots': 2,
          'professional': 3
          // Other CTAs (speed, stamina) have no navigation until explicitly configured
        }
      },
      {
        id: 2,
        label: "Skill Hub Intro",
        url: "https://rgmeakgorodicnqgrffu.supabase.co/storage/v1/object/public/inscene-videos/Chirag/Ep4%20Skillhubintro.mp4",
        triggers: [
          { char: 'Chirag', intro: "Ready to dominate the pitch? Fitness is 70% of the game. What's holding you back?", hook: "Athlete coaching session focused on cricket performance and doubt clearing." }
        ],
        ctaMapping: {
          'coverDrive': 3
          // Other CTAs (pullShot, stepOut, cut) have no navigation until explicitly configured
        }
      },
      {
        id: 3,
        label: "Professional Cricket Journey",
        url: "https://rgmeakgorodicnqgrffu.supabase.co/storage/v1/object/public/inscene-videos/Chirag/Ep2%20Professionalcricket%20Ageselection.mp4",
        triggers: [
          { char: 'Chirag', intro: "Ready to dominate the pitch? Fitness is 70% of the game. What's holding you back?", hook: "Athlete coaching session focused on cricket performance and doubt clearing." }
        ],
        ctaMapping: {
          'mindset': 5
          // Application process CTA - navigation to be configured later
        }
      },
      {
        id: 4,
        label: "Skill Hub Intro",
        url: "https://rgmeakgorodicnqgrffu.supabase.co/storage/v1/object/public/inscene-videos/Chirag/Ep4%20Skillhubintro.mp4",
        triggers: [
          { char: 'Chirag', intro: "Ready to dominate the pitch? Fitness is 70% of the game. What's holding you back?", hook: "Athlete coaching session focused on cricket performance and doubt clearing." }
        ]
      },
      {
        id: 5,
        label: "Professional Cricket Mindset",
        url: "https://rgmeakgorodicnqgrffu.supabase.co/storage/v1/object/public/inscene-videos/Chirag/Ep3%20Professionalcricket%20Mindset.mp4",
        triggers: [
          { char: 'Chirag', intro: "Ready to dominate the pitch? Fitness is 70% of the game. What's holding you back?", hook: "Athlete coaching session focused on cricket performance and doubt clearing." }
        ]
      }
    ]
  }
];

// Merge JSON episode flow data into series catalog
// This preserves all existing episodes and adds/updates from JSON
function mergeSeriesCatalogWithFlow(baseCatalog: typeof BASE_SERIES_CATALOG) {
  const mergedCatalog = baseCatalog.map(series => {
    const mergedEpisodes = series.episodes.map(episode => {
      // Get string ID for this episode
      const stringId = getStringId(episode.id);
      if (!stringId) {
        // Episode not in JSON flow, return as-is
        return episode;
      }
      
      // Merge JSON config into existing episode
      return mergeEpisodeConfig(episode, stringId);
    });
    
    // Add any new episodes from JSON that don't exist in base catalog
    // (Episodes with IDs beyond the base catalog range)
    const allStringIds = getAllEpisodeIds();
    allStringIds.forEach(stringId => {
      const numericId = getNumericId(stringId);
      if (numericId && !mergedEpisodes.find(ep => ep.id === numericId)) {
        // Create new episode from JSON
        const newEpisode = mergeEpisodeConfig({
          id: numericId,
          label: '',
          url: '',
          triggers: [
            { char: 'Chirag', intro: "Ready to dominate the pitch? Fitness is 70% of the game. What's holding you back?", hook: "Athlete coaching session focused on cricket performance and doubt clearing." }
          ]
        }, stringId);
        mergedEpisodes.push(newEpisode);
      }
    });
    
    return {
      ...series,
      episodes: mergedEpisodes
    };
  });
  
  return mergedCatalog;
}

export const SERIES_CATALOG = mergeSeriesCatalogWithFlow(BASE_SERIES_CATALOG);

// Premium cream/off-white theme - Steve Jobs approved
const CREAM_BG = '#FAF9F6';
const SAGE_GREEN = '#4A7C59';
const SAGE_DARK = '#3D6549';
const SKY_BLUE = '#4A90A4';

interface ConversationHistoryEntry {
  messages: any[];
  character: string;
  avatar: string;
  lastUpdate: number | undefined;
  isTyping?: boolean;
}

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [selectedSeries, setSelectedSeries] = useState<any>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [chatData, setChatData] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'discover' | 'chats'>('discover');
  const [choiceModalData, setChoiceModalData] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [ctaNavigatedEpisodes, setCtaNavigatedEpisodes] = useState<Set<number>>(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitioningToEpisodeId, setTransitioningToEpisodeId] = useState<number | null>(null);
  const [previousEpisode, setPreviousEpisode] = useState<any>(null);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  
  // Video history stack to track playback order
  const [videoHistory, setVideoHistory] = useState<number[]>([]);
  const isNavigatingBackRef = useRef(false);
  
  const [conversations, setConversations] = useState<Record<string, ConversationHistoryEntry>>({});
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [unseenCounts, setUnseenCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isHeaderUIHidden, setIsHeaderUIHidden] = useState(false);
  const headerInactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerActivityHandlerRef = useRef<((event?: Event) => void) | null>(null);
  const headerMouseMoveHandlerRef = useRef<((event?: Event) => void) | null>(null);
  const lastHeaderMouseMoveTimeRef = useRef<number>(0);

  // Initialize series catalog for influencer mapping
  useEffect(() => {
    setSeriesCatalog(SERIES_CATALOG);
  }, []);

  // Reset CTA-navigated episodes when series changes
  useEffect(() => {
    if (!selectedSeries) {
      setCtaNavigatedEpisodes(new Set());
      setVideoHistory([]);
      isNavigatingBackRef.current = false;
    } else {
      // Initialize history with first episode if starting fresh
      const getFilteredEpisodes = (episodes: any[], seriesId: string, ctaEpisodes: Set<number>): any[] => {
        if (typeof window === 'undefined') return episodes;
        const storageKey = `inscene_path_choice_${seriesId}`;
        const choice = localStorage.getItem(storageKey);
        
        let filtered: any[] = [];
        
        if (!choice || (choice !== 'building' && choice !== 'exploring')) {
          filtered = episodes.filter((ep: any) => ep.id === 1);
        } else if (choice === 'building') {
          filtered = episodes.filter((ep: any) => [1, 2, 3, 4, 5].includes(ep.id));
        } else if (choice === 'exploring') {
          filtered = episodes.filter((ep: any) => [1, 3, 5].includes(ep.id));
        } else {
          filtered = episodes.filter((ep: any) => ep.id === 1);
        }
        
        ctaEpisodes.forEach(epId => {
          if (!filtered.find(ep => ep.id === epId)) {
            const episode = episodes.find((ep: any) => ep.id === epId);
            if (episode) {
              filtered.push(episode);
            }
          }
        });
        
        return filtered;
      };
      
      const filteredEpisodes = getFilteredEpisodes(selectedSeries.episodes, selectedSeries.id, ctaNavigatedEpisodes);
      if (filteredEpisodes.length > 0 && videoHistory.length === 0) {
        // Initialize history with the first episode in the filtered list
        const firstEpisodeId = filteredEpisodes[0].id;
        setVideoHistory([firstEpisodeId]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeries]);

  // Read URL query parameters to set the view
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'chats') {
      setCurrentView('chats');
    } else {
      setCurrentView('discover');
    }
  }, [searchParams]);

  // Track viewer on app load
  useEffect(() => {
    trackViewer();
    trackPageView({ viewType: 'app_open' });
  }, []);

  // Load chat histories when user logs in
  useEffect(() => {
    const loadSavedChats = async () => {
      if (isAuthenticated && user) {
        console.log('App: User logged in, loading saved chat histories...');
        const savedChats = await loadAllChatHistories();
        console.log('App: Loaded chat histories:', savedChats);
        
        if (savedChats.length > 0) {
          const newConversations: Record<string, ConversationHistoryEntry> = {};
          
          for (const chat of savedChats) {
            const charName = chat.characterName;
            newConversations[charName] = {
              character: charName,
              messages: chat.messages.map(m => ({
                role: m.role,
                content: m.content
              })),
              avatar: getCharacterAvatar(charName),
              lastUpdate: new Date(chat.lastMessageAt).getTime()
            };
          }
          
          setConversations(newConversations);
          console.log('App: Populated conversations:', newConversations);
        }
      }
    };
    
    loadSavedChats();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (selectedSeries) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setActiveIdx(index);
          }
        });
      }, { threshold: 0.6 });
      
      const timer = setTimeout(() => {
        document.querySelectorAll('.reel-item-wrapper').forEach(i => observer.observe(i));
      }, 200);
      
      return () => {
        clearTimeout(timer);
        observer.disconnect();
      };
    }
  }, [selectedSeries]);

  // Header inactivity detection - hide header UI after 5 seconds of inactivity
  useEffect(() => {
    if (!selectedSeries || chatData) {
      // Reset UI visibility when no series selected or chat is open
      setIsHeaderUIHidden(false);
      if (headerInactivityTimerRef.current) {
        clearTimeout(headerInactivityTimerRef.current);
        headerInactivityTimerRef.current = null;
      }
      return;
    }

    const resetHeaderInactivityTimer = () => {
      setIsHeaderUIHidden(false);
      
      if (headerInactivityTimerRef.current) {
        clearTimeout(headerInactivityTimerRef.current);
        headerInactivityTimerRef.current = null;
      }
      
      headerInactivityTimerRef.current = setTimeout(() => {
        setIsHeaderUIHidden(true);
      }, 5000);
    };

    const handleHeaderActivity = (event?: Event) => {
      resetHeaderInactivityTimer();
    };

    const handleHeaderMouseMove = (event?: Event) => {
      const now = Date.now();
      if (now - lastHeaderMouseMoveTimeRef.current >= 1000) {
        lastHeaderMouseMoveTimeRef.current = now;
        resetHeaderInactivityTimer();
      }
    };

    headerActivityHandlerRef.current = handleHeaderActivity;
    headerMouseMoveHandlerRef.current = handleHeaderMouseMove;

    const setupTimeout = setTimeout(() => {
      const container = document.querySelector('.reel-snap-container');
      
      if (!container) {
        return;
      }
      
      resetHeaderInactivityTimer();

      const handler = headerActivityHandlerRef.current;
      const mouseMoveHandler = headerMouseMoveHandlerRef.current;
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
      if (headerInactivityTimerRef.current) {
        clearTimeout(headerInactivityTimerRef.current);
        headerInactivityTimerRef.current = null;
      }
      
      const container = document.querySelector('.reel-snap-container');
      const handler = headerActivityHandlerRef.current;
      const mouseMoveHandler = headerMouseMoveHandlerRef.current;
      
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
  }, [selectedSeries, chatData]);

  // Helper function to handle chat initiation with authentication check
  const handleChatInit = async (chatDataConfig: any) => {
    if (!isAuthenticated) {
      // User not authenticated - show auth modal
      setIsAuthModalOpen(true);
      return;
    }
    
    // Check message count limit (skip for unlimited users)
    if (!hasUnlimitedMessages()) {
      const messageCount = await getUserMessageCount();
      if (messageCount >= MAX_USER_MESSAGES) {
        // User has reached message limit - show waitlist modal
        setIsWaitlistModalOpen(true);
        return;
      }
    }
    
    // Check if episode has postAction.chat config (from JSON flow)
    if (chatDataConfig.episodeId && selectedSeries) {
      const episode = selectedSeries.episodes.find((ep: any) => ep.id === chatDataConfig.episodeId);
      if (episode?.postAction?.chat) {
        chatDataConfig.isGuidedChat = true;
        chatDataConfig.guidedChatDuration = episode.postAction.chat.durationSeconds || 45;
      }
    }
    
    // Legacy: Check if this is a guided chat for Cover Drive (Episode 3)
    if (chatDataConfig.episodeId === 3 && chatDataConfig.episodeLabel === "Cover Drive" && !chatDataConfig.isGuidedChat) {
      chatDataConfig.isGuidedChat = true;
      chatDataConfig.guidedChatDuration = 45;
    }
    
    // User is authenticated and under limit - proceed with chat
    setChatData(chatDataConfig);
  };

  const handleNext = () => {
    if (!selectedSeries) return;
    
    // Get current episode
    const getFilteredEpisodes = (episodes: any[], seriesId: string, ctaEpisodes: Set<number>): any[] => {
      if (typeof window === 'undefined') return episodes;
      const storageKey = `inscene_path_choice_${seriesId}`;
      const choice = localStorage.getItem(storageKey);
      
      let filtered: any[] = [];
      
      if (!choice || (choice !== 'building' && choice !== 'exploring')) {
        filtered = episodes.filter((ep: any) => ep.id === 1);
      } else if (choice === 'building') {
        filtered = episodes.filter((ep: any) => [1, 2, 3, 4, 5].includes(ep.id));
      } else if (choice === 'exploring') {
        filtered = episodes.filter((ep: any) => [1, 3, 5].includes(ep.id));
      } else {
        filtered = episodes.filter((ep: any) => ep.id === 1);
      }
      
      ctaEpisodes.forEach(epId => {
        if (!filtered.find(ep => ep.id === epId)) {
          const episode = episodes.find((ep: any) => ep.id === epId);
          if (episode) {
            filtered.push(episode);
          }
        }
      });
      
      return filtered;
    };
    
    const filteredEpisodes = getFilteredEpisodes(selectedSeries.episodes, selectedSeries.id, ctaNavigatedEpisodes);
    const currentEpisode = filteredEpisodes[activeIdx] || filteredEpisodes[0];
    
    // Sequence enforcement: If current episode is part of a sequence, only allow next in sequence
    // Exception: ep3 requires CTA-only progression, so skip auto-progression
    if (currentEpisode && isSequenceEpisode(currentEpisode)) {
      // Skip auto-progression for ep3 and its steps (requires CTA-only progression)
      if (isEp3OrStep(currentEpisode)) {
        console.log('[handleNext] Ep3 requires CTA-only progression, skipping auto-progression');
        return;
      }
      
      const nextInSequence = getNextInSequence(currentEpisode);
      if (nextInSequence) {
        const nextNumericId = getNumericId(nextInSequence);
        if (nextNumericId) {
          handleNavigateToEpisode(nextNumericId);
          return;
        }
      } else {
        // End of sequence, don't allow next
        console.log('[handleNext] End of sequence reached');
        return;
      }
    }
    
    // Normal navigation for non-sequence episodes
    const nextIdx = (activeIdx + 1) % filteredEpisodes.length;
    const nextEl = document.querySelector(`[data-index="${nextIdx}"]`);
    if (nextEl) {
      nextEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavigateToEpisode = (episodeId: number, isBackNavigation: boolean = false) => {
    if (!selectedSeries) return;
    
    // Validate episode ID
    if (episodeId === undefined || episodeId === null || typeof episodeId !== 'number' || isNaN(episodeId)) {
      console.warn('[handleNavigateToEpisode] Invalid episode ID:', episodeId);
      return;
    }
    
    // Verify the episode exists in the series
    const targetEpisode = selectedSeries.episodes.find((ep: any) => ep.id === episodeId);
    if (!targetEpisode) {
      console.warn('[handleNavigateToEpisode] Episode not found:', episodeId);
      return;
    }

    // Filter episodes based on path choice (same logic as in render, but including CTA-navigated episodes)
    const getFilteredEpisodes = (episodes: any[], seriesId: string, ctaEpisodes: Set<number>): any[] => {
      if (typeof window === 'undefined') return episodes;
      const storageKey = `inscene_path_choice_${seriesId}`;
      const choice = localStorage.getItem(storageKey);
      
      let filtered: any[] = [];
      
      if (!choice || (choice !== 'building' && choice !== 'exploring')) {
        filtered = episodes.filter((ep: any) => ep.id === 1);
      } else if (choice === 'building') {
        filtered = episodes.filter((ep: any) => [1, 2, 3, 4, 5].includes(ep.id));
      } else if (choice === 'exploring') {
        filtered = episodes.filter((ep: any) => [1, 3, 5].includes(ep.id));
      } else {
        filtered = episodes.filter((ep: any) => ep.id === 1);
      }
      
      // Add CTA-navigated episodes that aren't already in the filtered list
      ctaEpisodes.forEach(epId => {
        if (!filtered.find(ep => ep.id === epId)) {
          const episode = episodes.find((ep: any) => ep.id === epId);
          if (episode) {
            filtered.push(episode);
          }
        }
      });
      
      return filtered;
    };
    
    // Get current episode before transition
    const currentFilteredEpisodes = getFilteredEpisodes(selectedSeries.episodes, selectedSeries.id, ctaNavigatedEpisodes);
    const currentEpisode = currentFilteredEpisodes[activeIdx] || currentFilteredEpisodes[0];
    
    // Update video history based on navigation direction
    if (isBackNavigation) {
      // When going back, we're popping from history (already handled by caller)
      isNavigatingBackRef.current = true;
    } else {
      // When going forward, add current episode to history if it's not already the last one
      setVideoHistory(prev => {
        const lastEpisode = prev[prev.length - 1];
        if (lastEpisode !== currentEpisode?.id && currentEpisode?.id) {
          // Remove any future history if we're navigating forward from a back position
          // This implements browser-like back/forward behavior
          const currentIndex = prev.indexOf(currentEpisode.id);
          if (currentIndex !== -1) {
            // We're navigating forward from a point in history, remove everything after
            return prev.slice(0, currentIndex + 1).concat(episodeId);
          } else {
            // Normal forward navigation, just add to history
            return [...prev, episodeId];
          }
        } else {
          // Current episode is already last in history, just update if needed
          if (lastEpisode !== episodeId) {
            return [...prev, episodeId];
          }
          return prev;
        }
      });
      isNavigatingBackRef.current = false;
    }
    
    // Sequence enforcement: Check if current episode is part of a sequence
    if (currentEpisode && isSequenceEpisode(currentEpisode)) {
      const targetStringId = getStringId(episodeId);
      if (targetStringId && !isValidSequenceTarget(currentEpisode, targetStringId)) {
        console.warn('[handleNavigateToEpisode] Cannot skip sequence steps. Current:', currentEpisode.id, 'Target:', episodeId);
        // Allow navigation only to next in sequence
        const nextInSequence = getNextInSequence(currentEpisode);
        if (nextInSequence) {
          const nextNumericId = getNumericId(nextInSequence);
          if (nextNumericId) {
            episodeId = nextNumericId;
            // Update targetEpisode to the next in sequence
            const updatedTarget = selectedSeries.episodes.find((ep: any) => ep.id === episodeId);
            if (updatedTarget) {
              // Continue with next in sequence
            } else {
              console.warn('[handleNavigateToEpisode] Next in sequence not found:', nextInSequence);
              return;
            }
          }
        } else {
          console.warn('[handleNavigateToEpisode] No next episode in sequence');
          return;
        }
      }
    }
    
    // Add episode to CTA-navigated set so it's included in filtered list
    const newCtaSet = new Set(ctaNavigatedEpisodes).add(episodeId);
    setCtaNavigatedEpisodes(newCtaSet);
    
    // Get filtered episodes with new CTA episode included
    const filteredEpisodes = getFilteredEpisodes(selectedSeries.episodes, selectedSeries.id, newCtaSet);
    const targetIndex = filteredEpisodes.findIndex((ep: any) => ep.id === episodeId);
    
    if (targetIndex === -1) {
      console.warn('[handleNavigateToEpisode] Target episode not found in filtered list:', episodeId);
      return;
    }
    
    // Determine transition direction: backward if going to lower index or back navigation, forward if going to higher index
    const isBackward = targetIndex < activeIdx || isBackNavigation;
    setTransitionDirection(isBackward ? 'backward' : 'forward');
    
    // Preload the target video to prevent blanks (targetEpisode already declared above)
    const preloadVideo = document.createElement('video');
    preloadVideo.src = targetEpisode.url;
    preloadVideo.preload = 'auto';
    preloadVideo.muted = true;
    preloadVideo.load();
    // Clean up preload element after a delay
    setTimeout(() => {
      preloadVideo.src = '';
      preloadVideo.load();
    }, 2000);
    
    // Start transition: store previous episode and set transition state
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1518',message:'Transition starting',data:{currentEpisodeId:currentEpisode?.id,targetEpisodeId:episodeId,isMuted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion
    // Aggressively stop all videos on the page before starting transition to prevent double audio
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach((video) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1523',message:'Stopping video before transition',data:{paused:video.paused,muted:video.muted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Aggressively stop the video: pause, mute, reset position
      // Don't call load() as it causes reload and blinking
      video.pause();
      video.muted = true;
      video.currentTime = 0;
    });
    setPreviousEpisode(currentEpisode);
    setIsTransitioning(true);
    setTransitioningToEpisodeId(episodeId);
    
    // After animation completes (550ms), update activeIdx and clear transition state
    setTimeout(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1527',message:'Transition ending',data:{targetIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion
      // Before updating state, ensure all videos are stopped except the new active one
      // Use requestAnimationFrame to ensure smooth transition without blink
      requestAnimationFrame(() => {
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach((video, index) => {
          // Stop all videos - the new active one will be started by its useEffect
          video.pause();
          video.muted = true;
        });
        // Update state in next frame to prevent double render
        requestAnimationFrame(() => {
          setActiveIdx(targetIndex);
          setIsTransitioning(false);
          setTransitioningToEpisodeId(null);
          setPreviousEpisode(null);
        });
      });
    }, 550);
  };

  // Handle back navigation using video history
  const handleNavigateBack = () => {
    if (!selectedSeries || videoHistory.length <= 1) return;
    
    // Get the previous episode from history (second to last, since last is current)
    const previousEpisodeId = videoHistory[videoHistory.length - 2];
    if (!previousEpisodeId) return;
    
    // Remove current episode from history (pop it)
    setVideoHistory(prev => prev.slice(0, -1));
    
    // Navigate to previous episode
    handleNavigateToEpisode(previousEpisodeId, true);
  };

  const handleChatUpdate = (char: string, messages: any[]) => {
    setConversations(prev => {
      const existingConversation = prev[char];
      const existingMessages = existingConversation?.messages || [];
      const existingMessageCount = existingMessages.length;
      const newMessageCount = messages.length;
      
      // Preserve existing lastUpdate by default - NEVER update it unless new messages are added
      let lastUpdate = existingConversation?.lastUpdate;
      
      // Special case: If conversation exists with a lastUpdate but no messages in state,
      // and we're loading many messages, this is likely an initial load from database.
      // Preserve the existing lastUpdate instead of updating it.
      const isInitialLoad = existingMessageCount === 0 && newMessageCount > 0 && lastUpdate !== undefined;
      
      if (isInitialLoad) {
        // This is an initial load of existing messages - preserve the timestamp from the conversation entry
        console.log('[App] Initial load detected for', char, 'preserving existing timestamp. Messages:', newMessageCount, 'lastUpdate:', lastUpdate, 'timestamp:', lastUpdate ? new Date(lastUpdate).toLocaleString() : 'none');
      } else if (newMessageCount > existingMessageCount && !isInitialLoad) {
        // New message was added - update timestamp based on last message
        const newLastMessage = messages[messages.length - 1];
        console.log('[App] New message detected, updating timestamp for', char, 'new count:', newMessageCount, 'old count:', existingMessageCount);
        if (newLastMessage?.sent_at) {
          // Message has sent_at timestamp from database
          lastUpdate = new Date(newLastMessage.sent_at).getTime();
        } else {
          // For real-time messages without sent_at, use current time
          lastUpdate = Date.now();
        }
      } else if (!lastUpdate && messages.length > 0 && existingMessageCount === 0) {
        // First time creating conversation (no existing messages, no lastUpdate) - set initial timestamp from last message
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.sent_at) {
          lastUpdate = new Date(lastMessage.sent_at).getTime();
        } else {
          lastUpdate = Date.now();
        }
      } else {
        // Message count didn't increase - preserve existing lastUpdate
        // This handles the case where chat is opened/closed without new messages
        // DO NOT update lastUpdate - keep the existing value
        console.log('[App] No new messages for', char, 'preserving timestamp. Count:', newMessageCount, 'existing:', existingMessageCount, 'lastUpdate:', lastUpdate, 'timestamp:', lastUpdate ? new Date(lastUpdate).toLocaleString() : 'none');
      }
      
      return {
        ...prev,
        [char]: {
          ...prev[char],
          character: char,
          messages: messages,
          avatar: prev[char]?.avatar || CHIRAG_AVATAR,
          lastUpdate: lastUpdate !== undefined ? lastUpdate : (existingConversation?.lastUpdate || Date.now())
        }
      };
    });
  };

  // Clear typing status and track unseen messages when a new assistant message arrives
  const prevMessagesRef = useRef<Record<string, any[]>>({});
  useEffect(() => {
    Object.keys(conversations).forEach(char => {
      const currentMessages = conversations[char]?.messages || [];
      const prevMessages = prevMessagesRef.current[char] || [];
      const lastMessage = currentMessages[currentMessages.length - 1];
      const prevLastMessage = prevMessages[prevMessages.length - 1];
      
      // Check if a new assistant message was added
      if (lastMessage && lastMessage.role === 'assistant' && 
          (!prevLastMessage || prevLastMessage.content !== lastMessage.content)) {
        // Clear typing status if currently typing
        if (typingStatus[char]) {
          console.log('[App] New assistant message arrived, clearing typing status for', char);
          setTypingStatus(prev => ({
            ...prev,
            [char]: false
          }));
        }
        
        // Increment unseen count if chat is not currently open
        if (!chatData || chatData.char !== char) {
          console.log('[App] New assistant message, incrementing unseen count for', char);
          setUnseenCounts(prev => ({
            ...prev,
            [char]: (prev[char] || 0) + 1
          }));
        }
      }
      
      prevMessagesRef.current[char] = currentMessages;
    });
  }, [conversations, typingStatus, chatData]);

  const handleTypingStatusChange = (char: string, isTyping: boolean) => {
    console.log('[App] Typing status change:', char, isTyping);
    setTypingStatus(prev => ({
      ...prev,
      [char]: isTyping
    }));
  };

  return (
    <div className="flex flex-col min-h-[100dvh] h-[100dvh] overflow-hidden" style={{ background: CREAM_BG, color: '#1A1A1A' }}>
      <header className={`fixed top-0 left-0 right-0 z-[1000] px-6 py-4 transition-all duration-500 ${selectedSeries ? 'hidden' : 'bg-[#FAF9F6] border-b border-black/[0.06]'} ${currentView === 'chats' ? 'hidden' : ''}`}>
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          {selectedSeries ? (
            <>
              <div className="flex items-center gap-3">
                {(() => {
                  // Get the first character name from avatars to use as creatorId
                  const creatorName = selectedSeries.avatars ? Object.keys(selectedSeries.avatars)[0] : null;
                  const creatorAvatar = creatorName ? selectedSeries.avatars[creatorName] : undefined;
                  
                  return (
                    <HamburgerMenu>
                      {creatorName ? (
                        <LeaderboardDrawer
                          creatorId={creatorName}
                          creatorName={creatorName}
                          creatorAvatar={creatorAvatar}
                        />
                      ) : (
                        <div className="p-6">
                          <p className="text-[#8A8A8A] text-sm">No leaderboard available</p>
                        </div>
                      )}
                    </HamburgerMenu>
                  );
                })()}
                <div 
                  className={`flex items-center gap-3 cursor-pointer group active:scale-[0.98] transition-all duration-500 ${isHeaderUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
                  onClick={() => { 
                    setIsHeaderUIHidden(false);
                    if (headerInactivityTimerRef.current) {
                      clearTimeout(headerInactivityTimerRef.current);
                      headerInactivityTimerRef.current = setTimeout(() => {
                        setIsHeaderUIHidden(true);
                      }, 5000);
                    }
                    setSelectedSeries(null); 
                    setChatData(null); 
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                    <Logo size={22} isPulsing={false} />
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-2 transition-opacity duration-500 ${isHeaderUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <UserMenu onSignInClick={() => setIsAuthModalOpen(true)} />
                <button 
                  onClick={() => {
                    setIsHeaderUIHidden(false);
                    if (headerInactivityTimerRef.current) {
                      clearTimeout(headerInactivityTimerRef.current);
                      headerInactivityTimerRef.current = setTimeout(() => {
                        setIsHeaderUIHidden(true);
                      }, 5000);
                    }
                    setSelectedSeries(null);
                  }} 
                  className="w-9 h-9 rounded-xl bg-white/80 backdrop-blur-sm border border-black/[0.08] flex items-center justify-center active:scale-95 hover:bg-white transition-all shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#4A4A4A]"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1" />
              <div className="flex flex-col items-center">
                <Logo size={32} isPulsing={false} src="/icon_purple.png" />
              </div>
              <div className="flex-1 flex justify-end">
                <UserMenu onSignInClick={() => setIsAuthModalOpen(true)} />
              </div>
            </>
          )}
        </div>
      </header>

      {!selectedSeries && (
        <main className={`flex-1 overflow-y-auto hide-scrollbar ${currentView === 'chats' ? 'pt-0 pb-20' : 'pt-24 pb-28 px-6 animate-slide-up'}`}>
          {currentView === 'discover' ? (
            <div className="flex flex-col gap-8 max-w-lg mx-auto">
              {/* Greeting for logged in users */}
              {isAuthenticated && user && (
                <div className="pt-2">
                  <h1 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight">
                    Welcome <span className="text-[#4A7C59]">{user.given_name || user.name?.split(' ')[0] || 'there'}</span> 👋
                  </h1>
                </div>
              )}

              {/* Influencer Cards Section - Minimal Elegance */}
              <div className="pt-2">
                  <h2 className="text-[13px] font-semibold tracking-wide text-[#8A8A8A] mb-5">
                    Featured
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {getAllInfluencers().map((influencer: InfluencerInfo, idx: number) => {
                      // Find the series for this influencer
                      const influencerSeries = SERIES_CATALOG.find((s: any) => 
                        s.avatars && s.avatars[influencer.name]
                      );
                      
                      return (
                      <div
                        key={influencer.id}
                        onClick={() => {
                          // Directly start episode 1 if series found
                          if (influencerSeries) {
                            setSelectedSeries(influencerSeries);
                            setActiveIdx(0);
                          } else {
                            // Fallback to navigation if series not found
                            navigate(`/${influencer.id}`);
                          }
                        }}
                        className="group cursor-pointer relative aspect-[3/4] rounded-2xl overflow-hidden bg-white border border-black/[0.06] shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]"
                        style={{ animationDelay: `${idx * 80}ms` }}
                      >
                        <img 
                          src={influencer.avatar} 
                          alt={influencer.name} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-[15px] font-semibold text-white mb-0.5 tracking-tight">{influencer.name}</h3>
                          <p className="text-[12px] font-medium text-white/60 line-clamp-1">{influencer.seriesTitle}</p>
                        </div>
                        {/* Play button on hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/10">
                          <div className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#1A1A1A] ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col h-full bg-[#FAF9F6] relative">
              {/* Minimal Chat Header */}
              <div className="bg-[#FAF9F6] pt-10 px-6 pb-4 border-b border-black/[0.06]">
                <div className="flex items-center justify-between">
                  {isSearchActive ? (
                    <div className="flex-1 flex items-center gap-3 mr-4">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        autoFocus
                        className="flex-1 bg-white border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1A1A] placeholder:text-[#ACACAC] focus:outline-none focus:border-[#4A7C59] text-sm font-medium shadow-sm"
                      />
                      <button
                        onClick={() => {
                          setIsSearchActive(false);
                          setSearchQuery('');
                        }}
                        className="p-2 hover:bg-black/[0.04] rounded-lg transition-colors"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-[#8A8A8A]"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-xl font-semibold text-[#1A1A1A] tracking-tight">
                        Messages
                      </h1>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setIsSearchActive(true)}
                          className="p-2 hover:bg-black/[0.04] rounded-lg transition-colors"
                        >
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-[#8A8A8A]"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Chat List Area */}
              <div className="flex-1 overflow-y-auto pt-1 bg-[#FAF9F6]">
                {(() => {
                  // Get all characters and merge with existing conversations
                  const allCharacterNames = getAllCharacterNames();
                  const allConversations: ConversationHistoryEntry[] = allCharacterNames.map(charName => {
                    const existingConv = conversations[charName];
                    const characterProfile = CHARACTER_PROFILES[charName];
                    
                    if (existingConv) {
                      return existingConv;
                    }
                    
                    // Create default entry for characters without conversations
                    return {
                      character: charName,
                      messages: [],
                      avatar: characterProfile?.avatar || getCharacterAvatar(charName),
                      lastUpdate: undefined,
                      isTyping: false
                    };
                  });
                  
                  // Filter by search query
                  const filteredConversations = allConversations.filter((conv) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      conv.character.toLowerCase().includes(query) ||
                      conv.messages.some(msg => msg.content.toLowerCase().includes(query))
                    );
                  })
                  // Sort: conversations with messages first (by lastUpdate), then empty conversations alphabetically
                  .sort((a, b) => {
                    if (a.messages.length > 0 && b.messages.length === 0) return -1;
                    if (a.messages.length === 0 && b.messages.length > 0) return 1;
                    if (a.messages.length > 0 && b.messages.length > 0) {
                      return (b.lastUpdate || 0) - (a.lastUpdate || 0);
                    }
                    return a.character.localeCompare(b.character);
                  });
                  
                  if (searchQuery.trim() && filteredConversations.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                        <p className="text-[15px] font-medium text-[#8A8A8A]">No results found</p>
                      </div>
                    );
                  }
                  
                  return filteredConversations.map((conv, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          // Clear unseen count when opening chat
                          setUnseenCounts(prev => ({
                            ...prev,
                            [conv.character]: 0
                          }));
                          handleChatInit({ 
                            char: conv.character, 
                            avatar: conv.avatar, 
                            history: conv.messages.length > 0 ? conv.messages : undefined,
                            isFromHistory: conv.messages.length > 0,
                            isWhatsApp: true,
                            entryPoint: 'chat_history'
                          });
                        }}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-black/[0.02] active:bg-black/[0.04] transition-all cursor-pointer"
                      >
                        <div className="relative w-[52px] h-[52px] rounded-full bg-[#F5F3EE]">
                           <div className="w-full h-full rounded-full overflow-hidden">
                             <img src={conv.avatar} alt={conv.character} className="w-full h-full object-cover" />
                           </div>
                           {/* Online dot */}
                           <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#4A7C59] border-2 border-[#FAF9F6] z-10" />
                        </div>
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h4 className="text-[15px] font-semibold text-[#1A1A1A] leading-tight truncate tracking-tight">{conv.character}</h4>
                            <span className="text-[11px] font-medium text-[#ACACAC] whitespace-nowrap ml-2">
                              {conv.lastUpdate ? new Date(conv.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-[13px] text-[#8A8A8A] truncate pr-4 leading-snug">
                              {typingStatus[conv.character] 
                                ? 'typing...' 
                                : (conv.messages.length > 0 
                                  ? conv.messages[conv.messages.length - 1]?.content 
                                  : 'Start a conversation')}
                            </p>
                            {unseenCounts[conv.character] > 0 && (
                              <div className="bg-[#4A7C59] text-white rounded-full min-w-[20px] h-[20px] flex items-center justify-center text-[11px] font-semibold px-1.5">
                                {unseenCounts[conv.character]}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}
        </main>
      )}

      {selectedSeries && (() => {
        // Filter episodes based on path choice (including CTA-navigated episodes)
        const getFilteredEpisodes = (episodes: any[], seriesId: string, ctaEpisodes: Set<number>): any[] => {
          if (typeof window === 'undefined') return episodes;
          const storageKey = `inscene_path_choice_${seriesId}`;
          const choice = localStorage.getItem(storageKey);
          
          let filtered: any[] = [];
          
          // If no path choice made yet, only show episode 1
          if (!choice || (choice !== 'building' && choice !== 'exploring')) {
            filtered = episodes.filter((ep: any) => ep.id === 1);
          } else if (choice === 'building') {
            // If building path: show episodes 1, 2, 3, 4, 5
            filtered = episodes.filter((ep: any) => [1, 2, 3, 4, 5].includes(ep.id));
          } else if (choice === 'exploring') {
            // If exploring path: show episodes 1, 3, 5
            filtered = episodes.filter((ep: any) => [1, 3, 5].includes(ep.id));
          } else {
            filtered = episodes.filter((ep: any) => ep.id === 1);
          }
          
          // Add CTA-navigated episodes that aren't already in the filtered list
          ctaEpisodes.forEach(epId => {
            if (!filtered.find(ep => ep.id === epId)) {
              const episode = episodes.find((ep: any) => ep.id === epId);
              if (episode) {
                filtered.push(episode);
              }
            }
          });
          
          return filtered;
        };
        
        const filteredEpisodes = getFilteredEpisodes(selectedSeries.episodes, selectedSeries.id, ctaNavigatedEpisodes);
        const currentEpisode = filteredEpisodes[activeIdx] || filteredEpisodes[0];
        
        if (!currentEpisode) return null;
        
        // During transition, render both old and new videos
        if (isTransitioning && previousEpisode && transitioningToEpisodeId) {
          const targetEpisode = selectedSeries.episodes.find((ep: any) => ep.id === transitioningToEpisodeId);
          
          if (!targetEpisode) {
            // Fallback to normal rendering if target episode not found
            return (
              <EpisodeView
                episode={currentEpisode}
                series={selectedSeries}
                isMuted={isMuted}
                toggleMute={() => setIsMuted(!isMuted)}
                onEnterStory={(char, intro, hook, entryPoint) => handleChatInit({
                  char, intro, hook, 
                  isFromHistory: false, 
                  isWhatsApp: false,
                  entryPoint,
                  seriesId: selectedSeries.id,
                  seriesTitle: selectedSeries.title,
                  episodeId: currentEpisode.id,
                  episodeLabel: currentEpisode.label
                })}
                onNextEpisode={handleNext}
                onExit={() => {
                  setSelectedSeries(null);
                  setChatData(null);
                }}
                onNavigateToEpisode={handleNavigateToEpisode}
                onNavigateBack={handleNavigateBack}
                isChatOpen={!!chatData}
                currentIndex={activeIdx}
                ctaNavigatedEpisodes={ctaNavigatedEpisodes}
                videoHistory={videoHistory}
              />
            );
          }
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:2005',message:'Rendering dual videos during transition',data:{previousEpisodeId:previousEpisode.id,targetEpisodeId:targetEpisode.id,isMuted,transitionDirection},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
          // #endregion
          return (
            <div className="fixed inset-0 bg-black z-[500] overflow-hidden">
              {/* Old video - sliding out based on direction */}
              <EpisodeView
                episode={previousEpisode}
                series={selectedSeries}
                isMuted={true}
                toggleMute={() => setIsMuted(!isMuted)}
                onEnterStory={(char, intro, hook, entryPoint) => handleChatInit({
                  char, intro, hook, 
                  isFromHistory: false, 
                  isWhatsApp: false,
                  entryPoint,
                  seriesId: selectedSeries.id,
                  seriesTitle: selectedSeries.title,
                  episodeId: previousEpisode.id,
                  episodeLabel: previousEpisode.label
                })}
                onNextEpisode={handleNext}
                onExit={() => {
                  setSelectedSeries(null);
                  setChatData(null);
                }}
                onNavigateToEpisode={handleNavigateToEpisode}
                onNavigateBack={handleNavigateBack}
                isChatOpen={!!chatData}
                containerClassName={transitionDirection === 'backward' ? 'video-transition-out-down' : 'video-transition-out'}
                preventAutoplay={true}
                currentIndex={activeIdx}
                ctaNavigatedEpisodes={ctaNavigatedEpisodes}
                videoHistory={videoHistory}
              />
              {/* New video - sliding in based on direction */}
              <EpisodeView
                episode={targetEpisode}
                series={selectedSeries}
                isMuted={isMuted}
                toggleMute={() => setIsMuted(!isMuted)}
                onEnterStory={(char, intro, hook, entryPoint) => handleChatInit({
                  char, intro, hook, 
                  isFromHistory: false, 
                  isWhatsApp: false,
                  entryPoint,
                  seriesId: selectedSeries.id,
                  seriesTitle: selectedSeries.title,
                  episodeId: targetEpisode.id,
                  episodeLabel: targetEpisode.label
                })}
                onNextEpisode={handleNext}
                onExit={() => {
                  setSelectedSeries(null);
                  setChatData(null);
                }}
                onNavigateToEpisode={handleNavigateToEpisode}
                onNavigateBack={handleNavigateBack}
                isChatOpen={!!chatData}
                containerClassName={transitionDirection === 'backward' ? 'video-transition-in-up' : 'video-transition-in'}
                preventAutoplay={true}
                currentIndex={activeIdx}
                ctaNavigatedEpisodes={ctaNavigatedEpisodes}
                videoHistory={videoHistory}
              />
            </div>
          );
        }
        
        // Normal rendering - single video
        return (
          <EpisodeView
            episode={currentEpisode}
            series={selectedSeries}
            isMuted={isMuted}
            toggleMute={() => setIsMuted(!isMuted)}
            onEnterStory={(char, intro, hook, entryPoint) => handleChatInit({
              char, intro, hook, 
              isFromHistory: false, 
              isWhatsApp: false,
              entryPoint,
              seriesId: selectedSeries.id,
              seriesTitle: selectedSeries.title,
              episodeId: currentEpisode.id,
              episodeLabel: currentEpisode.label
            })}
            onNextEpisode={handleNext}
            onExit={() => {
              setSelectedSeries(null);
              setChatData(null);
            }}
            onNavigateToEpisode={handleNavigateToEpisode}
            onNavigateBack={handleNavigateBack}
            isChatOpen={!!chatData}
            currentIndex={activeIdx}
            ctaNavigatedEpisodes={ctaNavigatedEpisodes}
            videoHistory={videoHistory}
          />
        );
      })()}

      {!selectedSeries && (
        <nav className="fixed bottom-0 left-0 right-0 z-[1001] px-4 pb-6 pt-2">
          <div className="max-w-md mx-auto h-14 rounded-2xl border border-black/[0.06] flex items-center shadow-lg relative overflow-hidden bg-white/80 backdrop-blur-xl">
            <button 
              onClick={() => {
                setCurrentView('discover');
                setSearchParams({});
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 transition-colors duration-300 ease-in-out justify-center h-full ${currentView === 'discover' ? 'text-[#4A7C59]' : 'text-[#ACACAC]'}`}
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
              onClick={() => {
                setCurrentView('chats');
                setSearchParams({ view: 'chats' });
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 transition-colors duration-300 ease-in-out justify-center h-full ${currentView === 'chats' ? 'text-[#4A90A4]' : 'text-[#ACACAC]'}`}
            >
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 transition-colors duration-300 ease-in-out">
                  <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.178.713a19.022 19.022 0 01-1.522 3.535c-.211.373.08.794.48.754a10.875 10.875 0 002.517-.504z" clipRule="evenodd" />
                </svg>
                {Object.keys(conversations).length > 0 && currentView !== 'chats' && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#C77B58] rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-semibold transition-colors duration-300 ease-in-out">Messages</span>
            </button>

          </div>
        </nav>
      )}


      {/* Choice Selection Modal - Minimal Elegance */}
      {choiceModalData && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/30 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl p-8 animate-slide-up">
             {/* Close Button */}
             <button 
               onClick={() => setChoiceModalData(null)} 
               className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-all active:scale-95"
             >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#8A8A8A]"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             <div className="flex flex-col items-center gap-6 mt-2">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-md">
                  <img src={choiceModalData.thumbnail} className="w-full h-full object-cover" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-tight">{choiceModalData.title}</h3>
                  <p className="text-[#8A8A8A] text-sm mt-1">How would you like to start?</p>
                </div>
                
                <div className="w-full flex flex-col gap-3 mt-2">
                  {/* Show influencer options if multiple, otherwise show default options */}
                  {choiceModalData.avatars && Object.keys(choiceModalData.avatars).length > 1 ? (
                    // Multiple influencers - show routes to each
                    Object.keys(choiceModalData.avatars)
                      .map((influencerName) => (
                        <button
                          key={influencerName}
                          onClick={() => {
                            navigate(`/${getInfluencerSlug(influencerName)}`);
                            setChoiceModalData(null);
                          }}
                          className="w-full py-3.5 rounded-xl bg-[#4A7C59] text-white font-semibold text-[15px] hover:bg-[#3D6549] active:scale-[0.98] transition-all"
                        >
                          Visit {influencerName}
                        </button>
                      ))
                  ) : (
                    // Single influencer or default options
                    <>
                      <button 
                        onClick={() => {
                          const firstEp = choiceModalData.episodes[0];
                          const firstTrigger = firstEp.triggers[0];
                          handleChatInit({
                            char: firstTrigger.char,
                            intro: firstTrigger.intro,
                            hook: firstTrigger.hook,
                            isFromHistory: false,
                            isWhatsApp: true,
                            entryPoint: 'choice_modal',
                            seriesId: choiceModalData.id,
                            seriesTitle: choiceModalData.title,
                            episodeId: firstEp.id,
                            episodeLabel: firstEp.label
                          });
                          setChoiceModalData(null);
                        }}
                        className="w-full py-3.5 rounded-xl bg-[#4A7C59] text-white font-semibold text-[15px] hover:bg-[#3D6549] active:scale-[0.98] transition-all"
                      >
                        {choiceModalData.id === 'heart-beats' ? 'Start Chat' : 'Chat with Coach'}
                      </button>
                      
                      <button 
                        onClick={() => {
                          // Get first influencer
                          const firstInfluencerName = choiceModalData.avatars ? Object.keys(choiceModalData.avatars)[0] : null;
                          if (firstInfluencerName) {
                            navigate(`/${getInfluencerSlug(firstInfluencerName)}`);
                          } else {
                            setSelectedSeries(choiceModalData);
                          }
                          setChoiceModalData(null);
                        }}
                        className="w-full py-3.5 rounded-xl bg-transparent border border-black/[0.12] text-[#4A4A4A] font-semibold text-[15px] hover:bg-black/[0.02] active:scale-[0.98] transition-all"
                      >
                        {choiceModalData.id === 'heart-beats' ? 'Watch Video' : 'Watch Content'}
                      </button>
                    </>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}

      {chatData && (
        <ChatPanel 
          character={chatData.char} 
          episodeLabel={chatData.episodeLabel || selectedSeries?.episodes[activeIdx]?.label || "Inscene History"}
          instantGreeting={chatData.intro || ""}
          initialHook={chatData.hook || "Continuing conversation"}
          avatar={chatData.avatar || (selectedSeries?.avatars ? selectedSeries.avatars[chatData.char] : CHIRAG_AVATAR)}
          onClose={() => {
            // Don't clear typing status here - let it clear naturally when typing stops
            setChatData(null);
          }}
          onMessagesUpdate={(messages) => handleChatUpdate(chatData.char, messages)}
          onTypingStatusChange={(isTyping) => handleTypingStatusChange(chatData.char, isTyping)}
          existingMessages={chatData.isFromHistory ? chatData.history : undefined}
          isWhatsApp={chatData.isWhatsApp}
          entryPoint={chatData.entryPoint || 'choice_modal'}
          seriesId={chatData.seriesId}
          seriesTitle={chatData.seriesTitle}
          episodeId={chatData.episodeId}
          onWaitlistRequired={() => setIsWaitlistModalOpen(true)}
          isGuidedChat={chatData.isGuidedChat || false}
          guidedChatDuration={chatData.guidedChatDuration || 45}
          onGuidedChatComplete={() => {
            // Navigate to returnTo episode after guided chat completes
            if (selectedSeries && chatData.episodeId) {
              const currentEpisode = selectedSeries.episodes.find((ep: any) => ep.id === chatData.episodeId);
              if (currentEpisode) {
                const returnToId = getReturnToEpisodeId(currentEpisode);
                if (returnToId !== null) {
                  handleNavigateToEpisode(returnToId);
                }
              }
            }
            setChatData(null);
          }}
        />
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      {/* Waitlist Modal */}
      <WaitlistModal 
        isOpen={isWaitlistModalOpen} 
        onClose={() => setIsWaitlistModalOpen(false)} 
      />


      <Analytics />

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes subtleFloat { 
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-float { animation: subtleFloat 3s ease-in-out infinite; }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .dot-bounce-1 { animation: dotBounce 1s ease-in-out infinite; }
        .dot-bounce-2 { animation: dotBounce 1s ease-in-out infinite 0.15s; }
        .dot-bounce-3 { animation: dotBounce 1s ease-in-out infinite 0.3s; }
        @keyframes slideUpOut {
          from { transform: translateY(0); }
          to { transform: translateY(-100%); }
        }
        @keyframes slideUpIn {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideDownOut {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
        @keyframes slideDownIn {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        .video-transition-out {
          animation: slideUpOut 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .video-transition-in {
          animation: slideUpIn 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .video-transition-out-down {
          animation: slideDownOut 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .video-transition-in-up {
          animation: slideDownIn 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .reel-snap-container { scroll-behavior: smooth; }
        .scrub-range { -webkit-appearance: none; }
        .scrub-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; }
      `}</style>
    </div>
  );
};

// Wrap AppContent with AuthProvider and Router
const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/:slug" element={<InfluencerPage />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;

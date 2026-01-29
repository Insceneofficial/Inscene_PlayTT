import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EpisodeSidebar from './EpisodeSidebar';
import { trackVideoStart, updateVideoProgress, trackVideoEnd } from '../lib/analytics';

interface EpisodeViewProps {
  episode: any;
  series: any;
  isMuted: boolean;
  toggleMute: () => void;
  onEnterStory: (char: string, intro: string, hook: string, entryPoint: string) => void;
  onNextEpisode: () => void;
  onExit: () => void;
  onNavigateToEpisode?: (episodeId: number) => void;
  isChatOpen?: boolean;
  containerClassName?: string;
  preventAutoplay?: boolean;
}

const EpisodeView: React.FC<EpisodeViewProps> = ({
  episode,
  series,
  isMuted,
  toggleMute,
  onEnterStory,
  onNextEpisode,
  onExit,
  onNavigateToEpisode,
  isChatOpen = false,
  containerClassName = '',
  preventAutoplay = false,
}) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showCTAOverlay, setShowCTAOverlay] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showChatBubble, setShowChatBubble] = useState(false);
  const wasPlayingBeforeChatRef = useRef(false);
  
  // Analytics tracking
  const analyticsRecordId = useRef<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekCountRef = useRef(0);
  const pauseCountRef = useRef(0);
  const wasUnmutedRef = useRef(false);
  const isEndingSession = useRef(false);
  const sessionStartTime = useRef<number | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAttemptedAutoplay = useRef(false);
  
  // Swipe gesture detection refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const minSwipeDistance = 30; // Minimum distance in pixels to consider it a swipe
  const maxSwipeTime = 300; // Maximum time in ms to consider it a swipe

  // Get creator info
  const creatorName = series.avatars ? Object.keys(series.avatars)[0] : null;
  const creatorAvatar = creatorName ? series.avatars[creatorName] : undefined;
  
  // Find previous episode ID (for episodes > 1)
  // This finds the episode with the highest ID that is less than the current episode ID
  // BUT only from the filtered episodes based on user's path choice
  const getPreviousEpisodeId = (): number | null => {
    if (episode.id <= 1) return null;
    if (!series.episodes || series.episodes.length === 0) return null;
    
    // Get filtered episodes based on path choice (same logic as in App.tsx)
    const getFilteredEpisodes = (episodes: any[], seriesId: string): any[] => {
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
      
      return filtered;
    };
    
    // Get filtered episodes based on user's path choice
    const filteredEpisodes = getFilteredEpisodes(series.episodes, series.id);
    
    // Find all episodes in the filtered list with ID less than current episode
    const previousEpisodes = filteredEpisodes
      .filter((ep: any) => ep.id < episode.id)
      .sort((a: any, b: any) => b.id - a.id); // Sort descending to get the closest previous episode
    
    // Return the episode with the highest ID that's still less than current AND in the filtered list
    return previousEpisodes.length > 0 ? previousEpisodes[0].id : null;
  };
  
  const previousEpisodeId = getPreviousEpisodeId();

  // Auto-hide overlay after 3 seconds (but not when paused)
  useEffect(() => {
    if (!isOverlayVisible || isPaused) return;
    
    const timer = setTimeout(() => {
      setIsOverlayVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isOverlayVisible, isPaused]);

  // Show chat bubble after video starts playing (with typing indicator delay)
  useEffect(() => {
    if (isEnded || !episode.triggers || episode.triggers.length === 0) {
      setShowChatBubble(false);
      return;
    }

    // Show typing indicator first, then bubble text after delay
    const typingTimer = setTimeout(() => {
      setShowChatBubble(true);
    }, 2000); // Show typing indicator for 2 seconds, then show "Talk to [Name]"

    return () => clearTimeout(typingTimer);
  }, [episode.id, isEnded, episode.triggers]);

  // Pause video when chat opens, resume when chat closes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isChatOpen) {
      // Chat opened - pause video if it's playing
      if (!video.paused) {
        wasPlayingBeforeChatRef.current = true;
        video.pause();
      } else {
        wasPlayingBeforeChatRef.current = false;
      }
    } else {
      // Chat closed - resume video only if it was playing before chat opened
      if (wasPlayingBeforeChatRef.current && video.paused && !isEnded) {
        video.play().catch(() => {
          // Autoplay might fail, that's okay
        });
        wasPlayingBeforeChatRef.current = false;
      }
    }
  }, [isChatOpen, isEnded]);

  // Handle video tap - toggle play/pause and show overlay
  const handleVideoTap = useCallback(() => {
    const video = videoRef.current;
    if (!video || isEnded) return;
    
    setIsOverlayVisible(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Toggle play/pause
    if (video.paused) {
      video.play().catch(() => {});
      setIsPaused(false);
      // Hide CTA overlay when playback resumes (unless in last 4.5 seconds)
      if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping) {
        const current = video.currentTime;
        const total = video.duration;
        const lastSecondsThreshold = 4.5;
        if (current < total - lastSecondsThreshold || current < 1) {
          setShowCTAOverlay(false);
        }
      }
      // Auto-hide overlay after 3 seconds when playing
      inactivityTimerRef.current = setTimeout(() => {
        setIsOverlayVisible(false);
      }, 3000);
    } else {
      video.pause();
      setIsPaused(true);
      // Show CTA overlay when paused (for Episode 1, 2, or 3)
      if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping) {
        setShowCTAOverlay(true);
      }
    }
  }, [isPaused, isEnded, episode.id, episode.ctaMapping]);
  
  // Handle swipe gestures - pause video and show CTA
  const handleSwipe = useCallback(() => {
    const video = videoRef.current;
    if (!video || isEnded || video.paused) return;
    
    // Pause the video
    video.pause();
    setIsPaused(true);
    
    // Show overlay and CTA
    setIsOverlayVisible(true);
    if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping) {
      setShowCTAOverlay(true);
    }
    
    // Clear inactivity timer since we're paused
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  }, [isEnded, episode.id, episode.ctaMapping]);
  
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

  // End video session helper
  const endVideoSession = useCallback(async (isCompleted: boolean = false) => {
    if (isEndingSession.current) return;
    
    if (!analyticsRecordId.current) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }
    
    if (sessionStartTime.current) {
      const sessionDuration = Date.now() - sessionStartTime.current;
      if (sessionDuration < 1000 && !isCompleted) return;
    }
    
    isEndingSession.current = true;
    const recordIdToEnd = analyticsRecordId.current;
    
    const video = videoRef.current;
    let currentTime = 0;
    let duration = 0;
    
    if (video) {
      currentTime = video.currentTime || 0;
      duration = video.duration || 0;
    }
    
    await trackVideoEnd(
      recordIdToEnd,
      currentTime,
      duration,
      isCompleted,
      wasUnmutedRef.current
    );
    
    analyticsRecordId.current = null;
    isEndingSession.current = false;
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Aggressively stop video when preventAutoplay is true (during transitions)
  useEffect(() => {
    if (preventAutoplay && videoRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:311',message:'Stopping video due to preventAutoplay',data:{episodeId:episode.id,paused:videoRef.current?.paused,muted:videoRef.current?.muted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const video = videoRef.current;
      // Aggressively stop: pause, mute, reset position
      // Don't call load() as it causes reload and blinking
      video.pause();
      video.muted = true;
      video.currentTime = 0;
      setIsPaused(true);
    }
  }, [preventAutoplay, episode.id]);

  // Continuous check to ensure video stays stopped when preventAutoplay is true
  useEffect(() => {
    if (!preventAutoplay) return;
    
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && (!video.paused || !video.muted)) {
        video.pause();
        video.muted = true;
        if (video.currentTime > 0) {
          video.currentTime = 0;
        }
      }
    }, 100); // Check every 100ms during transition
    
    return () => clearInterval(interval);
  }, [preventAutoplay]);

  // Cleanup: Pause video when component unmounts
  useEffect(() => {
    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:310',message:'Component unmounting - pausing video',data:{episodeId:episode.id,paused:videoRef.current?.paused},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.muted = true;
      }
    };
  }, []);

  // Video lifecycle management
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set iOS attributes
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('playsinline', 'true');
    video.preload = 'auto';

    // Reset state
    seekCountRef.current = 0;
    pauseCountRef.current = 0;
    wasUnmutedRef.current = false;
    isEndingSession.current = false;
    sessionStartTime.current = null;
    hasAttemptedAutoplay.current = false;
    
    // Reset CTA overlay state when episode changes
    setShowCTAOverlay(false);
    setIsEnded(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    
    // Don't reset loading state if video is already loaded (prevents blink during transitions)
    if (video.readyState >= 2) {
      setLoading(false);
    }

    // If preventAutoplay is true, ensure video is paused and muted
    if (preventAutoplay) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:335',message:'Pausing video in lifecycle useEffect due to preventAutoplay',data:{episodeId:episode.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      video.pause();
      video.muted = true;
      setIsPaused(true);
    }

    // Start analytics tracking
    if (!analyticsRecordId.current) {
      const startPromise = trackVideoStart({
        seriesId: series.id,
        seriesTitle: series.title,
        episodeId: episode.id,
        episodeLabel: episode.label,
        videoUrl: episode.url,
        entryPoint: 'episode_view',
        isMuted: isMuted,
      });
      
      startPromise.then(recordId => {
        if (recordId) {
          analyticsRecordId.current = recordId;
          sessionStartTime.current = Date.now();
        }
      }).catch(error => {
        console.error('[EpisodeView] Error starting session:', error);
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

    // Attempt autoplay
    const attemptAutoplay = async () => {
      if (hasAttemptedAutoplay.current) return;
      hasAttemptedAutoplay.current = true;

      try {
        await video.play();
        setShowPlayButton(false);
        setLoading(false);
        setIsPaused(false);
      } catch (error) {
        console.log('[EpisodeView] Autoplay failed, showing play button');
        setShowPlayButton(true);
        setLoading(false);
        setIsPaused(true);
      }
    };

    // Wait for video to be ready
    if (video.readyState >= 2) {
      attemptAutoplay();
    } else {
      const onCanPlay = () => {
        attemptAutoplay();
        video.removeEventListener('canplay', onCanPlay);
      };
      video.addEventListener('canplay', onCanPlay);
    }

    // Handle page unload
    const handleBeforeUnload = () => endVideoSession(false);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      endVideoSession(false);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [episode.id, series.id, isMuted, endVideoSession]);

  // Track video end
  useEffect(() => {
    if (isEnded && analyticsRecordId.current) {
      endVideoSession(true);
    }
  }, [isEnded, endVideoSession]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      const paused = videoRef.current.paused;
      setCurrentTime(current);
      setDuration(total);
      setProgress((current / total) * 100 || 0);
      setIsPaused(paused);
      
      // Show CTA overlay in last 4-5 seconds for Episode 1, 2, or 3 (only when playing, not paused)
      // Only show if video has valid duration, has been playing for at least 1 second, and is in last 4.5 seconds
      const lastSecondsThreshold = 4.5;
      const shouldShowInLastSeconds = !paused && 
                                      (episode.id === 1 || episode.id === 2 || episode.id === 3) && 
                                      episode.ctaMapping && 
                                      total > 0 && 
                                      current >= 1 && // Ensure video has started playing
                                      current >= total - lastSecondsThreshold && 
                                      !isEnded;
      
      if (shouldShowInLastSeconds) {
        setShowCTAOverlay(true);
      } else if (!paused && current < total - lastSecondsThreshold && !isEnded && current >= 1) {
        // Only hide CTA if not paused, not ended, and not in last seconds (when paused or ended, CTA should stay visible)
        setShowCTAOverlay(false);
      }
      
      // When video ends, keep CTA visible
      if (isEnded && (episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping) {
        setShowCTAOverlay(true);
      }
    }
  };

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setShowPlayButton(false);
      wasUnmutedRef.current = true;
      setIsPaused(false);
      // Hide CTA overlay when playback resumes
      if ((episode.id === 1 || episode.id === 2) && episode.ctaMapping) {
        setShowCTAOverlay(false);
      }
    } catch (error) {
      console.error('[EpisodeView] Play failed:', error);
    }
  };

  const handlePause = () => {
    pauseCountRef.current += 1;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current && videoRef.current.duration) {
      const total = videoRef.current.duration;
      const newProgress = parseFloat(e.target.value);
      const newTime = (newProgress / 100) * total;
      
      // Ensure newTime is within valid bounds
      const clampedTime = Math.max(0, Math.min(newTime, total));
      
      videoRef.current.currentTime = clampedTime;
      setProgress(newProgress);
      setCurrentTime(clampedTime);
      seekCountRef.current += 1;
      
      // Reset overlay visibility on seek
      setIsOverlayVisible(true);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      // Only auto-hide overlay if video is not paused
      if (!isPaused) {
        inactivityTimerRef.current = setTimeout(() => {
          setIsOverlayVisible(false);
        }, 3000);
      }
      
      // Update CTA overlay visibility based on new position
      // Hide CTA if seeking away from last 4.5 seconds (unless paused or ended)
      const lastSecondsThreshold = 4.5;
      if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping) {
        if (!isPaused && !isEnded && (clampedTime < total - lastSecondsThreshold || clampedTime < 1)) {
          setShowCTAOverlay(false);
        } else if (isPaused && !isEnded) {
          // Keep CTA visible if paused
          setShowCTAOverlay(true);
        } else if (clampedTime >= total - lastSecondsThreshold && clampedTime >= 1 && !isPaused && !isEnded) {
          // Show CTA if in last seconds
          setShowCTAOverlay(true);
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Close sidebar on outside tap
  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sidebar]') && !target.closest('[data-sidebar-toggle]')) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSidebarOpen]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  return (
    <div 
      ref={containerRef} 
      className={`fixed inset-0 bg-black z-[500] ${containerClassName}`}
      onClick={handleVideoTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={episode.url}
        className="w-full h-full object-cover"
        playsInline
        muted={isMuted}
        onLoadedData={() => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            setLoading(false);
          }
        }}
        onCanPlay={() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:580',message:'onCanPlay triggered',data:{episodeId:episode.id,isMuted,hasAttemptedAutoplay:hasAttemptedAutoplay.current,paused:videoRef.current?.paused,muted:videoRef.current?.muted,containerClassName,preventAutoplay},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
          // #endregion
          if (!hasAttemptedAutoplay.current && videoRef.current && !preventAutoplay) {
            videoRef.current.play().then(() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:583',message:'Video play success',data:{episodeId:episode.id,muted:videoRef.current?.muted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
              // #endregion
              setIsPaused(false);
            }).catch(() => {
              setShowPlayButton(true);
              setIsPaused(true);
            });
          } else if (preventAutoplay && videoRef.current) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:592',message:'Autoplay prevented',data:{episodeId:episode.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            const video = videoRef.current;
            video.pause();
            video.muted = true;
            video.currentTime = 0;
            // Don't call load() as it causes reload and blinking
            setIsPaused(true);
          }
        }}
        onPlaying={() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:604',message:'Video playing',data:{episodeId:episode.id,isMuted,muted:videoRef.current?.muted,containerClassName,preventAutoplay},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
          // #endregion
          // If preventAutoplay is true, aggressively stop the video immediately
          if (preventAutoplay && videoRef.current) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EpisodeView.tsx:607',message:'Stopping video in onPlaying due to preventAutoplay',data:{episodeId:episode.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            const video = videoRef.current;
            video.pause();
            video.muted = true;
            video.currentTime = 0;
            // Don't call load() as it causes reload and blinking
            setIsPaused(true);
            return;
          }
          setLoading(false);
          setShowPlayButton(false);
          setIsPaused(false);
          // Hide CTA overlay when playback resumes (unless video has ended or in last 4.5 seconds)
          if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping && !isEnded && videoRef.current) {
            const current = videoRef.current.currentTime;
            const total = videoRef.current.duration;
            const lastSecondsThreshold = 4.5;
            // Only hide if not in last seconds
            if (current < total - lastSecondsThreshold || current < 1) {
              setShowCTAOverlay(false);
            }
          }
        }}
        onPause={() => {
          handlePause();
          setIsPaused(true);
          // Show CTA overlay when paused (for Episode 1, 2, or 3, but not if video has ended - that's handled by onEnded)
          if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping && !isEnded) {
            setShowCTAOverlay(true);
          }
        }}
        onEnded={() => {
          setIsEnded(true);
          setIsPaused(true);
          // Ensure video stays paused on end frame
          if (videoRef.current) {
            videoRef.current.pause();
          }
          // Show CTA overlay when video ends (for Episode 1, 2, or 3 with ctaMapping)
          if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping) {
            setShowCTAOverlay(true);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onClick={(e) => {
          e.stopPropagation();
          handleVideoTap();
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

      {/* Always-Visible Controls (Home & Sidebar Toggle) */}
      <div 
        className="absolute top-0 left-0 z-40 px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {/* Home Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExit();
              navigate('/');
            }}
            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Go to homepage"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* Hamburger Menu */}
          <button
            data-sidebar-toggle
            onClick={(e) => {
              e.stopPropagation();
              setIsSidebarOpen(true);
              setIsOverlayVisible(true);
            }}
            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Open menu"
          >
            <div className="flex flex-col gap-1.5 w-5">
              <span className="h-0.5 bg-white rounded-full" />
              <span className="h-0.5 bg-white rounded-full" />
              <span className="h-0.5 bg-white rounded-full" />
            </div>
          </button>

          {/* Previous Episode Button - Only show for episodes > 1, positioned after sidebar */}
          {previousEpisodeId !== null && onNavigateToEpisode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onNavigateToEpisode(previousEpisodeId);
              }}
              className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center active:scale-95 transition-all hover:bg-white/20"
              aria-label="Go to previous episode"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6m-6 6h12a6 6 0 010 12h-3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Loading Spinner */}
      {loading && !isEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-white/60">Loading...</p>
          </div>
        </div>
      )}

      {/* Play Button (if autoplay failed) */}
      {showPlayButton && !isEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
            className="w-20 h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-black ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )}

      {/* Top Overlay */}
      <div 
        className={`absolute top-0 left-0 right-0 z-30 transition-opacity duration-300 ${
          isOverlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-b from-black/60 to-transparent px-6 py-4">
          <div className="flex items-center justify-between pl-[104px]">
            {/* Episode Title */}
            <div className="flex-1 px-4">
              <h3 className="text-sm font-medium text-white/90 text-center truncate">
                {episode.label}
              </h3>
            </div>

            {/* Mute Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
                setIsOverlayVisible(true);
              }}
              className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.535 7.465a.75.75 0 0 1 1.06 0L22.12 10l-2.525 2.525a.75.75 0 1 1-1.06-1.06L20 10l-1.465-1.465a.75.75 0 0 1 0-1.06Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06 4.25 4.25 0 0 1 0 6.01.75.75 0 0 0 1.06 1.06 5.75 5.75 0 0 0 0-8.13ZM21.03 5.97a.75.75 0 0 0-1.06 1.06 8.5 8.5 0 0 1 0 12.02.75.75 0 1 0 1.06 1.06 10 10 0 0 0 0-14.14Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Chatbot Icon - Bottom Right */}
      {!isEnded && episode.triggers && episode.triggers.length > 0 && (
        <div 
          className="absolute right-4 bottom-24 z-[100] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {episode.triggers.map((t: any, idx: number) => {
            const characterName = t.char || creatorName || 'Chirag';
            return (
              <div
                key={idx}
                data-chat-button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onEnterStory(t.char, t.intro, t.hook, 'video_sidebar'); 
                }}
                className="cursor-pointer"
              >
                <div className="relative group">
                  {/* Speech Bubble - Only show when overlay is visible */}
                  {isOverlayVisible && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-full z-50 transition-all duration-500 ease-in-out pointer-events-none mr-2">
                      <div className="relative bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg transition-all duration-500 ease-in-out">
                        <div className="text-[#1A1A1A] text-[12px] font-medium leading-tight whitespace-nowrap flex items-center gap-0.5">
                          {showChatBubble ? (
                            `Talk to ${characterName}`
                          ) : (
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
                  
                  {/* Character Avatar - Always visible */}
                  <div className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shadow-lg transition-all duration-300">
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4A7C59] border-2 border-black rounded-full z-30" />
                    <img 
                      src={series.avatars[t.char] || creatorAvatar || ''} 
                      alt={characterName} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Progress Bar (always visible, but lower z-index when CTA is shown) */}
      {!isEnded && (
        <div 
          className={`absolute bottom-0 left-0 right-0 pt-20 ${showCTAOverlay ? 'z-[30]' : 'z-40'} pointer-events-auto`}
          onClick={(e) => e.stopPropagation()}
        >
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
                  setIsOverlayVisible(true);
                }}
                onMouseUp={() => setIsScrubbing(false)}
                onTouchStart={() => {
                  setIsScrubbing(true);
                  setIsOverlayVisible(true);
                }}
                onTouchEnd={() => setIsScrubbing(false)}
                className="scrub-range w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer pointer-events-auto z-10"
              />
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-white rounded-full transition-all duration-75 pointer-events-none" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className={`mt-1.5 flex justify-between items-center transition-all duration-500 ${isScrubbing ? 'opacity-100' : 'opacity-70'}`}>
              <div className="text-[11px] text-white/90 tabular-nums font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA Overlay - Shows when paused, in last 7 seconds, or when video ends for Episode 1, 2, or 3 */}
      {showCTAOverlay && (episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping && (
        <div 
          className="absolute bottom-0 left-0 right-0 z-[50] px-4 pb-6 pt-4 pointer-events-auto"
          style={{ paddingBottom: (isPaused || isEnded) ? '100px' : '24px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-sm rounded-t-2xl pointer-events-auto">
            <div className="px-4 py-3 pointer-events-auto">
              <p className="text-white text-center text-sm font-medium mb-4 pointer-events-none">
                {episode.id === 1 ? 'What problems are you facing?' : episode.id === 3 ? 'What would you like to explore?' : 'Which shot would you like to learn?'}
              </p>
              <div className="grid grid-cols-2 gap-2 pointer-events-auto">
                {episode.id === 1 ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.professional;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Need guidance about professional cricket journey
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.speed;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Speed
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.stamina;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Stamina
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.shots;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Shots
                    </button>
                  </>
                ) : episode.id === 3 ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.applicationProcess;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Application process
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.mindset;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Mindset
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.coverDrive;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Cover drive
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.pullShot;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Pull shot
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.stepOut;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Step out
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Only navigate if explicitly configured with a valid episode ID
                        const targetEpisodeId = episode.ctaMapping?.cut;
                        if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                          onNavigateToEpisode(targetEpisodeId);
                        }
                      }}
                      className="relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center pointer-events-auto cursor-pointer w-full"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Cut
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Sidebar */}
      <div
        data-sidebar
        className={`fixed top-0 left-0 h-full w-[280px] bg-white shadow-xl z-[1000] transform transition-transform duration-300 ease-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ willChange: 'transform' }}
      >
        {creatorName && (
          <EpisodeSidebar
            creatorId={creatorName}
            creatorName={creatorName}
            creatorAvatar={creatorAvatar}
            episode={episode}
            series={series}
            onChatClick={onEnterStory}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999] transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Animation styles for typing indicator */}
      <style>{`
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .dot-bounce-1 { animation: dotBounce 1s ease-in-out infinite; }
        .dot-bounce-2 { animation: dotBounce 1s ease-in-out infinite 0.15s; }
        .dot-bounce-3 { animation: dotBounce 1s ease-in-out infinite 0.3s; }
      `}</style>
    </div>
  );
};

export default EpisodeView;

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
}

interface CTACardProps {
  optionKey: string;
  title: string;
  details?: {
    title: string;
    description: string;
    journey: string;
    consequence: string;
  };
  isEnlarged: boolean;
  isFlipped?: boolean;
  isBlurred?: boolean;
  onEnlarge: () => void;
  onConfirm: () => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

const CTACard: React.FC<CTACardProps> = ({ 
  optionKey, 
  title, 
  details, 
  isEnlarged, 
  isFlipped = false,
  isBlurred = false,
  onEnlarge, 
  onConfirm,
  cardRef
}) => {
  const fillIntervalRef = useRef<number | null>(null);
  const [fillProgress, setFillProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const isHoldingRef = useRef(false);
  const progressStartTimeRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const totalHoldTimeRef = useRef<number>(0); // Total accumulated hold time
  const lastUpdateTimeRef = useRef<number | null>(null);
  const baseFillDuration = 2000; // 2 seconds base duration
  const holdAcceleration = 3; // 3x speed when holding

  // Start fill animation automatically when card is enlarged, speed up when holding
  useEffect(() => {
    if (isEnlarged) {
      setFillProgress(0);
      const startTime = Date.now();
      progressStartTimeRef.current = startTime;
      holdStartTimeRef.current = null;
      totalHoldTimeRef.current = 0;
      lastUpdateTimeRef.current = startTime;
      
      const updateFill = () => {
        if (!progressStartTimeRef.current || !lastUpdateTimeRef.current) return;
        
        const now = Date.now();
        const deltaTime = now - lastUpdateTimeRef.current;
        lastUpdateTimeRef.current = now;
        
        // Update total hold time if currently holding
        if (isHoldingRef.current) {
          if (holdStartTimeRef.current === null) {
            holdStartTimeRef.current = now;
          }
          totalHoldTimeRef.current += deltaTime;
        }
        
        // Calculate effective time: total elapsed - hold time + (hold time * 3)
        // = total elapsed + (hold time * 2)
        const totalElapsed = now - progressStartTimeRef.current;
        const effectiveTime = totalElapsed + (totalHoldTimeRef.current * (holdAcceleration - 1));
        
        const progress = Math.min((effectiveTime / baseFillDuration) * 100, 100);
        setFillProgress(progress);
        
        if (progress >= 100) {
          if (fillIntervalRef.current) {
            clearInterval(fillIntervalRef.current);
            fillIntervalRef.current = null;
          }
          // Reset holding state before confirming to ensure swipe is enabled
          isHoldingRef.current = false;
          setIsHolding(false);
          progressStartTimeRef.current = null;
          holdStartTimeRef.current = null;
          totalHoldTimeRef.current = 0;
          lastUpdateTimeRef.current = null;
          onConfirm();
        }
      };
      
      fillIntervalRef.current = setInterval(updateFill, 16) as any;
      
      return () => {
        if (fillIntervalRef.current) {
          clearInterval(fillIntervalRef.current);
          fillIntervalRef.current = null;
        }
      };
    } else {
      // Reset when not enlarged
      setFillProgress(0);
      progressStartTimeRef.current = null;
      holdStartTimeRef.current = null;
      totalHoldTimeRef.current = 0;
      lastUpdateTimeRef.current = null;
      if (fillIntervalRef.current) {
        clearInterval(fillIntervalRef.current);
        fillIntervalRef.current = null;
      }
    }
  }, [isEnlarged, onConfirm]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEnlarged) {
      onEnlarge();
    }
  }, [isEnlarged, onEnlarge]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEnlarged) {
      e.preventDefault();
      e.stopPropagation();
      isHoldingRef.current = true;
      setIsHolding(true);
    }
  }, [isEnlarged]);

  const handleMouseUp = useCallback(() => {
    isHoldingRef.current = false;
    setIsHolding(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isEnlarged) {
      e.preventDefault();
      e.stopPropagation();
      isHoldingRef.current = true;
      setIsHolding(true);
    }
  }, [isEnlarged]);

  const handleTouchEnd = useCallback(() => {
    isHoldingRef.current = false;
    setIsHolding(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fillIntervalRef.current) {
        clearInterval(fillIntervalRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={cardRef}
      data-cta-card
      className={`relative w-full h-full ${isBlurred ? 'backdrop-blur-sm opacity-60 pointer-events-none' : ''}`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'manipulation' }}
    >
      <div 
        className="relative w-full h-full"
        style={{ 
          perspective: '1000px',
          WebkitPerspective: '1000px'
        }}
      >
        <div
          className="relative w-full h-full transform-style-3d"
            style={{
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
        >
          {/* Front Face */}
          <div 
            className="absolute inset-0 backface-hidden rounded-xl"
            style={{ 
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden'
            }}
          >
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              {/* Card background */}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-xl" />
              
              {/* Content */}
              <div className="relative w-full h-full min-h-[60px] flex flex-col items-center justify-center text-center px-3 py-2.5 z-10">
                <h3 className="text-[11px] font-medium text-white mb-1">{title}</h3>
              </div>
            </div>
          </div>

          {/* Back Face */}
          <div 
            className="absolute inset-0 backface-hidden rounded-xl"
            style={{ 
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="relative w-full h-full rounded-xl overflow-hidden">
              {/* Card background */}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-xl z-0" />
              
              {/* Green fill overlay - left to right */}
              {isEnlarged && (
                <div 
                  className={`absolute inset-0 rounded-xl z-[5] transition-all duration-200 ${
                    isHolding ? 'bg-[#5A9C6A]' : 'bg-[#4A7C59]'
                  }`}
                  style={{
                    clipPath: `inset(0 ${100 - fillProgress}% 0 0)`,
                    transition: 'clip-path 0.1s linear',
                    opacity: fillProgress > 0 ? 0.8 : 0.3, // Make it more visible
                  }}
                />
              )}
              
              
              {/* Details Content */}
              <div className="relative w-full h-full min-h-[80px] flex flex-col items-center justify-center text-center px-5 py-4 z-10">
                {details ? (
                  <div className="w-full flex flex-col items-center justify-start gap-2 max-h-full overflow-y-auto">
                    <h3 className="text-[14px] font-medium text-white leading-tight mb-0.5">{details.title || title}</h3>
                    <p className="text-[11px] text-white/90 leading-[1.5] px-2" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{details.description}</p>
                    {details.journey && (
                      <p className="text-[10px] text-white/80 leading-[1.4] px-2 mt-1">{details.journey}</p>
                    )}
                  </div>
                ) : (
                  <h3 className="text-[14px] font-medium text-white leading-tight">{title}</h3>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  
  // CTA focus state
  const [enlargedCardId, setEnlargedCardId] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null); // Track which card is flipped in the grid
  const [hideOriginalCardId, setHideOriginalCardId] = useState<string | null>(null); // Track which card to hide after flip completes
  const [outsideClickCount, setOutsideClickCount] = useState(0);
  const [expandedCardBounds, setExpandedCardBounds] = useState<DOMRect | null>(null);
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const swipeStartY = useRef<number | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartTime = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapCardId = useRef<string | null>(null);
  
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

  // Show overlay on tap (but don't auto-hide when paused)
  const handleVideoTap = useCallback(() => {
    setIsOverlayVisible(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (!isPaused) {
      inactivityTimerRef.current = setTimeout(() => {
        setIsOverlayVisible(false);
      }, 3000);
    }
  }, [isPaused]);

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
    setEnlargedCardId(null);
    setIsFlipped(false);
    setFlippedCardId(null);
    setHideOriginalCardId(null);
    setIsEnded(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);

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

  // Handler for previous episode navigation
  const handlePreviousEpisode = useCallback(() => {
    if (previousEpisodeId !== null && onNavigateToEpisode) {
      onNavigateToEpisode(previousEpisodeId);
    }
  }, [previousEpisodeId, onNavigateToEpisode]);

  // Vertical swipe detection for episode navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't handle swipe if CTA overlay is visible or card is enlarged
    if (showCTAOverlay || enlargedCardId !== null) return;
    
    const touch = e.touches[0];
    swipeStartY.current = touch.clientY;
    swipeStartX.current = touch.clientX;
    swipeStartTime.current = Date.now();
  }, [showCTAOverlay, enlargedCardId]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Prevent default scrolling when swiping
    if (showCTAOverlay || enlargedCardId !== null) return;
    
    // If we have a valid swipe start, prevent default to allow swipe detection
    if (swipeStartY.current !== null && swipeStartX.current !== null) {
      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - swipeStartY.current);
      const deltaX = Math.abs(touch.clientX - swipeStartX.current);
      
      // If vertical movement is greater than horizontal, prevent default scroll
      if (deltaY > deltaX && deltaY > 10) {
        e.preventDefault();
      }
    }
  }, [showCTAOverlay, enlargedCardId]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Don't handle swipe if CTA overlay is visible or card is enlarged
    if (showCTAOverlay || enlargedCardId !== null) {
      swipeStartY.current = null;
      swipeStartX.current = null;
      swipeStartTime.current = null;
      return;
    }

    if (swipeStartY.current === null || swipeStartX.current === null || swipeStartTime.current === null) {
      return;
    }

    const touch = e.changedTouches[0];
    const deltaY = swipeStartY.current - touch.clientY; // Positive = swipe up, Negative = swipe down
    const deltaX = Math.abs(swipeStartX.current - touch.clientX);
    const deltaTime = Date.now() - swipeStartTime.current;
    const distance = Math.abs(deltaY);

    // Check if this is a vertical swipe (vertical movement > horizontal)
    if (distance > deltaX && distance > 50 && deltaTime < 500) {
      if (deltaY > 0) {
        // Swipe UP = Next episode
        onNextEpisode();
      } else {
        // Swipe DOWN = Previous episode
        handlePreviousEpisode();
      }
    }

    // Reset swipe tracking
    swipeStartY.current = null;
    swipeStartX.current = null;
    swipeStartTime.current = null;
  }, [showCTAOverlay, enlargedCardId, onNextEpisode, handlePreviousEpisode]);

  // Handle card enlargement with flip - flip happens first on original card, then enlarge
  const handleCardEnlarge = useCallback((cardId: string) => {
    // First, flip the card in the grid (this will be visible)
    setFlippedCardId(cardId);
    
    // Wait for flip animation to complete before showing enlarged overlay
    setTimeout(() => {
      const cardElement = cardRefs.current[cardId];
      if (cardElement) {
        const bounds = cardElement.getBoundingClientRect();
        setExpandedCardBounds(bounds);
      }
      setEnlargedCardId(cardId);
      setIsFlipped(true);
      setOutsideClickCount(0);
      
      // Hide the original card after a brief moment
      setTimeout(() => {
        setHideOriginalCardId(cardId);
      }, 50);
    }, 400); // Wait for flip animation to complete (matches transition duration)
  }, []);

  // Handle outside click - reverse flip and shrink back to original size
  const handleOutsideClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-cta-card]') || target.closest('[data-expanded-card]')) {
      return;
    }

    if (enlargedCardId) {
      // Show original card again first
      setHideOriginalCardId(null);
      // Reverse flip and shrink back to original size
      setIsFlipped(false);
      setFlippedCardId(null);
      // Wait for flip animation to complete before collapsing
      setTimeout(() => {
        setEnlargedCardId(null);
        setExpandedCardBounds(null);
        setOutsideClickCount(0);
      }, 400);
    }
  }, [enlargedCardId]);

  // Gesture detection for CTA trigger (any direction when paused/finished)
  const handleGestureDetection = useCallback((e: React.TouchEvent) => {
    // Only trigger CTA on gesture when paused or ended
    if (!isPaused && !isEnded) return;
    
    // Don't trigger if CTA is already visible or card is enlarged
    if (showCTAOverlay || enlargedCardId !== null) return;
    
    // Only for episodes with CTA mapping
    if (!(episode.id === 1 || episode.id === 2 || episode.id === 3) || !episode.ctaMapping) return;

    const touch = e.touches[0];
    if (swipeStartY.current === null || swipeStartX.current === null) {
      swipeStartY.current = touch.clientY;
      swipeStartX.current = touch.clientX;
      swipeStartTime.current = Date.now();
      return;
    }

    const deltaY = Math.abs(touch.clientY - swipeStartY.current);
    const deltaX = Math.abs(touch.clientX - swipeStartX.current);
    
    // Detect any intentional gesture (minimum 30px movement)
    if (deltaY > 30 || deltaX > 30) {
      setShowCTAOverlay(true);
      swipeStartY.current = null;
      swipeStartX.current = null;
      swipeStartTime.current = null;
    }
  }, [isPaused, isEnded, showCTAOverlay, enlargedCardId, episode.id, episode.ctaMapping]);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 bg-black z-[500]"
      onClick={handleVideoTap}
      onTouchStart={(e) => {
        // Gesture detection for CTA trigger
        if (isPaused || isEnded) {
          handleGestureDetection(e);
        }
        // Vertical swipe detection
        handleTouchStart(e);
      }}
      onTouchMove={handleTouchMove}
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
          if (!hasAttemptedAutoplay.current && videoRef.current) {
            videoRef.current.play().then(() => {
              setIsPaused(false);
            }).catch(() => {
              setShowPlayButton(true);
              setIsPaused(true);
            });
          }
        }}
        onPlaying={() => {
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
          const video = videoRef.current;
          // Don't allow play/pause if video has ended - keep it paused on end frame
          if (isEnded) {
            return;
          }
          if (video?.paused) {
            video.play().catch(() => {});
            setIsPaused(false);
            // Hide CTA overlay when playback resumes (unless in last 4.5 seconds)
            if ((episode.id === 1 || episode.id === 2) && episode.ctaMapping) {
              const current = video.currentTime;
              const total = video.duration;
              const lastSecondsThreshold = 4.5;
              // Only hide if not in last seconds
              if (current < total - lastSecondsThreshold || current < 1) {
                setShowCTAOverlay(false);
              }
            }
          } else {
            video?.pause();
            setIsPaused(true);
            // Show CTA overlay when paused (for Episode 1, 2, or 3)
            if ((episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping) {
              setShowCTAOverlay(true);
            }
          }
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
          className="absolute inset-0 z-[50] pointer-events-auto flex items-center justify-center px-4 py-8"
          onClick={handleOutsideClick}
        >
          <div className="w-full max-w-md max-h-[90vh]">
            <p className="text-white text-center text-sm font-medium mb-4 pointer-events-none px-2">
              {episode.id === 1 ? 'What problems are you facing?' : episode.id === 3 ? 'What would you like to explore?' : 'Which shot would you like to learn?'}
            </p>
            <div className="grid grid-cols-2 gap-2.5 pointer-events-auto px-2">
                {episode.id === 1 ? (
                  <>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'professional' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="professional"
                        title="Need guidance about professional cricket journey"
                        details={episode.ctaDetails?.professional}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'professional'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'professional'}
                        onEnlarge={() => handleCardEnlarge('professional')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.professional;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['professional'] = el; }}
                      />
                    </div>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'speed' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="speed"
                        title="Speed"
                        details={episode.ctaDetails?.speed}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'speed'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'speed'}
                        onEnlarge={() => handleCardEnlarge('speed')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.speed;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['speed'] = el; }}
                      />
                    </div>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'stamina' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="stamina"
                        title="Stamina"
                        details={episode.ctaDetails?.stamina}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'stamina'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'stamina'}
                        onEnlarge={() => handleCardEnlarge('stamina')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.stamina;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['stamina'] = el; }}
                      />
                    </div>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'shots' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="shots"
                        title="Shots"
                        details={episode.ctaDetails?.shots}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'shots'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'shots'}
                        onEnlarge={() => handleCardEnlarge('shots')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.shots;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['shots'] = el; }}
                      />
                    </div>
                  </>
                ) : episode.id === 3 ? (
                  <>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'applicationProcess' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="applicationProcess"
                        title="Application process"
                        details={episode.ctaDetails?.applicationProcess}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'applicationProcess'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'applicationProcess'}
                        onEnlarge={() => handleCardEnlarge('applicationProcess')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.applicationProcess;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['applicationProcess'] = el; }}
                      />
                    </div>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'mindset' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="mindset"
                        title="Mindset"
                        details={episode.ctaDetails?.mindset}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'mindset'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'mindset'}
                        onEnlarge={() => handleCardEnlarge('mindset')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.mindset;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['mindset'] = el; }}
                      />
                    </div>
                    <div></div>
                    <div></div>
                  </>
                ) : (
                  <>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'coverDrive' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="coverDrive"
                        title="Cover drive"
                        details={episode.ctaDetails?.coverDrive}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'coverDrive'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'coverDrive'}
                        onEnlarge={() => handleCardEnlarge('coverDrive')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.coverDrive;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['coverDrive'] = el; }}
                      />
                    </div>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'pullShot' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="pullShot"
                        title="Pull shot"
                        details={episode.ctaDetails?.pullShot}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'pullShot'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'pullShot'}
                        onEnlarge={() => handleCardEnlarge('pullShot')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.pullShot;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['pullShot'] = el; }}
                      />
                    </div>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'stepOut' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="stepOut"
                        title="Step out"
                        details={episode.ctaDetails?.stepOut}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'stepOut'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'stepOut'}
                        onEnlarge={() => handleCardEnlarge('stepOut')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.stepOut;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['stepOut'] = el; }}
                      />
                    </div>
                    <div className={`w-full min-h-[60px] transition-opacity duration-300 ${hideOriginalCardId === 'cut' ? 'opacity-0 pointer-events-none' : ''}`}>
                      <CTACard
                        optionKey="cut"
                        title="Cut"
                        details={episode.ctaDetails?.cut}
                        isEnlarged={false}
                        isFlipped={flippedCardId === 'cut'}
                        isBlurred={enlargedCardId !== null && enlargedCardId !== 'cut'}
                        onEnlarge={() => handleCardEnlarge('cut')}
                        onConfirm={() => {
                          const targetEpisodeId = episode.ctaMapping?.cut;
                          if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                            setEnlargedCardId(null);
                            setIsFlipped(false);
                            setExpandedCardBounds(null);
                            setShowCTAOverlay(false);
                            onNavigateToEpisode(targetEpisodeId);
                          }
                        }}
                        cardRef={(el) => { cardRefs.current['cut'] = el; }}
                      />
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Expanded Card Portal Overlay */}
      {enlargedCardId && expandedCardBounds && showCTAOverlay && (episode.id === 1 || episode.id === 2 || episode.id === 3) && episode.ctaMapping && (
        <div 
          className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center transition-opacity duration-300"
          data-expanded-card
          style={{ opacity: hideOriginalCardId === enlargedCardId ? 1 : 0 }}
        >
          {/* Backdrop to make blurred cards visible */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-none" />
          <div
            className="pointer-events-auto"
            style={{
              width: expandedCardBounds.width,
              height: Math.max(expandedCardBounds.height, 200), // Ensure minimum height for content
              transform: 'scale(2.0)',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease-out',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            {enlargedCardId === 'professional' && (
              <CTACard
                optionKey="professional"
                title="Need guidance about professional cricket journey"
                details={episode.ctaDetails?.professional}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.professional;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'speed' && (
              <CTACard
                optionKey="speed"
                title="Speed"
                details={episode.ctaDetails?.speed}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.speed;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'stamina' && (
              <CTACard
                optionKey="stamina"
                title="Stamina"
                details={episode.ctaDetails?.stamina}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.stamina;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'shots' && (
              <CTACard
                optionKey="shots"
                title="Shots"
                details={episode.ctaDetails?.shots}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.shots;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'applicationProcess' && (
              <CTACard
                optionKey="applicationProcess"
                title="Application process"
                details={episode.ctaDetails?.applicationProcess}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.applicationProcess;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'mindset' && (
              <CTACard
                optionKey="mindset"
                title="Mindset"
                details={episode.ctaDetails?.mindset}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.mindset;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'coverDrive' && (
              <CTACard
                optionKey="coverDrive"
                title="Cover drive"
                details={episode.ctaDetails?.coverDrive}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.coverDrive;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'pullShot' && (
              <CTACard
                optionKey="pullShot"
                title="Pull shot"
                details={episode.ctaDetails?.pullShot}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.pullShot;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'stepOut' && (
              <CTACard
                optionKey="stepOut"
                title="Step out"
                details={episode.ctaDetails?.stepOut}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.stepOut;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
            {enlargedCardId === 'cut' && (
              <CTACard
                optionKey="cut"
                title="Cut"
                details={episode.ctaDetails?.cut}
                isEnlarged={true}
                isFlipped={isFlipped}
                isBlurred={false}
                onEnlarge={() => {}}
                onConfirm={() => {
                  const targetEpisodeId = episode.ctaMapping?.cut;
                  if (onNavigateToEpisode && targetEpisodeId !== undefined && targetEpisodeId !== null && typeof targetEpisodeId === 'number') {
                    setEnlargedCardId(null);
                    setIsFlipped(false);
                    setExpandedCardBounds(null);
                    setShowCTAOverlay(false);
                    onNavigateToEpisode(targetEpisodeId);
                  }
                }}
              />
            )}
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

      {/* Animation styles for typing indicator, card flip, and border glow */}
      <style>{`
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .dot-bounce-1 { animation: dotBounce 1s ease-in-out infinite; }
        .dot-bounce-2 { animation: dotBounce 1s ease-in-out infinite 0.15s; }
        .dot-bounce-3 { animation: dotBounce 1s ease-in-out infinite 0.3s; }
        
        /* Card flip 3D perspective */
        .perspective-1000 {
          perspective: 1000px;
          -webkit-perspective: 1000px;
        }
        
        .transform-style-3d {
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
        }
        
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        
        /* Border glow animation */
        @keyframes borderGlow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
            border-color: rgba(255, 255, 255, 0.2);
          }
          50% {
            box-shadow: 0 0 8px 2px rgba(255, 255, 255, 0.6);
            border-color: rgba(255, 255, 255, 0.4);
          }
        }
        
        .border-glow {
          animation: borderGlow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default EpisodeView;

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  onShowPathChoice?: () => void;
}

const EpisodeView: React.FC<EpisodeViewProps> = ({
  episode,
  series,
  isMuted,
  toggleMute,
  onEnterStory,
  onNextEpisode,
  onExit,
  onShowPathChoice,
}) => {
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

  // Auto-hide overlay after 3 seconds
  useEffect(() => {
    if (!isOverlayVisible) return;
    
    const timer = setTimeout(() => {
      setIsOverlayVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isOverlayVisible]);

  // Show overlay on tap
  const handleVideoTap = useCallback(() => {
    setIsOverlayVisible(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      setIsOverlayVisible(false);
    }, 3000);
  }, []);

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
      } catch (error) {
        console.log('[EpisodeView] Autoplay failed, showing play button');
        setShowPlayButton(true);
        setLoading(false);
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
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100 || 0);
    }
  };

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setShowPlayButton(false);
      wasUnmutedRef.current = true;
    } catch (error) {
      console.error('[EpisodeView] Play failed:', error);
    }
  };

  const handlePause = () => {
    pauseCountRef.current += 1;
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
      className="fixed inset-0 bg-black z-[500]"
      onClick={handleVideoTap}
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
            videoRef.current.play().catch(() => {
              setShowPlayButton(true);
            });
          }
        }}
        onPlaying={() => {
          setLoading(false);
          setShowPlayButton(false);
        }}
        onPause={handlePause}
        onEnded={() => {
          setIsEnded(true);
          // For episode 1, show path choice modal
          if (episode.id === 1 && onShowPathChoice) {
            setTimeout(() => {
              onShowPathChoice();
            }, 500);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onClick={(e) => {
          e.stopPropagation();
          const video = videoRef.current;
          if (video?.paused) {
            video.play().catch(() => {});
          } else {
            video?.pause();
          }
        }}
      />

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
          <div className="flex items-center justify-between">
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

      {/* Bottom Progress Bar (only when overlay is visible) */}
      {isOverlayVisible && !isEnded && (
        <div 
          className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-t from-black/60 to-transparent pt-8 pb-2">
            <div className="relative h-1 bg-white/20 rounded-full">
              <div 
                className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-75" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="text-[11px] text-white/80 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video End Screen */}
      {isEnded && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 bg-black/60 backdrop-blur-xl">
          <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight">Continue your journey</h3>
          
          {episode.triggers && episode.triggers.length > 0 && (
            <div className="flex flex-col gap-3 mb-10 w-full max-w-[280px]">
              {episode.triggers.map((trigger: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => {
                    onEnterStory(trigger.char, trigger.intro, trigger.hook, 'video_end_screen');
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 active:scale-95 transition-all"
                >
                  <img 
                    src={series.avatars[trigger.char]} 
                    alt={trigger.char}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <span className="font-semibold">Chat with {trigger.char}</span>
                </button>
              ))}
            </div>
          )}

          <button 
            onClick={onNextEpisode}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
            </div>
            <span className="text-[13px] text-white/50 group-hover:text-white/80 transition-colors">Next</span>
          </button>
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
    </div>
  );
};

export default EpisodeView;

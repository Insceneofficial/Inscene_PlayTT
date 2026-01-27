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

  // Auto-hide overlay after 3 seconds (but not when paused)
  useEffect(() => {
    if (!isOverlayVisible || isPaused) return;
    
    const timer = setTimeout(() => {
      setIsOverlayVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isOverlayVisible, isPaused]);

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
      
      // Show CTA overlay in last 7 seconds for Episode 1 (only when playing, not paused)
      if (!paused && episode.id === 1 && episode.ctaMapping && total > 0 && current >= total - 7 && !isEnded) {
        setShowCTAOverlay(true);
      } else if (!paused && (current < total - 7) && !isEnded) {
        // Only hide CTA if not paused and not ended (when paused or ended, CTA should stay visible)
        setShowCTAOverlay(false);
      }
      // When video ends, keep CTA visible
      if (isEnded && episode.id === 1 && episode.ctaMapping) {
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
      if (episode.id === 1 && episode.ctaMapping) {
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
    if (videoRef.current) {
      const newTime = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setProgress(parseFloat(e.target.value));
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
          // Hide CTA overlay when playback resumes (unless video has ended)
          if (episode.id === 1 && episode.ctaMapping && !isEnded) {
            setShowCTAOverlay(false);
          }
        }}
        onPause={() => {
          handlePause();
          setIsPaused(true);
          // Show CTA overlay when paused (for Episode 1, but not if video has ended - that's handled by onEnded)
          if (episode.id === 1 && episode.ctaMapping && !isEnded) {
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
          // Show CTA overlay when video ends (for Episode 1 with ctaMapping)
          if (episode.id === 1 && episode.ctaMapping) {
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
            // Hide CTA overlay when playback resumes
            if (episode.id === 1 && episode.ctaMapping) {
              setShowCTAOverlay(false);
            }
          } else {
            video?.pause();
            setIsPaused(true);
            // Show CTA overlay when paused (for Episode 1)
            if (episode.id === 1 && episode.ctaMapping) {
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

      {/* Bottom Progress Bar (always visible) */}
      {!isEnded && (
        <div 
          className="absolute bottom-0 left-0 right-0 z-40 pt-20"
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

      {/* CTA Overlay - Shows when paused, in last 7 seconds, or when video ends for Episode 1 */}
      {showCTAOverlay && episode.id === 1 && episode.ctaMapping && (
        <div 
          className="absolute bottom-0 left-0 right-0 z-[35] px-4 pb-6 pt-4"
          style={{ paddingBottom: (isPaused || isEnded) ? '100px' : '24px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-sm rounded-t-2xl">
            <div className="px-4 py-3">
              <p className="text-white text-center text-sm font-medium mb-4">
                What problems are you facing?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigateToEpisode && episode.ctaMapping?.professional) {
                      onNavigateToEpisode(episode.ctaMapping.professional);
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center"
                >
                  Need guidance about professional cricket journey
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigateToEpisode && episode.ctaMapping?.speed) {
                      onNavigateToEpisode(episode.ctaMapping.speed);
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center"
                >
                  Speed
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigateToEpisode && episode.ctaMapping?.stamina) {
                      onNavigateToEpisode(episode.ctaMapping.stamina);
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center"
                >
                  Stamina
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNavigateToEpisode && episode.ctaMapping?.shots) {
                      onNavigateToEpisode(episode.ctaMapping.shots);
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-center min-h-[44px] flex items-center justify-center"
                >
                  Shots
                </button>
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
    </div>
  );
};

export default EpisodeView;

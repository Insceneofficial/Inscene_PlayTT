import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Logo from './Logo.tsx';
import ChatPanel from './ChatPanel.tsx';
import UserMenu from './UserMenu.tsx';
import AuthModal from './AuthModal.tsx';
import WaitlistModal from './WaitlistModal.tsx';
import ChatWidget from './ChatWidget.tsx';
import { useAuth } from '../lib/auth';
import { getUserMessageCount, MAX_USER_MESSAGES, hasUnlimitedMessages } from '../lib/chatStorage';
import { getInfluencerBySlug, getSeriesForInfluencer, setSeriesCatalog } from '../lib/influencerMapping';
import { getCharacterAvatar } from '../lib/characters';
import { SERIES_CATALOG } from '../App';
import { trackPageView, trackVideoStart, updateVideoProgress, trackVideoEnd } from '../lib/analytics';

// Character Avatar Component
const CharacterDP: React.FC<{ src: string, name: string, theme: 'blue' | 'pink' | 'purple' | 'cyan' | 'green', size?: string, isOnline?: boolean }> = ({ src, name, theme, size = "w-16 h-16", isOnline = true }) => {
  const [error, setError] = useState(false);
  const borderColor = 
    theme === 'blue' ? 'border-blue-500' : 
    theme === 'pink' ? 'border-pink-500' : 
    theme === 'purple' ? 'border-violet-500' : 
    theme === 'cyan' ? 'border-cyan-400' :
    'border-emerald-400';
  const bgColor = 
    theme === 'blue' ? 'bg-blue-600/30' : 
    theme === 'pink' ? 'bg-pink-600/30' : 
    theme === 'purple' ? 'bg-violet-600/30' : 
    theme === 'cyan' ? 'bg-cyan-600/30' :
    'bg-emerald-600/30';

  return (
    <div className={`relative ${size} rounded-full flex items-center justify-center p-0.5 border-2 shadow-2xl transition-all duration-300 group-hover:scale-105 ${borderColor} ${bgColor}`}>
      {isOnline && <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-[#0a0a0f] rounded-full animate-pulse shadow-[0_0_12px_#10b981] z-30" />}
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
        {!error ? (
          <img 
            src={src} 
            alt={name} 
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <span className="text-xl font-black text-white">{name[0]}</span>
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
}> = ({ episode, series, influencerName, influencerTheme, isActive, isMuted, toggleMute, onEnterStory, onNextEpisode, isChatOpen = false }) => {
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
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }

      return () => {
        endVideoSession(false);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      };
    } else {
      video.pause();
      video.preload = "none";
      endVideoSession(false);
      
      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
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
    // Only trigger auto-scroll if video ended AND is currently active AND we haven't already triggered it
    if (isEnded && isActive && !hasTriggeredNextScroll.current) {
      hasTriggeredNextScroll.current = true; // Mark as triggered to prevent multiple calls
      
      // End analytics session if available
      if (analyticsRecordId.current) {
        endVideoSession(true);
      }
      
      // Auto-scroll to next video immediately when video ends
      const timeoutId = setTimeout(() => {
        // Double-check we're still active before scrolling
        if (isActive) {
          onNextEpisode();
        }
      }, 500); // Short delay to ensure smooth transition
      
      return () => clearTimeout(timeoutId);
    }
  }, [isEnded, isActive, onNextEpisode]);

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
    <div ref={containerRef} className="reel-item flex items-center justify-center overflow-hidden bg-[#0a0a0f]">
      <video
        ref={videoRef}
        src={episode.url}
        preload={isActive ? "auto" : "none"}
        className={`w-full h-full object-cover transition-all duration-1000 ${isEnded ? 'scale-105 blur-3xl opacity-40' : 'opacity-100'}`}
        playsInline
        muted={isMuted}
        onEnded={() => {
          setIsEnded(true);
        }}
        onLoadStart={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
        onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
      />


        {loading && !isEnded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/60 backdrop-blur-md z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin shadow-[0_0_20px_rgba(139,92,246,0.3)]" />
              <p className="text-[9px] font-black tracking-[0.4em] uppercase text-white/40">Loading Scene...</p>
            </div>
          </div>
        )}


      {loading && !isEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/60 backdrop-blur-md z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin shadow-[0_0_20px_rgba(139,92,246,0.3)]" />
            <p className="text-[9px] font-black tracking-[0.4em] uppercase text-white/40">Loading Scene...</p>
          </div>
        </div>
      )}

      {!isEnded && (
        <>
          <div className={`absolute bottom-24 left-6 pointer-events-none z-50 transition-opacity duration-500 ${isUIHidden ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[2px] w-6 bg-violet-500 rounded-full shadow-[0_0_8px_#8b5cf6]" />
              <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white/90 drop-shadow-md">{episode.label}</span>
            </div>
            <p className="text-white text-xs font-medium opacity-60 max-w-[200px] leading-tight drop-shadow-lg">{series.reelHint || 'Roleplay with the characters to change their destiny'}</p>
          </div>

          <div className="absolute right-4 bottom-24 flex flex-col items-end gap-4 z-[100] pointer-events-auto max-w-[280px]">
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
              className={`flex flex-col items-center gap-1.5 active:scale-90 transition-all group mb-2 transition-opacity duration-500 ${isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <div className="w-12 h-12 rounded-full bg-[#1a1a24]/80 backdrop-blur-xl border border-violet-500/20 flex items-center justify-center text-white shadow-2xl transition-all group-hover:bg-violet-500/20 group-hover:border-violet-500/40">
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
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <div className="relative group animate-chat-pulse">
                  {/* Speech Bubble */}
                  {isActive && !isEnded && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-full z-50 transition-all duration-500 ease-in-out pointer-events-none" style={{ opacity: 1 }}>
                      <div className={`relative bg-violet-500/80 backdrop-blur-sm rounded-[18px] px-3.5 py-2 shadow-lg transition-all duration-500 ease-in-out ${isUIHidden ? 'max-w-[240px]' : 'max-w-[60px]'}`}>
                        <div className="text-white text-[12px] font-medium leading-tight transition-all duration-500 ease-in-out whitespace-nowrap flex items-center gap-0.5">
                          {isUIHidden ? 'Talk to me now!' : (
                            <>
                              <span className="inline-block dot-bounce-1">.</span>
                              <span className="inline-block dot-bounce-2">.</span>
                              <span className="inline-block dot-bounce-3">.</span>
                            </>
                          )}
                        </div>
                        {/* Tail pointing right from the bubble toward the icon - center aligned with DP */}
                        <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full w-0 h-0 border-l-[8px] border-t-[6px] border-b-[6px] border-l-violet-500/80 border-t-transparent border-b-transparent transition-all duration-500"></div>
                      </div>
                    </div>
                  )}
                   <div className="absolute inset-0 rounded-full blur-xl bg-gradient-to-r from-violet-500/60 to-blue-500/60 animate-pulse-glow" />
                   <div className="absolute inset-[-4px] rounded-full border-2 border-violet-400/50 animate-ring-pulse" />
                   <div className={`absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-60 transition-opacity ${influencerTheme === 'blue' ? 'bg-blue-500' : influencerTheme === 'cyan' ? 'bg-cyan-400' : influencerTheme === 'green' ? 'bg-emerald-400' : 'bg-violet-500'}`} />
                   <CharacterDP 
                    src={series.avatars[influencerName]} 
                    name={influencerName} 
                    theme="purple"
                    size="w-14 h-14"
                    isOnline={false}
                   />
                </div>
              </div>
            ))}
          </div>
        </>
      )}


      {!isEnded && (
        <div className={`absolute bottom-0 left-0 right-0 z-[70] pt-20 group/scrubber transition-all pointer-events-none transition-opacity duration-500 ${isUIHidden ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a0f]/90 to-transparent h-24 pointer-events-none" />
          <div className={`relative px-6 pb-6 transition-all duration-300 ${isScrubbing ? 'translate-y-[-10px]' : 'translate-y-0'}`}>
            <div className="relative h-6 flex items-center">
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
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-75 pointer-events-none ${isScrubbing ? 'shadow-[0_0_15px_#8b5cf6]' : ''}`} 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className={`mt-1.5 flex justify-between items-center transition-all duration-500 ${isScrubbing ? 'opacity-100' : 'opacity-40'}`}>
              <div className="text-[9px] font-black text-white tracking-[0.2em] uppercase tabular-nums">
                <span className="text-violet-400">{formatTime(currentTime)}</span> / {formatTime(duration)}
              </div>
              <div className="text-[8px] font-black text-white/40 tracking-[0.3em] uppercase">Inscene Rhythm Engine</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CHARCOAL_GRADIENT = 'linear-gradient(135deg, #0a0a0f 0%, #121218 50%, #0a0a0f 100%)';

const InfluencerPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [chatData, setChatData] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [isCloseButtonHidden, setIsCloseButtonHidden] = useState(false);
  const closeButtonInactivityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonActivityHandlerRef = React.useRef<((event?: Event) => void) | null>(null);
  const closeButtonMouseMoveHandlerRef = React.useRef<((event?: Event) => void) | null>(null);
  const lastCloseButtonMouseMoveTimeRef = React.useRef<number>(0);

  // Initialize series catalog
  useEffect(() => {
    setSeriesCatalog(SERIES_CATALOG);
  }, []);

  const influencer = slug ? getInfluencerBySlug(slug) : null;
  const series = slug ? getSeriesForInfluencer(slug) : null;

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

  // Filter episodes to only show those with this influencer
  const influencerEpisodes = series?.episodes?.filter((ep: any) => 
    ep.triggers?.some((t: any) => t.char === influencer?.name)
  ) || [];

  // Handler to scroll to next episode with debounce to prevent multiple rapid calls
  const nextEpisodeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNextEpisode = useCallback(() => {
    // Clear any pending scroll
    if (nextEpisodeTimeoutRef.current) {
      clearTimeout(nextEpisodeTimeoutRef.current);
    }
    
    // Debounce the scroll to prevent rapid calls
    nextEpisodeTimeoutRef.current = setTimeout(() => {
      if (selectedEpisodeIndex !== null && activeIdx < influencerEpisodes.length - 1) {
        const nextIdx = activeIdx + 1;
        const nextEl = document.querySelector(`[data-index="${nextIdx}"]`);
        
        if (nextEl) {
          // Use scrollIntoView with smooth behavior
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Update active index immediately so the next video starts playing
          setActiveIdx(nextIdx);
        }
      }
      nextEpisodeTimeoutRef.current = null;
    }, 100);
  }, [selectedEpisodeIndex, activeIdx, influencerEpisodes.length]);

  // Set up IntersectionObserver for reel scrolling and scroll to selected episode
  useEffect(() => {
    if (selectedEpisodeIndex !== null) {
      // Scroll to the selected episode
      const timer = setTimeout(() => {
        const targetEl = document.querySelector(`[data-index="${selectedEpisodeIndex}"]`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'instant' });
          setActiveIdx(selectedEpisodeIndex);
        }
      }, 100);

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setActiveIdx(index);
          }
        });
      }, { threshold: 0.6 });
      
      const observerTimer = setTimeout(() => {
        document.querySelectorAll('.reel-item-wrapper').forEach(i => observer.observe(i));
      }, 300);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(observerTimer);
        observer.disconnect();
      };
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

  if (!influencer || !series) {
    return (
      <div className="flex flex-col min-h-[100dvh] h-[100dvh] text-white overflow-hidden items-center justify-center" style={{ background: CHARCOAL_GRADIENT }}>
        <h1 className="text-2xl font-black mb-4">Influencer not found</h1>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-violet-500 rounded-full">
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] h-[100dvh] text-white overflow-y-auto" style={{ background: CHARCOAL_GRADIENT }}>
      <header className="fixed top-0 left-0 right-0 z-[1000] px-6 py-6 transition-all duration-500 bg-gradient-to-b from-[#0a0a0f]/90 to-transparent">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform" onClick={() => navigate('/')}>
            <Logo size={28} isPulsing={false} />
            <span className="text-white/60 text-sm font-medium">Home</span>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu onSignInClick={() => setIsAuthModalOpen(true)} />
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto w-full">
        {/* Influencer Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-12">
          <CharacterDP 
            src={influencer.avatar} 
            name={influencer.name} 
            theme="purple"
            size="w-32 h-32"
            isOnline={false}
          />
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-2">{influencer.name}</h1>
            <p className="text-violet-400/80 text-lg font-medium mb-4">{series.title}</p>
            <p className="text-white/60 text-sm max-w-2xl">{influencer.description}</p>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {influencerEpisodes.map((ep: any) => {
            const thumbnailUrl = series.thumbnail; // Using series thumbnail as fallback
            return (
              <div
                key={ep.id}
                onClick={() => {
                  const index = influencerEpisodes.findIndex(e => e.id === ep.id);
                  setSelectedEpisodeIndex(index);
                }}
                className="group cursor-pointer relative aspect-[9/16] rounded-[1.5rem] overflow-hidden border border-violet-500/20 shadow-2xl transition-all hover:border-violet-500/50 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] active:scale-95 bg-[#1a1a24]"
              >
                {/* Video thumbnail or placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
                  {thumbnailUrl && (
                    <img 
                      src={thumbnailUrl} 
                      alt={ep.label} 
                      className="w-full h-full object-cover opacity-50"
                    />
                  )}
                </div>
                
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#0a0a0f]/40">
                  <div className="w-8 h-8 rounded-full bg-violet-500/80 backdrop-blur-md border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Episode label */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0f]/90 to-transparent">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-[2px] w-6 bg-violet-500 rounded-full shadow-[0_0_8px_#8b5cf6]" />
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white/90">{ep.label}</span>
                  </div>
                  <p className="text-white/60 text-xs font-medium line-clamp-2">{series.reelHint || 'Click to watch'}</p>
                </div>
              </div>
            );
          })}
        </div>

        {influencerEpisodes.length === 0 && (
          <div className="text-center py-20 text-white/40">
            <p className="text-lg">No videos available for {influencer.name}</p>
          </div>
        )}
      </main>

      {/* Video Reel Player */}
      {selectedEpisodeIndex !== null && (
        <div className={`fixed inset-0 ${chatData ? 'z-[4000]' : 'z-[5000]'} bg-[#0a0a0f]`}>
          {/* Close button */}
          <button
            onClick={() => {
              setIsCloseButtonHidden(false);
              if (closeButtonInactivityTimerRef.current) {
                clearTimeout(closeButtonInactivityTimerRef.current);
                closeButtonInactivityTimerRef.current = setTimeout(() => {
                  setIsCloseButtonHidden(true);
                }, 5000);
              }
              setSelectedEpisodeIndex(null);
            }}
            className={`absolute top-6 left-6 z-[6000] w-12 h-12 rounded-full bg-[#1a1a24]/80 backdrop-blur-xl border border-violet-500/20 flex items-center justify-center text-white shadow-2xl transition-all hover:bg-violet-500/20 transition-opacity duration-500 ${isCloseButtonHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="reel-snap-container fixed inset-0 z-[5000] hide-scrollbar overflow-y-scroll snap-y snap-mandatory">
            {influencerEpisodes.map((ep: any, i: number) => (
              <div key={ep.id} data-index={i} className="reel-item-wrapper reel-item snap-start h-[100dvh]">
                <ReelItem 
                  episode={ep} 
                  series={series} 
                  influencerName={influencer.name}
                  influencerTheme={influencer.theme}
                  isActive={activeIdx === i} 
                  isMuted={isMuted} 
                  toggleMute={() => setIsMuted(!isMuted)} 
                  onEnterStory={(char, intro, hook, entryPoint) => {
                    handleChatInit({
                      char, intro, hook, 
                      isFromHistory: false, 
                      isWhatsApp: false,
                      entryPoint,
                      seriesId: series.id,
                      seriesTitle: series.title,
                      episodeId: ep.id,
                      episodeLabel: ep.label
                    });
                  }}
                  onNextEpisode={handleNextEpisode}
                  isChatOpen={!!chatData}
                />
              </div>
            ))}
          </div>
        </div>
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
        />
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      <WaitlistModal 
        isOpen={isWaitlistModalOpen} 
        onClose={() => setIsWaitlistModalOpen(false)} 
      />

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes slideUpSide {
          from { transform: translateY(30px) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-slide-up-side {
          animation: slideUpSide 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes pulseGlow { 
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.08); }
        }
        .animate-pulse-glow { animation: pulseGlow 1.5s ease-in-out infinite; }
        @keyframes chatPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        .animate-chat-pulse { animation: chatPulse 2s ease-in-out infinite; }
        @keyframes ringPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .animate-ring-pulse { animation: ringPulse 2s ease-in-out infinite; }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .dot-bounce-1 { animation: dotBounce 1.2s ease-in-out infinite; }
        .dot-bounce-2 { animation: dotBounce 1.2s ease-in-out infinite 0.2s; }
        .dot-bounce-3 { animation: dotBounce 1.2s ease-in-out infinite 0.4s; }
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
        .scrub-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; border: 2px solid #8b5cf6; box-shadow: 0 0 10px rgba(139, 92, 246, 0.5); cursor: pointer; }
      `}</style>
    </div>
  );
};

export default InfluencerPage;

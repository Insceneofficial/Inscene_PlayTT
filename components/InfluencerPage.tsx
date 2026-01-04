import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Logo from './Logo.tsx';
import ChatPanel from './ChatPanel.tsx';
import UserMenu from './UserMenu.tsx';
import AuthModal from './AuthModal.tsx';
import WaitlistModal from './WaitlistModal.tsx';
import { useAuth } from '../lib/auth';
import { getUserMessageCount, MAX_USER_MESSAGES } from '../lib/chatStorage';
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

// Video Player Component
const VideoPlayer: React.FC<{
  episode: any;
  series: any;
  influencerName: string;
  influencerTheme: 'blue' | 'pink' | 'purple' | 'cyan' | 'green';
  onEnterStory: (char: string, intro: string, hook: string, entryPoint: string) => void;
  onClose: () => void;
}> = ({ episode, series, influencerName, influencerTheme, onEnterStory, onClose }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Analytics tracking
  const analyticsRecordId = React.useRef<string | null>(null);
  const trackVideoStartPromise = React.useRef<Promise<string | null> | null>(null);
  const progressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const seekCountRef = React.useRef(0);
  const pauseCountRef = React.useRef(0);
  const wasUnmutedRef = React.useRef(false);
  const initialMutedRef = React.useRef(isMuted);
  const isEndingSession = React.useRef(false);
  const sessionStartTime = React.useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Auto-play when component mounts
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.then(() => setIsPlaying(true)).catch(() => {});
    }

    // Start analytics
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
      });
    }

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

    return () => {
      if (video) {
        video.pause();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

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
    if (isEnded && analyticsRecordId.current) {
      endVideoSession(true);
    }
  }, [isEnded]);

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
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        pauseCountRef.current += 1;
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const influencerTriggers = episode.triggers?.filter((t: any) => t.char === influencerName) || [];

  return (
    <div className="fixed inset-0 z-[5000] bg-[#0a0a0f] flex items-center justify-center">
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          src={episode.url}
          className="w-full h-full object-contain"
          playsInline
          muted={isMuted}
          onEnded={() => setIsEnded(true)}
          onLoadStart={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => pauseCountRef.current += 1}
          onClick={handlePlayPause}
        />

        {/* Close button */}
        <button
          onClick={() => {
            endVideoSession(false);
            onClose();
          }}
          className="absolute top-6 right-6 w-12 h-12 rounded-full bg-[#1a1a24]/80 backdrop-blur-xl border border-violet-500/20 flex items-center justify-center text-white shadow-2xl transition-all hover:bg-violet-500/20 z-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading && !isEnded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/60 backdrop-blur-md z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin shadow-[0_0_20px_rgba(139,92,246,0.3)]" />
              <p className="text-[9px] font-black tracking-[0.4em] uppercase text-white/40">Loading Scene...</p>
            </div>
          </div>
        )}

        {/* Play/Pause overlay */}
        {!isPlaying && !isEnded && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <button
              onClick={handlePlayPause}
              className="w-20 h-20 rounded-full bg-[#1a1a24]/80 backdrop-blur-xl border border-violet-500/20 flex items-center justify-center text-white shadow-2xl transition-all hover:bg-violet-500/20 pointer-events-auto"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 ml-1">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}

        {!isEnded && (
          <>
            {/* Video controls */}
            <div className="absolute bottom-0 left-0 right-0 z-[70] pt-20 group/scrubber transition-all pointer-events-none">
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a0f]/90 to-transparent h-32 pointer-events-none" />
              <div className={`relative px-6 pb-6 transition-all duration-300 ${isScrubbing ? 'translate-y-[-10px]' : 'translate-y-0'}`}>
                <div className="relative h-6 flex items-center mb-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="0.1" 
                    value={progress} 
                    onChange={handleSeek} 
                    onMouseDown={() => setIsScrubbing(true)}
                    onMouseUp={() => setIsScrubbing(false)}
                    className="scrub-range w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer pointer-events-auto z-10" 
                  />
                  <div 
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-75 pointer-events-none ${isScrubbing ? 'shadow-[0_0_15px_#8b5cf6]' : ''}`} 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-[9px] font-black text-white tracking-[0.2em] uppercase tabular-nums">
                    <span className="text-violet-400">{formatTime(currentTime)}</span> / {formatTime(duration)}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                    className="w-10 h-10 rounded-full bg-[#1a1a24]/80 backdrop-blur-xl border border-violet-500/20 flex items-center justify-center text-white shadow-2xl transition-all hover:bg-violet-500/20 pointer-events-auto"
                  >
                    {isMuted ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.535 7.465a.75.75 0 0 1 1.06 0L22.12 10l-2.525 2.525a.75.75 0 1 1-1.06-1.06L20 10l-1.465-1.465a.75.75 0 0 1 0-1.06Z" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06 4.25 4.25 0 0 1 0 6.01.75.75 0 0 0 1.06 1.06 5.75 5.75 0 0 0 0-8.13ZM21.03 5.97a.75.75 0 0 0-1.06 1.06 8.5 8.5 0 0 1 0 12.02.75.75 0 1 0 1.06 1.06 10 10 0 0 0 0-14.14Z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Chat buttons */}
            {influencerTriggers.length > 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-[100] pointer-events-auto">
                {influencerTriggers.map((t: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); onEnterStory(t.char, t.intro, t.hook, 'video_sidebar'); }}
                    className="flex flex-col items-center gap-2 active:scale-95 transition-all group"
                  >
                    <div className="relative group">
                       <div className={`absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-60 transition-opacity ${
                         influencerTheme === 'blue' ? 'bg-blue-500' : 
                         influencerTheme === 'cyan' ? 'bg-cyan-400' : 
                         influencerTheme === 'green' ? 'bg-emerald-400' : 
                         'bg-violet-500'
                       }`} />
                       <CharacterDP 
                        src={series.avatars[influencerName]} 
                        name={influencerName} 
                        theme={influencerTheme} 
                        size="w-14 h-14"
                       />
                    </div>
                    <div className="px-2 py-0.5 rounded-full border border-violet-500/20 bg-[#1a1a24]/80 backdrop-blur-md shadow-xl group-hover:bg-violet-500 group-hover:border-violet-500 transition-all">
                      <span className="text-[6px] font-black uppercase tracking-[0.1em] text-white group-hover:text-white whitespace-nowrap">
                        CHAT {influencerName.toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {isEnded && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-[#0a0a0f]/80 backdrop-blur-3xl animate-fade-in pointer-events-auto">
             <h3 className="text-4xl font-black italic uppercase text-white mb-2 tracking-tighter">End of Scene</h3>
             <p className="text-violet-400/60 text-[10px] font-black tracking-[0.5em] uppercase mb-12">Continue the conversation</p>
             
             <div className="flex flex-col gap-5 mb-16 w-full max-w-[280px]">
               {influencerTriggers.map((t: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => onEnterStory(t.char, t.intro, t.hook, 'video_end_screen')}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1a1a24]/80 border border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/40 transition-all text-left group"
                  >
                    <CharacterDP 
                      src={series.avatars[influencerName]} 
                      name={influencerName} 
                      theme={influencerTheme} 
                      size="w-10 h-10"
                    />
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest text-white/80 group-hover:text-white transition-colors">Chat with {influencerName}</span>
                    </div>
                  </button>
               ))}
             </div>

             <button onClick={onClose} className="flex flex-col items-center gap-4 group">
               <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.4)] active:scale-90 transition-all group-hover:scale-110">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
               </div>
               <span className="text-[9px] font-black tracking-[0.4em] uppercase text-white/30 group-hover:text-violet-400 transition-colors">Close</span>
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CHARCOAL_GRADIENT = 'linear-gradient(135deg, #0a0a0f 0%, #121218 50%, #0a0a0f 100%)';

const InfluencerPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [chatData, setChatData] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);

  // Initialize series catalog
  useEffect(() => {
    setSeriesCatalog(SERIES_CATALOG);
  }, []);

  const influencer = slug ? getInfluencerBySlug(slug) : null;
  const series = slug ? getSeriesForInfluencer(slug) : null;

  // Track page view
  useEffect(() => {
    if (influencer) {
      trackPageView({ viewType: `influencer_page_${influencer.id}` });
    }
  }, [influencer]);

  // Filter episodes to only show those with this influencer
  const influencerEpisodes = series?.episodes?.filter((ep: any) => 
    ep.triggers?.some((t: any) => t.char === influencer?.name)
  ) || [];

  const handleChatInit = async (chatDataConfig: any) => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    
    const messageCount = await getUserMessageCount();
    if (messageCount >= MAX_USER_MESSAGES) {
      setIsWaitlistModalOpen(true);
      return;
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
    <div className="flex flex-col min-h-[100dvh] text-white overflow-hidden" style={{ background: CHARCOAL_GRADIENT }}>
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
            theme={influencer.theme} 
            size="w-32 h-32"
          />
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-2">{influencer.name}</h1>
            <p className="text-violet-400/80 text-lg font-medium mb-4">{series.title}</p>
            <p className="text-white/60 text-sm max-w-2xl">{influencer.description}</p>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {influencerEpisodes.map((ep: any) => {
            const thumbnailUrl = series.thumbnail; // Using series thumbnail as fallback
            return (
              <div
                key={ep.id}
                onClick={() => setSelectedEpisode(ep)}
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
                  <div className="w-16 h-16 rounded-full bg-violet-500/80 backdrop-blur-md border border-violet-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.5)]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white ml-1">
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

      {/* Video Player Modal */}
      {selectedEpisode && !chatData && (
        <VideoPlayer
          episode={selectedEpisode}
          series={series}
          influencerName={influencer.name}
          influencerTheme={influencer.theme}
          onEnterStory={(char, intro, hook, entryPoint) => {
            setSelectedEpisode(null);
            handleChatInit({
              char, intro, hook, 
              isFromHistory: false, 
              isWhatsApp: false,
              entryPoint,
              seriesId: series.id,
              seriesTitle: series.title,
              episodeId: selectedEpisode.id,
              episodeLabel: selectedEpisode.label
            });
          }}
          onClose={() => setSelectedEpisode(null)}
        />
      )}

      {chatData && (
        <ChatPanel 
          character={chatData.char} 
          episodeLabel={chatData.episodeLabel || selectedEpisode?.label || "Inscene History"}
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
        .scrub-range { -webkit-appearance: none; }
        .scrub-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; border: 2px solid #8b5cf6; box-shadow: 0 0 10px rgba(139, 92, 246, 0.5); cursor: pointer; }
      `}</style>
    </div>
  );
};

export default InfluencerPage;

import React, { useState, useEffect, useRef } from 'react';
import Logo from './components/Logo.tsx';
import ChatPanel from './components/ChatPanel.tsx';
import { Analytics } from "@vercel/analytics/react";

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
 * CHARACTER AVATARS
 */
const PRIYANK_AVATAR = "https://lh3.googleusercontent.com/d/16mQvERxp6rIlxOHMTLKoeC_-WxuqxS-C";
const ARZOO_AVATAR = "https://lh3.googleusercontent.com/d/147CA6EL86D7QP1SWhA_XJWRQpQ9VRi8O";
const DEBU_AVATAR = "https://lh3.googleusercontent.com/d/14o-9uKeKJVy9aa0DPMCFA43vP0vJPGM3";
const ANISH_AVATAR = "https://lh3.googleusercontent.com/d/1m_I0IqOX8WtxfMJP1dL2qAxVfpKnAROE";
const CHIRAG_AVATAR = "https://lh3.googleusercontent.com/d/1AQEFvk1ZlB9YclySsOz0QpHkkV6PDir7";

/**
 * Character Avatar Component
 */
const CharacterDP: React.FC<{ src: string, name: string, theme: 'blue' | 'pink' | 'purple' | 'cyan' | 'green', size?: string, isOnline?: boolean }> = ({ src, name, theme, size = "w-16 h-16", isOnline = true }) => {
  const [error, setError] = useState(false);
  const borderColor = 
    theme === 'blue' ? 'border-blue-500' : 
    theme === 'pink' ? 'border-pink-500' : 
    theme === 'purple' ? 'border-purple-500' : 
    theme === 'cyan' ? 'border-cyan-400' :
    'border-emerald-400';
  const bgColor = 
    theme === 'blue' ? 'bg-blue-600/40' : 
    theme === 'pink' ? 'bg-pink-600/40' : 
    theme === 'purple' ? 'bg-purple-600/40' : 
    theme === 'cyan' ? 'bg-cyan-600/40' :
    'bg-emerald-600/40';

  return (
    <div className={`relative ${size} rounded-full flex items-center justify-center p-0.5 border-2 shadow-2xl transition-all duration-300 group-hover:scale-105 ${borderColor} ${bgColor}`}>
      {isOnline && <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-black rounded-full animate-pulse shadow-[0_0_12px_#22c55e] z-30" />}
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

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  onEnterStory: (char: string, intro: string, hook: string) => void,
  onNextEpisode: () => void
}> = ({ episode, series, isActive, isMuted, toggleMute, onEnterStory, onNextEpisode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isActive) {
      setIsEnded(false);
      video.currentTime = 0;
      video.preload = "auto";
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      video.pause();
      video.preload = "none";
    }
  }, [isActive]);

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
    }
  };

  return (
    <div className="reel-item flex items-center justify-center overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={episode.url}
        preload={isActive ? "auto" : "none"}
        className={`w-full h-full object-cover transition-all duration-1000 ${isEnded ? 'scale-105 blur-3xl opacity-40' : 'opacity-100'}`}
        playsInline
        muted={isMuted}
        onEnded={() => setIsEnded(true)}
        onLoadStart={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onTimeUpdate={handleTimeUpdate}
        onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
      />

      {loading && !isEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
            <p className="text-[9px] font-black tracking-[0.4em] uppercase text-white/40">Loading Scene...</p>
          </div>
        </div>
      )}

      {!isEnded && (
        <>
          <div className="absolute bottom-24 left-6 pointer-events-none z-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[2px] w-6 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white/90 drop-shadow-md">{episode.label}</span>
            </div>
            <p className="text-white text-xs font-medium opacity-60 max-w-[200px] leading-tight drop-shadow-lg">{series.reelHint || 'Roleplay with the characters to change their destiny'}</p>
          </div>

          <div className="absolute right-4 bottom-24 flex flex-col items-center gap-8 z-[100] pointer-events-auto">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all group mb-2"
            >
              <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white shadow-2xl transition-all group-hover:bg-white/10">
                {isMuted ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.535 7.465a.75.75 0 0 1 1.06 0L22.12 10l-2.525 2.525a.75.75 0 1 1-1.06-1.06L20 10l-1.465-1.465a.75.75 0 0 1 0-1.06Z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06 4.25 4.25 0 0 1 0 6.01.75.75 0 0 0 1.06 1.06 5.75 5.75 0 0 0 0-8.13ZM21.03 5.97a.75.75 0 0 0-1.06 1.06 8.5 8.5 0 0 1 0 12.02.75.75 0 1 0 1.06 1.06 10 10 0 0 0 0-14.14Z" /></svg>
                )}
              </div>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60 group-hover:text-white">Mute</span>
            </button>

            {episode.triggers.map((t: any, idx: number) => (
              <button 
                key={idx}
                onClick={(e) => { e.stopPropagation(); onEnterStory(t.char, t.intro, t.hook); }}
                className="flex flex-col items-center gap-2 active:scale-95 transition-all group animate-slide-up-side"
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <div className="relative group">
                   <div className={`absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-60 transition-opacity ${t.char === 'Priyank' ? 'bg-blue-500' : t.char === 'Arzoo' ? 'bg-pink-500' : t.char === 'Anish' ? 'bg-cyan-400' : t.char === 'Chirag' ? 'bg-emerald-400' : 'bg-purple-500'}`} />
                   <CharacterDP 
                    src={series.avatars[t.char]} 
                    name={t.char} 
                    theme={t.char === 'Priyank' ? 'blue' : t.char === 'Arzoo' ? 'pink' : t.char === 'Anish' ? 'cyan' : t.char === 'Chirag' ? 'green' : 'purple'} 
                    size="w-14 h-14"
                   />
                </div>
                <div className={`px-2 py-0.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md shadow-xl group-hover:bg-white group-hover:border-white transition-all`}>
                  <span className="text-[6px] font-black uppercase tracking-[0.1em] text-white group-hover:text-black whitespace-nowrap">
                    CHAT {t.char.toUpperCase()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {isEnded && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-black/60 backdrop-blur-3xl animate-fade-in pointer-events-auto">
           <h3 className="text-4xl font-black italic uppercase text-white mb-2 tracking-tighter">End of Scene</h3>
           <p className="text-white/40 text-[10px] font-black tracking-[0.5em] uppercase mb-12">Pick your path</p>
           
           <div className="flex flex-col gap-5 mb-16 w-full max-w-[280px]">
             {episode.triggers.map((t: any, idx: number) => (
                <button 
                  key={idx}
                  onClick={() => onEnterStory(t.char, t.intro, t.hook)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left group"
                >
                  <CharacterDP 
                    src={series.avatars[t.char]} 
                    name={t.char} 
                    theme={t.char === 'Priyank' ? 'blue' : t.char === 'Arzoo' ? 'pink' : t.char === 'Anish' ? 'cyan' : t.char === 'Chirag' ? 'green' : 'purple'} 
                    size="w-10 h-10"
                  />
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-white/80 group-hover:text-white transition-colors">Chat with {t.char}</span>
                  </div>
                </button>
             ))}
           </div>

           <button onClick={onNextEpisode} className="flex flex-col items-center gap-4 group">
             <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-90 transition-all group-hover:scale-110">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>
             </div>
             <span className="text-[9px] font-black tracking-[0.4em] uppercase text-white/30 group-hover:text-white/80 transition-colors">Next Episode</span>
           </button>
        </div>
      )}

      {!isEnded && (
        <div className="absolute bottom-0 left-0 right-0 z-[70] pt-20 group/scrubber transition-all pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent h-24 pointer-events-none" />
          <div className={`relative px-6 pb-6 transition-all duration-300 ${isScrubbing ? 'translate-y-[-10px]' : 'translate-y-0'}`}>
            <div className="relative h-6 flex items-center">
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="0.1" 
                value={progress} 
                onChange={handleSeek} 
                onMouseDown={() => setIsScrubbing(true)}
                onMouseUp={() => setIsScrubbing(false)}
                onTouchStart={() => setIsScrubbing(true)}
                onTouchEnd={() => setIsScrubbing(false)}
                className="scrub-range w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer pointer-events-auto z-10" 
              />
              <div 
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded-full transition-all duration-75 pointer-events-none ${isScrubbing ? 'shadow-[0_0_15px_#3b82f6]' : ''}`} 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className={`mt-1.5 flex justify-between items-center transition-all duration-500 ${isScrubbing ? 'opacity-100' : 'opacity-40'}`}>
              <div className="text-[9px] font-black text-white tracking-[0.2em] uppercase tabular-nums">
                <span className="text-blue-400">{formatTime(currentTime)}</span> / {formatTime(duration)}
              </div>
              <div className="text-[8px] font-black text-white/40 tracking-[0.3em] uppercase">Inscene Rhythm Engine</div>
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
const SERIES_CATALOG = [
  {
    id: 'heart-beats',
    title: 'Heart Beats',
    tagline: 'Interactive Drama',
    thumbnail: getSmartImageUrl("https://lh3.googleusercontent.com/d/11oMmLSZFpeZsoGxw2uV_bPEWJB4-fvDx", "thumb_v4", 400, 400),
    accentColor: '#3b82f6',
    reelHint: 'Roleplay with the characters to change their destiny',
    avatars: {
      Priyank: PRIYANK_AVATAR,
      Arzoo: ARZOO_AVATAR
    },
    episodes: [
      { 
        id: 1, 
        label: "Episode 01", 
        url: "https://github.com/rajatboss1/plivetv/releases/download/Video/Heart.Beats.Episode.2.mp4", 
        triggers: [
          { char: 'Priyank', intro: "Hey, itni jaldi kahan ja rahi ho? 😉", hook: "We just met at Lodhi Garden. You are walking away." }, 
          { char: 'Arzoo', intro: "Excuse me? Follow kar rahe ho kya? 🤨", hook: "Catching Priyank following me at Lodhi Garden." }
        ] 
      },
      { 
        id: 2, 
        label: "Episode 02", 
        url: "https://github.com/rajatboss1/plivetv/releases/download/Video/Heart.Beats.Episode.1.mp4", 
        triggers: [
          { char: 'Priyank', intro: "Lizard wala joke bura tha kya? 😂", hook: "After the awkward lizard joke during tiffin." }, 
          { char: 'Arzoo', intro: "Seriously? Itna ghatiya joke... 🙄", hook: "Responding to Priyank's weird lizard pickup line." }
        ] 
      },
      { 
        id: 3, 
        label: "Episode 03", 
        url: "https://github.com/rajatboss1/plivetv/releases/download/Video/Heart.Beats.Episode.3.mp4", 
        triggers: [
          { char: 'Priyank', intro: "Wait, main explain kar sakta hoon! 😟", hook: "Trying to stop Arzoo after she sees him with another girl." }, 
          { char: 'Arzoo', intro: "Ab kya explain karoge? Sab dekh liya maine. 😡", hook: "Angry and walking away after a misunderstanding." }
        ] 
      },
      { 
        id: 4, 
        label: "Episode 04", 
        url: "https://github.com/rajatboss1/plivetv/releases/download/Video/Heart.Beats.Episode.4.mp4", 
        triggers: [
          { char: 'Priyank', intro: "Peace offering? ☕️", hook: "Approaching Arzoo in the rain with a hot tea." }, 
          { char: 'Arzoo', intro: "Extra shakkar honi chahiye... 😌", hook: "Softening up after Priyank's sincere effort." }
        ] 
      }
    ]
  },
  {
    id: 'startup-boy-anish',
    title: 'Startup Boy Anish',
    tagline: 'Insayy Journey',
    thumbnail: getSmartImageUrl("https://lh3.googleusercontent.com/d/1FKR6HevmeSv1baTCUtfi5CWQo8FO0QAf", "anish_thumb_v1", 400, 400),
    accentColor: '#22d3ee',
    reelHint: 'Ask Anish about Insayy startup life',
    avatars: {
      Anish: ANISH_AVATAR
    },
    episodes: [
      { 
        id: 1, 
        label: "Phase 1", 
        url: "https://github.com/Insceneofficial/ai-studio-demo-assets/releases/download/Video/Anish_Ep1.mp4", 
        triggers: [
          { char: 'Anish', intro: "Yo! Ready to start something big or just testing the waters? Startup life is brutal bro.", hook: "Validation and readiness phase. Assessing if the user is ready to bootstrap or fundraise." }
        ] 
      },
      { 
        id: 2, 
        label: "Phase 2", 
        url: "https://github.com/Insceneofficial/ai-studio-demo-assets/releases/download/Video/Anish_Ep2.mp4", 
        triggers: [
          { char: 'Anish', intro: "Core roles decide everything. What's your real strength? Tech or Sales?", hook: "Mapping responsibilities and finding a co-founder with the right fit." }
        ] 
      },
      { 
        id: 3, 
        label: "Phase 3", 
        url: "https://github.com/Insceneofficial/ai-studio-demo-assets/releases/download/Video/Anish_Ep3.mp4", 
        triggers: [
          { char: 'Anish', intro: "Gemini and OpenAI are massive, but we need to find our niche. What's our moat?", hook: "Differentiating from giants. Identifying a defensible advantage in the AI space." }
        ] 
      },
      { 
        id: 4, 
        label: "Phase 4", 
        url: "https://github.com/Insceneofficial/ai-studio-demo-assets/releases/download/Video/Anish_Ep4.mp4", 
        triggers: [
          { char: 'Anish', intro: "Idea is cheap, execution is everything. What are we building in the next 14 days?", hook: "Clarifying the core problem and defining immediate next steps." }
        ] 
      },
      { 
        id: 5, 
        label: "Phase 5", 
        url: "https://github.com/Insceneofficial/ai-studio-demo-assets/releases/download/Video/Anish_Ep5.mp4", 
        triggers: [
          { char: 'Anish', intro: "Pivot or Patience? Big question. Sometimes you gotta build a lean team first.", hook: "Decision making on pivots and building an early team with limited resources." }
        ] 
      }
    ]
  },
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
        url: "https://github.com/Insceneofficial/ai-studio-demo-assets/releases/download/Video/FitMonk.Chirag._Ep0_Demo.mp4", 
        triggers: [
          { char: 'Chirag', intro: "Ready to dominate the pitch? Fitness is 70% of the game. What's holding you back?", hook: "Athlete coaching session focused on cricket performance and doubt clearing." }
        ] 
      }
    ]
  },
  {
    id: 'deb-filmmaker',
    title: 'Debu',
    tagline: 'Growth Path',
    thumbnail: getSmartImageUrl("https://lh3.googleusercontent.com/d/1BGjtlHgMy4BToZJQ-eOhr-UpH82LOMVh", "deb_thumb_v1", 400, 400),
    accentColor: '#a855f7',
    reelHint: 'Ask Debu your questions',
    avatars: {
      Debu: DEBU_AVATAR
    },
    episodes: [
      { 
        id: 1, 
        label: "Scene 01", 
        url: "https://github.com/rajatboss1/DebuTv_videostorange/releases/download/video/Episode1_Debu.mp4", 
        triggers: [
          { char: 'Debu', intro: "Welcome. Before we ever touch a camera, we must sharpen the mind. Tell me, what draws you to cinema?", hook: "Assessment of the user's cinematic palate." }
        ] 
      },
      { 
        id: 2, 
        label: "Scene 02", 
        url: "https://github.com/rajatboss1/DebuTv_videostorange/releases/download/video/Episode2_Debu.mp4", 
        triggers: [
          { char: 'Debu', intro: "Composition is the skeleton of a shot. How do you frame a soul without losing the context?", hook: "Lesson on the philosophy of framing and composition." }
        ] 
      },
      { 
        id: 3, 
        label: "Scene 03", 
        url: "https://github.com/rajatboss1/DebuTv_videostorange/releases/download/video/Episode3_Debu.mp4", 
        triggers: [
          { char: 'Debu', intro: "The edit is where the story is truly born. Do you have the courage to kill your darlings?", hook: "Deep dive into the ruthlessness of the editing process." }
        ] 
      }
    ]
  }
];

const SIGNATURE_GRADIENT = 'radial-gradient(circle at top left, #1e3a8a 0%, #020617 40%, #581c87 80%, #7e22ce 100%)';

interface ConversationHistoryEntry {
  messages: any[];
  character: string;
  avatar: string;
  lastUpdate: number;
}

const App: React.FC = () => {
  const [selectedSeries, setSelectedSeries] = useState<any>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [chatData, setChatData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'For you' | 'Grow with me' | 'Dream World'>('For you');
  const [currentView, setCurrentView] = useState<'discover' | 'chats'>('discover');
  const [choiceModalData, setChoiceModalData] = useState<any>(null);
  
  const [conversations, setConversations] = useState<Record<string, ConversationHistoryEntry>>({});

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

  const handleNext = () => {
    const nextIdx = (activeIdx + 1) % selectedSeries.episodes.length;
    const nextEl = document.querySelector(`[data-index="${nextIdx}"]`);
    if (nextEl) {
      nextEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const filteredCatalog = SERIES_CATALOG.filter(series => {
    if (activeTab === 'For you') return true;
    if (activeTab === 'Grow with me') return series.id === 'deb-filmmaker' || series.id === 'startup-boy-anish' || series.id === 'cricket-coaching';
    if (activeTab === 'Dream World') return series.id === 'heart-beats';
    return true;
  });

  const handleChatUpdate = (char: string, messages: any[]) => {
    setConversations(prev => ({
      ...prev,
      [char]: {
        ...prev[char],
        character: char,
        messages: messages,
        avatar: prev[char]?.avatar || 
          (char === 'Debu' ? DEBU_AVATAR : 
           char === 'Priyank' ? PRIYANK_AVATAR : 
           char === 'Arzoo' ? ARZOO_AVATAR : 
           char === 'Anish' ? ANISH_AVATAR : 
           CHIRAG_AVATAR),
        lastUpdate: Date.now()
      }
    }));
  };

  return (
    <div className="flex flex-col min-h-[100dvh] h-[100dvh] text-white overflow-hidden" style={{ background: currentView === 'chats' ? '#ffffff' : SIGNATURE_GRADIENT }}>
      <header className={`fixed top-0 left-0 right-0 z-[1000] px-6 py-6 transition-all duration-500 ${selectedSeries ? 'bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center' : 'bg-transparent flex justify-center'} ${currentView === 'chats' ? 'hidden' : ''}`}>
        {selectedSeries ? (
          <>
            <div className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform" onClick={() => { setSelectedSeries(null); setChatData(null); }}>
              <Logo size={28} isPulsing={false} />
            </div>
            <button onClick={() => setSelectedSeries(null)} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 flex items-center justify-center active:scale-90 hover:bg-white/20 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center">
             <div className="w-12 h-12 flex items-center justify-center bg-white/5 backdrop-blur-xl rounded-full border border-white/10 animate-pulse">
               <Logo size={24} isPulsing={false} />
             </div>
          </div>
        )}
      </header>

      {!selectedSeries && (
        <main className={`flex-1 overflow-y-auto hide-scrollbar ${currentView === 'chats' ? 'pt-0 pb-20' : 'pt-24 pb-28 px-6 animate-slide-up'}`}>
          {currentView === 'discover' ? (
            <div className="flex flex-col gap-6 max-w-lg mx-auto">
              <div className="flex items-center gap-6 pb-2 border-b border-white/5 overflow-x-auto hide-scrollbar">
                {(['For you', 'Grow with me', 'Dream World'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap ${activeTab === tab ? 'text-white' : 'text-white/20 hover:text-white/50'}`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-6 pt-4">
                {filteredCatalog.map(series => (
                  <div 
                    key={series.id}
                    onClick={() => setChoiceModalData(series)}
                    className="flex flex-col items-center gap-3 group cursor-pointer"
                  >
                    <div className="relative w-full aspect-square rounded-[1.5rem] overflow-hidden border border-white/10 shadow-2xl transition-all group-hover:border-blue-400 group-hover:scale-105 active:scale-95">
                      <img src={series.thumbnail} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center">
                           <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                         </div>
                      </div>
                    </div>
                    <div className="text-center px-1">
                      <p className="text-[10px] font-black uppercase tracking-tight text-white/90 group-hover:text-blue-400 transition-colors truncate w-full">{series.title}</p>
                      <p className="text-[7px] font-bold uppercase tracking-widest text-white/20 truncate">{series.tagline}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full bg-white relative">
              {/* WhatsApp Style Header (Simplified for request) */}
              <div className="bg-[#075E54] text-white pt-10 px-6 pb-4 shadow-md">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-medium tracking-wide">Chats</h1>
                  <div className="flex items-center gap-5">
                    <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                    </button>
                    <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2 s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat List Area */}
              <div className="flex-1 overflow-y-auto pt-1 bg-white">
                {Object.keys(conversations).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in text-slate-400">
                    <h3 className="text-lg font-medium mb-1">Your inbox is quiet</h3>
                    <p className="text-sm px-10">Messages from characters you interact with will appear here.</p>
                  </div>
                ) : (
                  (Object.values(conversations) as ConversationHistoryEntry[])
                    .sort((a, b) => b.lastUpdate - a.lastUpdate)
                    .map((conv, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setChatData({ 
                          char: conv.character, 
                          avatar: conv.avatar, 
                          history: conv.messages,
                          isFromHistory: true,
                          isWhatsApp: true
                        })}
                        className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer group"
                      >
                        <div className="relative w-[54px] h-[54px] rounded-full overflow-hidden bg-slate-100 border border-slate-50">
                           <img src={conv.avatar} alt={conv.character} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 border-b border-slate-100 pb-4 flex flex-col justify-center min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h4 className="text-[17px] font-bold text-[#111] leading-tight truncate">{conv.character}</h4>
                            <span className="text-[11px] font-medium text-[#25D366] whitespace-nowrap ml-2">
                              {new Date(conv.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-[14px] text-[#666] truncate pr-4 font-normal leading-tight">
                              {conv.messages[conv.messages.length - 1]?.content || 'Tap to chat'}
                            </p>
                            <div className="bg-[#25D366] text-white rounded-full min-w-[20px] h-5 flex items-center justify-center text-[10px] font-bold px-1.5 shadow-sm">
                               1
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Floating Action Button */}
              <button 
                onClick={() => setCurrentView('discover')}
                className="fixed bottom-24 right-6 w-16 h-16 bg-[#25D366] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.2)] flex items-center justify-center text-white active:scale-90 transition-transform z-[1002]"
              >
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-5H6V7h12v2z"/></svg>
              </button>
            </div>
          )}
        </main>
      )}

      {selectedSeries && !chatData && (
        <div className="reel-snap-container fixed inset-0 z-[500] hide-scrollbar overflow-y-scroll snap-y snap-mandatory">
          {selectedSeries.episodes.map((ep: any, i: number) => (
            <div key={ep.id} data-index={i} className="reel-item-wrapper reel-item snap-start h-[100dvh]">
              <ReelItem 
                episode={ep} series={selectedSeries} 
                isActive={activeIdx === i} isMuted={isMuted} 
                toggleMute={() => setIsMuted(!isMuted)} 
                onEnterStory={(char, intro, hook) => setChatData({char, intro, hook, isFromHistory: false, isWhatsApp: false})}
                onNextEpisode={handleNext}
              />
            </div>
          ))}
        </div>
      )}

      {!selectedSeries && (
        <nav className={`fixed bottom-0 left-0 right-0 z-[1001] px-6 pb-8 pt-4 ${currentView === 'chats' ? 'bg-white' : ''}`}>
          <div className={`max-w-md mx-auto h-16 rounded-[2rem] border flex items-center shadow-2xl relative overflow-hidden transition-colors ${currentView === 'chats' ? 'bg-slate-50 border-slate-200' : 'bg-black/40 backdrop-blur-3xl border-white/10'}`}>
            <button 
              onClick={() => setCurrentView('discover')}
              className={`flex-1 flex flex-col items-center gap-1 transition-all justify-center h-full ${currentView === 'discover' ? 'text-blue-400' : (currentView === 'chats' ? 'text-slate-400' : 'text-white/20')}`}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className={`w-6 h-6 transition-all duration-300 ${currentView === 'discover' ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : ''}`}
              >
                <path d="M11.03 3.97a.75.75 0 0 1 1.06 0l7.452 7.453c.11.11.176.26.182.417v8.91a.75.75 0 0 1-.75.75H14.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-2a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75H5.274a.75.75 0 0 1-.75-.75V11.84c.006-.157.072-.307.182-.417L11.03 3.97Z" />
              </svg>
              {currentView === 'discover' && <div className="w-1 h-1 bg-blue-400 rounded-full mt-0.5 shadow-[0_0_5px_#60a5fa] animate-fade-in" />}
            </button>

            <button 
              onClick={() => setCurrentView('chats')}
              className={`flex-1 flex flex-col items-center gap-1 transition-all justify-center h-full ${currentView === 'chats' ? 'text-[#075E54]' : 'text-white/20'}`}
            >
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.178.713a19.022 19.022 0 01-1.522 3.535c-.211.373.08.794.48.754a10.875 10.875 0 002.517-.504z" clipRule="evenodd" />
                </svg>
                {Object.keys(conversations).length > 0 && currentView !== 'chats' && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black animate-pulse" />
                )}
              </div>
              {currentView === 'chats' && <div className="w-1 h-1 bg-[#075E54] rounded-full mt-0.5 shadow-[0_0_5px_#075E54] animate-fade-in" />}
            </button>
          </div>
        </nav>
      )}

      {/* Choice Selection Modal */}
      {choiceModalData && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-white/10 backdrop-blur-[60px] border border-white/20 rounded-[3.5rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] p-8 animate-slide-up">
             {/* Close Button */}
             <button 
               onClick={() => setChoiceModalData(null)} 
               className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all active:scale-90"
             >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white/50"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             <div className="flex flex-col items-center gap-6 mt-4">
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl p-1 bg-gradient-to-tr from-white/10 to-transparent">
                  <img src={choiceModalData.thumbnail} className="w-full h-full object-cover rounded-full" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">{choiceModalData.title}</h3>
                  <p className="text-white/30 text-[9px] font-black tracking-[0.4em] uppercase mt-2">Pick your experience</p>
                </div>
                
                <div className="w-full flex flex-col gap-4 mt-2">
                   <button 
                     onClick={() => {
                       const firstEp = choiceModalData.episodes[0];
                       const firstTrigger = firstEp.triggers[0];
                       setChatData({
                         char: firstTrigger.char,
                         intro: firstTrigger.intro,
                         hook: firstTrigger.hook,
                         isFromHistory: false,
                         isWhatsApp: true
                       });
                       setChoiceModalData(null);
                     }}
                     className="w-full py-5 rounded-[2rem] bg-white text-black font-black uppercase tracking-widest text-[10px] shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
                   >
                     {choiceModalData.id === 'heart-beats' ? '1. Immersive story on text' : '1. Chat with AI Avatar'}
                   </button>
                   
                   <button 
                     onClick={() => {
                       setSelectedSeries(choiceModalData);
                       setChoiceModalData(null);
                     }}
                     className="w-full py-5 rounded-[2rem] bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                   >
                     {choiceModalData.id === 'heart-beats' ? '2. Watch and interact' : '2. Watch and Learn'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {chatData && (
        <ChatPanel 
          character={chatData.char} 
          episodeLabel={selectedSeries?.episodes[activeIdx]?.label || "Inscene History"}
          instantGreeting={chatData.intro || ""}
          initialHook={chatData.hook || "Continuing conversation"}
          avatar={chatData.avatar || (selectedSeries?.avatars ? selectedSeries.avatars[chatData.char] : (chatData.char === 'Debu' ? DEBU_AVATAR : chatData.char === 'Priyank' ? PRIYANK_AVATAR : chatData.char === 'Arzoo' ? ARZOO_AVATAR : chatData.char === 'Anish' ? ANISH_AVATAR : CHIRAG_AVATAR))}
          onClose={() => setChatData(null)}
          onMessagesUpdate={(messages) => handleChatUpdate(chatData.char, messages)}
          existingMessages={chatData.isFromHistory ? chatData.history : undefined}
          isWhatsApp={chatData.isWhatsApp}
        />
      )}

      <Analytics />

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .reel-snap-container { scroll-behavior: smooth; }
        .scrub-range { -webkit-appearance: none; }
        .scrub-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; border: 2px solid #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); cursor: pointer; }
      `}</style>
    </div>
  );
};

export default App;
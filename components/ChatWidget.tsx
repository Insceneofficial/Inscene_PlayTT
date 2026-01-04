import React from 'react';
import { getCharacterTheme } from '../lib/characters';

interface ChatWidgetProps {
  characterName: string;
  avatar: string;
  onClick: () => void;
  isOnline?: boolean;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ 
  characterName, 
  avatar, 
  onClick,
  isOnline = true 
}) => {
  const theme = getCharacterTheme(characterName);
  
  // Get theme-specific border color (cyan-blue for the glowing effect)
  const borderGlowColor = theme === 'cyan' 
    ? 'from-cyan-400 to-blue-500' 
    : theme === 'blue'
    ? 'from-blue-400 to-cyan-500'
    : theme === 'purple'
    ? 'from-violet-400 to-blue-500'
    : theme === 'pink'
    ? 'from-pink-400 to-violet-500'
    : 'from-emerald-400 to-cyan-500';

  return (
    <button
      onClick={onClick}
      className="relative w-full group active:scale-[0.98] transition-all duration-200"
    >
      {/* Main Card Container */}
      <div className="relative w-full rounded-[1.5rem] overflow-visible border border-transparent bg-gradient-to-r from-violet-500/20 via-blue-500/20 to-violet-500/20 p-[1.5px] shadow-[0_0_20px_rgba(139,92,246,0.12)]">
        {/* Background Gradient */}
        <div className="relative w-full rounded-[1.5rem] bg-gradient-to-r from-blue-500/8 via-violet-500/8 to-blue-500/8 backdrop-blur-sm">
          {/* Content Container */}
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Profile Picture Container */}
            <div className="relative flex-shrink-0">
              {/* Glowing Border Effect */}
              <div className={`absolute inset-0 rounded-full blur-sm bg-gradient-to-r ${borderGlowColor} opacity-50`} />
              <div className="relative w-14 h-14 rounded-full border-2 border-cyan-400/50 overflow-visible bg-gradient-to-br from-cyan-500/20 to-blue-500/20 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                <div className="w-full h-full rounded-full overflow-hidden">
                  <img 
                    src={avatar} 
                    alt={characterName}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Online Status Indicator - positioned outside to avoid cropping */}
                {isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border border-white/80 rounded-full shadow-[0_0_6px_#10b981] z-20" />
                )}
              </div>
            </div>

            {/* Text Content */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-0.5 leading-tight">
                CHAT WITH {characterName.toUpperCase()}
              </h3>
              <p className="text-xs text-white/50 font-medium">
                Tap to start
              </p>
            </div>

            {/* Chat Icon */}
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2} 
                stroke="currentColor" 
                className="w-5 h-5 text-white/60"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.682C2.682 15.5 2 13.828 2 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export default ChatWidget;


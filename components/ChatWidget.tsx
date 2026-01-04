import React from 'react';

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
  return (
    <button
      onClick={onClick}
      className="relative w-full group active:scale-[0.98] transition-all duration-200"
    >
      {/* Main Card Container */}
      <div className="relative w-full rounded-[0.9rem] md:rounded-[1.5rem] overflow-visible border border-transparent bg-gradient-to-r from-violet-500/20 via-blue-500/20 to-violet-500/20 p-[1px] md:p-[1.5px] shadow-[0_0_12px_rgba(139,92,246,0.12)] md:shadow-[0_0_20px_rgba(139,92,246,0.12)]">
        {/* Background Gradient */}
        <div className="relative w-full rounded-[0.9rem] md:rounded-[1.5rem] bg-gradient-to-r from-blue-500/8 via-violet-500/8 to-blue-500/8 backdrop-blur-sm">
          {/* Content Container */}
          <div className="flex items-center gap-2 md:gap-3 px-2.5 py-2 md:px-4 md:py-3">
            {/* Text Content */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <h3 className="text-xs md:text-lg font-black italic uppercase tracking-tighter text-white mb-0.5 leading-tight">
                CHAT WITH {characterName.toUpperCase()}
              </h3>
              <p className="text-[10px] md:text-xs text-white/50 font-medium">
                Tap to start
              </p>
            </div>

            {/* Chat Icon */}
            <div className="flex-shrink-0 w-5 h-5 md:w-7 md:h-7 flex items-center justify-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2} 
                stroke="currentColor" 
                className="w-3.5 h-3.5 md:w-5 md:h-5 text-white/60"
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


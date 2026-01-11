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
      {/* Main Card Container - Minimal Elegance */}
      <div className="relative w-full rounded-xl overflow-hidden bg-white/95 backdrop-blur-sm border border-white/20 shadow-sm hover:shadow-md transition-all">
        {/* Content Container */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img 
              src={avatar} 
              alt={characterName}
              className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover"
            />
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#4A7C59] border-2 border-white" />
            )}
          </div>
          
          {/* Text Content */}
          <div className="flex-1 flex flex-col justify-center min-w-0 text-left">
            <h3 className="text-[14px] md:text-[15px] font-semibold text-[#1A1A1A] leading-tight tracking-tight">
              Chat with {characterName}
            </h3>
            <p className="text-[12px] text-[#4A7C59] font-medium">
              Available now
            </p>
          </div>

          {/* Arrow Icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#4A7C59] flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2.5} 
              stroke="currentColor" 
              className="w-4 h-4 text-white"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M8.25 4.5l7.5 7.5-7.5 7.5" 
              />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
};

export default ChatWidget;

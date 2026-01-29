import React, { useState, useEffect } from 'react';
import { prefersReducedMotion, ANIMATION_TIMING } from '../lib/animations';

interface VideoReactionWidgetProps {
  isVisible: boolean;
  onReaction?: (type: 'like' | 'heart' | 'fire') => void;
}

const VideoReactionWidget: React.FC<VideoReactionWidgetProps> = ({
  isVisible,
  onReaction,
}) => {
  const [showWidget, setShowWidget] = useState(false);
  const [reactionAnimations, setReactionAnimations] = useState<Array<{ id: string; type: 'like' | 'heart' | 'fire'; x: number }>>([]);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (isVisible) {
      setShowWidget(true);
      const timer = setTimeout(() => setShowWidget(false), 4000);
      return () => clearTimeout(timer);
    } else {
      // Keep widget visible for a bit longer even when isVisible becomes false
      const timer = setTimeout(() => setShowWidget(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const handleReaction = (type: 'like' | 'heart' | 'fire', event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    
    // Add animation
    const id = `${Date.now()}-${Math.random()}`;
    setReactionAnimations(prev => [...prev, { id, type, x }]);
    
    // Remove animation after it completes
    setTimeout(() => {
      setReactionAnimations(prev => prev.filter(a => a.id !== id));
    }, 1000);

    onReaction?.(type);
  };

  if (!showWidget || reducedMotion) {
    return null;
  }

  const reactions = [
    { type: 'like' as const, emoji: '👍', label: 'Like' },
    { type: 'heart' as const, emoji: '❤️', label: 'Love' },
    { type: 'fire' as const, emoji: '🔥', label: 'Fire' },
  ];

  return (
    <>
      <div className="absolute bottom-24 right-4 z-50 flex flex-col gap-3 animate-slide-up-reactions">
        {reactions.map((reaction) => (
          <button
            key={reaction.type}
            onClick={(e) => handleReaction(reaction.type, e)}
            className="w-14 h-14 rounded-full bg-white/95 backdrop-blur-md border-2 border-white/30 shadow-2xl flex items-center justify-center text-2xl hover:scale-125 active:scale-90 transition-all duration-300 hover:shadow-2xl hover:rotate-12"
            aria-label={reaction.label}
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
            }}
          >
            {reaction.emoji}
          </button>
        ))}
      </div>

      {/* Floating reaction animations */}
      {reactionAnimations.map((anim) => (
        <div
          key={anim.id}
          className="fixed pointer-events-none z-[9999] animate-reaction-float"
          style={{
            left: `${anim.x}px`,
            bottom: '100px',
            transform: 'translateX(-50%)',
          }}
        >
          <span className="text-4xl">
            {anim.type === 'like' && '👍'}
            {anim.type === 'heart' && '❤️'}
            {anim.type === 'fire' && '🔥'}
          </span>
        </div>
      ))}

      <style>{`
        @keyframes slide-up-reactions {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up-reactions {
          animation: slide-up-reactions ${ANIMATION_TIMING.STANDARD}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes reaction-float {
          0% {
            transform: translateX(-50%) translateY(0) scale(0.8);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translateX(-50%) translateY(-10px) scale(1.2);
          }
          100% {
            transform: translateX(-50%) translateY(-80px) scale(1);
            opacity: 0;
          }
        }
        .animate-reaction-float {
          animation: reaction-float ${ANIMATION_TIMING.SLOW}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
};

export default VideoReactionWidget;

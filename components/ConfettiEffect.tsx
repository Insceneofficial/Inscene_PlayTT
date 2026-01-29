import React, { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../lib/animations';

interface ConfettiEffectProps {
  show: boolean;
  duration?: number;
  particleCount?: number;
  emojis?: string[];
  onComplete?: () => void;
}

const ConfettiEffect: React.FC<ConfettiEffectProps> = ({
  show,
  duration = 3000,
  particleCount = 30,
  emojis = ['🎉', '⭐', '✨', '🎊', '💫', '🌟', '🔥', '💪'],
  onComplete,
}) => {
  const [visible, setVisible] = useState(show);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [show, duration, onComplete]);

  if (!visible || reducedMotion) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {[...Array(particleCount)].map((_, i) => {
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const animDuration = 2 + Math.random() * 1;
        const size = 14 + Math.random() * 10;
        const rotation = Math.random() * 720;
        
        return (
          <div
            key={i}
            className="absolute animate-confetti-fall"
            style={{
              left: `${left}%`,
              top: '-20px',
              fontSize: `${size}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${animDuration}s`,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {emoji}
          </div>
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { 
            transform: translateY(0) rotate(0deg) scale(1); 
            opacity: 1; 
          }
          50% {
            opacity: 1;
          }
          100% { 
            transform: translateY(80vh) rotate(720deg) scale(0.5); 
            opacity: 0; 
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 2.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ConfettiEffect;

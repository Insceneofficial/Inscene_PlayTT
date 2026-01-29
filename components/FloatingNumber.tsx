import React, { useEffect, useState } from 'react';
import { prefersReducedMotion, getAnimationDuration, ANIMATION_TIMING } from '../lib/animations';

interface FloatingNumberProps {
  value: number;
  position?: { x: number; y: number };
  type?: 'points' | 'streak' | 'milestone';
  onComplete?: () => void;
}

const FloatingNumber: React.FC<FloatingNumberProps> = ({
  value,
  position = { x: 50, y: 50 },
  type = 'points',
  onComplete,
}) => {
  const [visible, setVisible] = useState(true);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, ANIMATION_TIMING.SLOW);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible || reducedMotion) {
    return null;
  }

  const getEmoji = () => {
    switch (type) {
      case 'streak':
        return '🔥';
      case 'milestone':
        return '🏆';
      default:
        return '⭐';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'streak':
        return 'text-[#C77B58]';
      case 'milestone':
        return 'text-[#C9A227]';
      default:
        return 'text-[#4A7C59]';
    }
  };

  return (
    <div
      className={`fixed pointer-events-none z-[9998] animate-float-number ${getColor()}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex items-center gap-1.5 font-bold text-2xl drop-shadow-2xl bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border-2 border-current/20">
        <span className="text-2xl">{getEmoji()}</span>
        <span>+{value}</span>
        {type === 'points' && <span className="text-base">pts</span>}
      </div>
      <style>{`
        @keyframes float-number {
          0% {
            transform: translate(-50%, -50%) translateY(0) scale(0.5);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(-20px) scale(1.2);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-40px) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translateY(-100px) scale(0.9);
            opacity: 0;
          }
        }
        .animate-float-number {
          animation: float-number ${getAnimationDuration(ANIMATION_TIMING.SLOW)} cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default FloatingNumber;

import React, { useState, useEffect } from 'react';
import { prefersReducedMotion, ANIMATION_TIMING } from '../lib/animations';

interface VideoProgressCelebrationProps {
  progress: number; // 0-100
  onMilestoneReached?: (milestone: number) => void;
}

const VideoProgressCelebration: React.FC<VideoProgressCelebrationProps> = ({
  progress,
  onMilestoneReached,
}) => {
  const [celebratedMilestones, setCelebratedMilestones] = useState<Set<number>>(new Set());
  const [activeCelebration, setActiveCelebration] = useState<number | null>(null);
  const reducedMotion = prefersReducedMotion();

  const milestones = [25, 50, 75, 90];

  useEffect(() => {
    if (reducedMotion) return;

    const currentMilestone = milestones.find(
      milestone => progress >= milestone && !celebratedMilestones.has(milestone)
    );

    if (currentMilestone !== undefined) {
      setCelebratedMilestones(prev => new Set([...prev, currentMilestone]));
      setActiveCelebration(currentMilestone);
      onMilestoneReached?.(currentMilestone);

      // Hide celebration after animation
      const timer = setTimeout(() => {
        setActiveCelebration(null);
      }, ANIMATION_TIMING.SLOW);

      return () => clearTimeout(timer);
    }
  }, [progress, celebratedMilestones, onMilestoneReached, reducedMotion]);

  const getMilestoneMessage = (milestone: number): string => {
    switch (milestone) {
      case 25:
        return 'Great start!';
      case 50:
        return 'Halfway there!';
      case 75:
        return 'Almost done!';
      case 90:
        return 'Almost complete!';
      default:
        return 'Keep going!';
    }
  };

  const getMilestoneEmoji = (milestone: number): string => {
    switch (milestone) {
      case 25:
        return '👏';
      case 50:
        return '🎯';
      case 75:
        return '⚡';
      case 90:
        return '🔥';
      default:
        return '✨';
    }
  };

  if (!activeCelebration || reducedMotion) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="animate-progress-celebration bg-gradient-to-br from-[#4A7C59]/95 to-[#3D6549]/95 backdrop-blur-md rounded-3xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl border-2 border-white/20">
        <span className="text-5xl animate-bounce-gentle">{getMilestoneEmoji(activeCelebration)}</span>
        <span className="text-white font-bold text-xl drop-shadow-lg">
          {getMilestoneMessage(activeCelebration)}
        </span>
        <span className="text-white/90 text-base font-medium">
          {activeCelebration}% complete
        </span>
      </div>

      <style>{`
        @keyframes progress-celebration {
          0% {
            transform: scale(0.5) rotate(-10deg);
            opacity: 0;
          }
          20% {
            transform: scale(1.15) rotate(5deg);
            opacity: 1;
          }
          50% {
            transform: scale(1.05) rotate(-2deg);
            opacity: 1;
          }
          80% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: scale(0.8) rotate(5deg);
            opacity: 0;
          }
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-progress-celebration {
          animation: progress-celebration ${ANIMATION_TIMING.SLOW}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default VideoProgressCelebration;

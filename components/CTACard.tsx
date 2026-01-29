import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CTACardProps {
  label: string;
  ctaKey: string;
  progress: number;
  isHovered: boolean;
  isSelected: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
  momentumBonus?: boolean;
  position?: 'left' | 'right';
}

const CTACard: React.FC<CTACardProps> = ({
  label,
  ctaKey,
  progress,
  isHovered,
  isSelected,
  onHoverStart,
  onHoverEnd,
  onSelect,
  momentumBonus = false,
  position = 'left',
}) => {
  const [localProgress, setLocalProgress] = useState(0);
  const [showMilestone, setShowMilestone] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastMilestoneRef = useRef<number>(0);

  // Progress fill animation
  useEffect(() => {
    if (isHovered && !isSelected) {
      const startTime = Date.now();
      startTimeRef.current = startTime;
      const fillDuration = momentumBonus ? 800 : 1500; // Faster if momentum bonus

      const animate = () => {
        if (!startTimeRef.current) return;
        
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min(elapsed / fillDuration, 1);
        setLocalProgress(newProgress);

        // Check for milestones (25%, 50%, 75%)
        const milestones = [0.25, 0.5, 0.75];
        const currentMilestone = milestones.find(m => newProgress >= m && lastMilestoneRef.current < m);
        
        if (currentMilestone) {
          lastMilestoneRef.current = currentMilestone;
          setShowMilestone(true);
          // Trigger haptic feedback if available
          if ('vibrate' in navigator) {
            navigator.vibrate(10); // Light vibration
          }
          setTimeout(() => setShowMilestone(false), 200);
        }

        if (newProgress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Progress complete - trigger haptic
          if ('vibrate' in navigator) {
            navigator.vibrate(20); // Stronger vibration
          }
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Reset progress when not hovered
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      startTimeRef.current = null;
      lastMilestoneRef.current = 0;
      
      // Smooth reset animation
      const resetProgress = () => {
        setLocalProgress(prev => {
          if (prev > 0) {
            return Math.max(0, prev - 0.1);
          }
          return 0;
        });
        if (localProgress > 0) {
          requestAnimationFrame(resetProgress);
        }
      };
      resetProgress();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isHovered, isSelected, momentumBonus, localProgress]);

  // Use external progress if provided, otherwise use local
  const displayProgress = progress > 0 ? progress : localProgress;

  // Calculate glow intensity based on progress
  const glowIntensity = 0.3 + (displayProgress * 0.7); // 0.3 to 1.0
  const glowOpacity = Math.sin(Date.now() / 500) * 0.2 + glowIntensity; // Pulsing effect

  const handleClick = useCallback(() => {
    if (displayProgress < 1) {
      // Complete progress animation first
      setLocalProgress(1);
      setTimeout(() => {
        onSelect();
      }, 300);
    } else {
      onSelect();
    }
  }, [displayProgress, onSelect]);

  const handleMouseEnter = useCallback(() => {
    onHoverStart();
  }, [onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    onHoverEnd();
  }, [onHoverEnd]);

  const handleTouchStart = useCallback(() => {
    onHoverStart();
  }, [onHoverStart]);

  const handleTouchEnd = useCallback(() => {
    if (displayProgress >= 1) {
      onSelect();
    } else {
      onHoverEnd();
    }
  }, [displayProgress, onSelect, onHoverEnd]);

  // Calculate progress ring circumference (40px diameter)
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - displayProgress);

  return (
    <div
      className={`relative px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium transition-all duration-300 min-h-[44px] flex items-center justify-center cursor-pointer w-full ${
        isHovered ? 'scale-[1.02] brightness-110' : ''
      } ${isSelected ? 'scale-[1.05]' : ''} ${showMilestone ? 'scale-[1.03]' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Progress Ring - Circular */}
      <div className="absolute top-2 right-2 w-10 h-10">
        <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 40 40">
          {/* Background ring */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="2"
          />
          {/* Progress ring */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-75 ease-out"
            style={{
              filter: `drop-shadow(0 0 ${4 * displayProgress}px rgba(255, 255, 255, ${glowOpacity}))`,
              opacity: displayProgress > 0 ? 1 : 0,
            }}
          />
        </svg>
        {/* Milestone particle effect */}
        {showMilestone && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          </div>
        )}
      </div>

      {/* Progress completion snap effect */}
      {displayProgress >= 1 && !isSelected && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-6 h-6 border-2 border-white rounded-full animate-ping opacity-75" />
        </div>
      )}

      {/* Card text */}
      <span className="text-center leading-tight z-10 relative">{label}</span>

      {/* Selection celebration - Checkmark */}
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-scale-in">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      {/* Confetti particles (subtle) */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${50 + (Math.random() - 0.5) * 40}%`,
                top: `${50 + (Math.random() - 0.5) * 40}%`,
                animation: `confetti-${i} 0.4s ease-out forwards`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        ${[...Array(8)].map(
          (_, i) => `
          @keyframes confetti-${i} {
            0% {
              transform: translate(0, 0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translate(${(Math.random() - 0.5) * 60}px, ${(Math.random() - 0.5) * 60}px) rotate(${Math.random() * 360}deg);
              opacity: 0;
            }
          }
        `
        ).join('')}
      `}</style>
    </div>
  );
};

export default CTACard;

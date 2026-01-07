import React from 'react';

interface StreakIndicatorProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const StreakIndicator: React.FC<StreakIndicatorProps> = ({
  streak,
  size = 'md',
  showLabel = true,
}) => {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const isActive = streak > 0;

  return (
    <div className="flex items-center gap-2">
      <div className={`relative ${sizeClasses[size]}`}>
        <span className={isActive ? 'animate-pulse' : ''}>🔥</span>
        {isActive && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-white font-bold text-lg">{streak}</span>
        {showLabel && (
          <span className="text-white/60 text-xs">
            {streak === 0 ? 'Start your streak!' : streak === 1 ? 'day streak' : 'day streak'}
          </span>
        )}
      </div>
      {isActive && streak >= 3 && (
        <span className="text-orange-400 text-xs font-medium animate-fade-in">
          Keep it going!
        </span>
      )}
    </div>
  );
};

export default StreakIndicator;


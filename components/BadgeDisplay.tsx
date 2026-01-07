import React from 'react';
import { BadgeType, getBadgeInfo } from '../lib/gamification';

interface BadgeDisplayProps {
  characterName: string;
  earnedBadges: BadgeType[];
  onBadgeClick?: (badgeType: BadgeType) => void;
}

const ALL_BADGES: BadgeType[] = [
  'first_goal',
  'first_milestone',
  'streak_3',
  'streak_7',
  'streak_30',
  'milestone_master',
  'consistent',
  'goal_completed',
];

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({
  characterName,
  earnedBadges,
  onBadgeClick,
}) => {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      {ALL_BADGES.map((badgeType) => {
        const isEarned = earnedBadges.includes(badgeType);
        const badgeInfo = getBadgeInfo(badgeType);

        return (
          <div
            key={badgeType}
            onClick={() => onBadgeClick?.(badgeType)}
            className={`
              relative flex items-center justify-center p-2 rounded-lg
              transition-all duration-300 cursor-pointer flex-shrink-0 w-10 h-10 scrollbar-hide
              ${isEarned 
                ? 'bg-white/[0.05] backdrop-blur-xl border border-white/20 hover:bg-white/[0.08]' 
                : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] opacity-30'
              }
            `}
          >
            <div className={`text-xl ${isEarned ? '' : 'grayscale'}`}>
              {badgeInfo.emoji}
            </div>
            {isEarned && (
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-violet-400 rounded-full ring-1 ring-[#0a0a0f]" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BadgeDisplay;


import React, { useState, useEffect } from 'react';
import {
  getUserEngagementSummary,
  formatPoints,
  getStreakStatus,
  getTopPercentageBadge,
  UserEngagementSummary,
} from '../lib/streaksAndPoints';
import { useAuth } from '../lib/auth';

interface StreakWidgetProps {
  creatorId: string;
  creatorName: string;
  onOpenLeaderboard: () => void;
  compact?: boolean;
}

const StreakWidget: React.FC<StreakWidgetProps> = ({
  creatorId,
  creatorName,
  onOpenLeaderboard,
  compact = false,
}) => {
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<UserEngagementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      
      try {
        const data = await getUserEngagementSummary(creatorId);
        setSummary(data);
      } catch (error) {
        console.error('[StreakWidget] Failed to load summary:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSummary();
  }, [creatorId, isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl border border-black/[0.04]">
        <div className="w-8 h-8 rounded-lg bg-black/5" />
        <div className="h-4 w-20 rounded bg-black/5" />
      </div>
    );
  }

  const streak = summary?.streak?.current_streak || 0;
  const points = summary?.points?.total_points || 0;
  const rank = summary?.rank?.rank;
  const topPercentage = summary?.rank?.top_percentage;

  if (compact) {
    return (
      <button
        onClick={onOpenLeaderboard}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full border border-black/[0.06] shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
      >
        {streak > 0 && (
          <span className="text-sm font-semibold text-[#C77B58]">
            🔥 {streak}
          </span>
        )}
        <span className="text-sm font-semibold text-[#1A1A1A]">
          ⭐ {formatPoints(points)}
        </span>
        {rank && (
          <span className="text-xs text-[#8A8A8A] font-medium">
            #{rank}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onOpenLeaderboard}
      className="w-full p-4 bg-white rounded-xl border border-black/[0.06] shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Your Progress</h3>
        {topPercentage && topPercentage <= 50 && (
          <span className="px-2 py-0.5 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] text-[11px] font-semibold">
            {getTopPercentageBadge(topPercentage)}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {/* Streak */}
        <div className="flex flex-col items-center">
          <div className={`text-2xl font-bold ${streak > 0 ? 'text-[#C77B58]' : 'text-[#ACACAC]'}`}>
            {streak > 0 ? `🔥 ${streak}` : '0'}
          </div>
          <div className="text-[10px] font-medium text-[#8A8A8A] uppercase tracking-wide">
            Streak
          </div>
        </div>
        
        {/* Divider */}
        <div className="w-px h-10 bg-black/10" />
        
        {/* Points */}
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-[#1A1A1A]">
            {formatPoints(points)}
          </div>
          <div className="text-[10px] font-medium text-[#8A8A8A] uppercase tracking-wide">
            Points
          </div>
        </div>
        
        {/* Divider */}
        <div className="w-px h-10 bg-black/10" />
        
        {/* Rank */}
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-[#4A7C59]">
            {rank ? `#${rank}` : '—'}
          </div>
          <div className="text-[10px] font-medium text-[#8A8A8A] uppercase tracking-wide">
            Rank
          </div>
        </div>
        
        {/* Arrow */}
        <div className="ml-auto">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#ACACAC]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
      
      {/* Status Text */}
      <p className="text-xs text-[#8A8A8A] mt-3 text-center">
        {getStreakStatus(summary?.streak || null)}
      </p>
    </button>
  );
};

export default StreakWidget;

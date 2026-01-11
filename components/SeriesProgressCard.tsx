import React, { useState, useEffect, useRef } from 'react';
import { getSeriesProgress, SeriesProgress } from '../lib/analytics';
import { getActiveGoal, GoalWithStreak } from '../lib/goals';
import { useAuth } from '../lib/auth';

interface SeriesProgressCardProps {
  seriesId: string;
  seriesTitle: string;
  creatorId: string;
  episodeIds: number[];
  onGoalClick?: (goal: GoalWithStreak) => void;
}

const SeriesProgressCard: React.FC<SeriesProgressCardProps> = ({
  seriesId,
  seriesTitle,
  creatorId,
  episodeIds,
  onGoalClick,
}) => {
  const { isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<SeriesProgress | null>(null);
  const [goal, setGoal] = useState<GoalWithStreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Use refs to track previous values and prevent unnecessary re-fetches
  const prevSeriesIdRef = useRef<string | null>(null);
  const prevEpisodeIdsRef = useRef<string>('');

  useEffect(() => {
    // Create a stable string key for episodeIds comparison
    const episodeIdsKey = episodeIds.join(',');
    
    // Skip if nothing changed
    if (
      hasLoaded &&
      prevSeriesIdRef.current === seriesId &&
      prevEpisodeIdsRef.current === episodeIdsKey
    ) {
      return;
    }
    
    const loadData = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      
      // Only show loading on first load, not on re-fetches
      if (!hasLoaded) {
        setIsLoading(true);
      }
      
      try {
        const [progressData, goalData] = await Promise.all([
          getSeriesProgress(seriesId, episodeIds),
          getActiveGoal(creatorId),
        ]);
        
        setProgress(progressData);
        setGoal(goalData);
        
        // Mark as loaded and store current values
        setHasLoaded(true);
        prevSeriesIdRef.current = seriesId;
        prevEpisodeIdsRef.current = episodeIdsKey;
      } catch (error) {
        console.error('[SeriesProgress] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [seriesId, creatorId, episodeIds, isAuthenticated, hasLoaded]);

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-24 bg-white rounded-xl border border-black/[0.04]" />
      </div>
    );
  }

  const hasProgress = progress && progress.completedEpisodes > 0;
  const hasGoal = goal !== null;

  // Don't show anything if there's no progress and no goal
  if (!hasProgress && !hasGoal) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Video Progress Section */}
      {progress && (
        <div className="bg-white rounded-xl border border-black/[0.06] p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Your Progress</h4>
            <span className="text-[13px] font-medium text-[#4A7C59]">
              {progress.completedEpisodes}/{progress.totalEpisodes} completed
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-2.5 bg-black/[0.06] rounded-full overflow-hidden mb-3">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#4A7C59] to-[#6B9B7A] rounded-full transition-all duration-500"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>
          
          {/* Episode Dots */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {progress.episodeStatuses.map((ep, idx) => (
              <div
                key={ep.episodeId}
                className={`relative group`}
                title={`Episode ${idx + 1}: ${ep.isCompleted ? 'Completed' : ep.completionPercentage > 0 ? `${Math.round(ep.completionPercentage)}% watched` : 'Not started'}`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-all ${
                  ep.isCompleted 
                    ? 'bg-[#4A7C59] text-white' 
                    : ep.completionPercentage > 0 
                      ? 'bg-[#4A7C59]/20 text-[#4A7C59] border border-[#4A7C59]/30' 
                      : 'bg-black/[0.04] text-[#8A8A8A]'
                }`}>
                  {ep.isCompleted ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                
                {/* Partial progress indicator */}
                {!ep.isCompleted && ep.completionPercentage > 0 && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A7C59] rounded-full"
                    style={{ width: `${ep.completionPercentage}%` }}
                  />
                )}
              </div>
            ))}
          </div>
          
          {/* Progress message */}
          <p className="text-[12px] text-[#8A8A8A] mt-3">
            {progress.overallProgress === 100 
              ? '🎉 You\'ve completed all episodes!'
              : progress.overallProgress > 0 
                ? `Keep going! ${progress.totalEpisodes - progress.completedEpisodes} episodes left.`
                : 'Start watching to track your progress!'}
          </p>
        </div>
      )}

      {/* Active Goal Section */}
      {goal && (
        <button
          onClick={() => onGoalClick?.(goal)}
          className="w-full bg-gradient-to-r from-[#4A7C59]/5 to-[#C9A227]/5 rounded-xl border border-[#4A7C59]/20 p-4 text-left hover:border-[#4A7C59]/40 transition-all active:scale-[0.99]"
        >
          <div className="flex items-start gap-3">
            {/* Goal Icon */}
            <div className="w-10 h-10 rounded-xl bg-[#4A7C59]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🎯</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[14px] font-semibold text-[#1A1A1A] truncate pr-2">
                  {goal.title}
                </h4>
                <div className="flex items-center gap-1.5">
                  {goal.current_streak > 0 && (
                    <span className="text-[12px] font-semibold text-[#C77B58]">
                      🔥 {goal.current_streak}
                    </span>
                  )}
                </div>
              </div>
              
              <p className="text-[13px] text-[#8A8A8A] line-clamp-1">
                Today: {goal.daily_task}
              </p>
              
              {/* Goal progress */}
              <div className="mt-2 flex items-center gap-2">
                {goal.completed_today ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4A7C59] text-white text-[11px] font-medium">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                    </svg>
                    Done today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C9A227]/20 text-[#8A7020] text-[11px] font-medium">
                    ⏳ Pending
                  </span>
                )}
                
                <span className="text-[11px] text-[#ACACAC]">
                  Difficulty: {'⭐'.repeat(goal.difficulty_level)}
                </span>
              </div>
            </div>
            
            {/* Arrow */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#ACACAC] flex-shrink-0 mt-1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
};

export default SeriesProgressCard;

import React, { useEffect, useState } from 'react';
import { GoalWithStreak, getGoalProgress, GoalProgress } from '../lib/goals';

interface JourneyProgressBarProps {
  goal: GoalWithStreak;
  showDetails?: boolean;
  compact?: boolean;
}

const JourneyProgressBar: React.FC<JourneyProgressBarProps> = ({ 
  goal, 
  showDetails = true,
  compact = false 
}) => {
  const [progressHistory, setProgressHistory] = useState<GoalProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      const history = await getGoalProgress(goal.id, goal.duration_days || 30);
      setProgressHistory(history);
      setIsLoading(false);
    };
    loadProgress();
  }, [goal.id, goal.duration_days]);

  // Calculate overall progress
  const startDate = new Date(goal.created_at);
  const targetDate = goal.target_date ? new Date(goal.target_date) : new Date(startDate.getTime() + (goal.duration_days || 30) * 24 * 60 * 60 * 1000);
  const today = new Date();
  
  const totalDays = Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, totalDays - daysPassed);
  
  const completedDays = progressHistory.filter(p => p.completed).length;
  const progressPercent = totalDays > 0 ? (daysPassed / totalDays) * 100 : 0;
  const completionRate = daysPassed > 0 ? Math.round((completedDays / daysPassed) * 100) : 0;

  // Get status color and message
  const getStatusInfo = () => {
    if (goal.completed_today && daysRemaining === 0) {
      return { color: '#4A7C59', message: '🎉 Challenge Complete!', emoji: '🏆' };
    }
    if (goal.completed_today) {
      return { color: '#4A7C59', message: "Today's done!", emoji: '✓' };
    }
    if (completionRate >= 80) {
      return { color: '#4A7C59', message: 'On track!', emoji: '💪' };
    }
    if (completionRate >= 50) {
      return { color: '#C9A227', message: 'Keep going!', emoji: '⚡' };
    }
    return { color: '#C77B58', message: 'Catch up today!', emoji: '🎯' };
  };

  const status = getStatusInfo();

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Mini progress circle */}
        <div className="relative w-10 h-10">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="#E5E5E5"
              strokeWidth="4"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke={status.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(progressPercent / 100) * 100.53} 100.53`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm">{status.emoji}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#1A1A1A] truncate">{goal.title}</span>
            <span className="text-[11px] text-[#8A8A8A] ml-2">{daysRemaining}d left</span>
          </div>
          <div className="w-full h-1.5 bg-black/[0.06] rounded-full mt-1.5 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ 
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor: status.color 
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-black/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{status.emoji}</span>
          <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Your Journey</h4>
        </div>
        <div 
          className="px-2 py-1 rounded-full text-[11px] font-semibold"
          style={{ 
            backgroundColor: `${status.color}15`,
            color: status.color 
          }}
        >
          {status.message}
        </div>
      </div>

      {/* Main progress bar */}
      <div className="relative mb-4">
        <div className="w-full h-3 bg-black/[0.06] rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
            style={{ 
              width: `${Math.min(progressPercent, 100)}%`,
              backgroundColor: status.color 
            }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
        
        {/* Progress markers */}
        <div className="absolute top-0 left-0 right-0 h-3 flex items-center">
          {/* 25% marker */}
          <div className="absolute left-1/4 w-0.5 h-3 bg-black/10" />
          {/* 50% marker */}
          <div className="absolute left-1/2 w-0.5 h-3 bg-black/10" />
          {/* 75% marker */}
          <div className="absolute left-3/4 w-0.5 h-3 bg-black/10" />
        </div>
      </div>

      {/* Stats row */}
      {showDetails && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-[16px] font-bold text-[#C77B58]">{goal.current_streak}</div>
            <div className="text-[10px] text-[#8A8A8A] uppercase tracking-wide">Streak</div>
          </div>
          <div>
            <div className="text-[16px] font-bold text-[#4A7C59]">{completedDays}</div>
            <div className="text-[10px] text-[#8A8A8A] uppercase tracking-wide">Done</div>
          </div>
          <div>
            <div className="text-[16px] font-bold text-[#4A4A4A]">{daysRemaining}</div>
            <div className="text-[10px] text-[#8A8A8A] uppercase tracking-wide">Left</div>
          </div>
          <div>
            <div className="text-[16px] font-bold text-[#4A90A4]">{completionRate}%</div>
            <div className="text-[10px] text-[#8A8A8A] uppercase tracking-wide">Rate</div>
          </div>
        </div>
      )}

      {/* Weekly dots preview */}
      {showDetails && (
        <div className="mt-4 pt-3 border-t border-black/[0.04]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#8A8A8A] font-medium">Last 7 days</span>
            <div className="flex gap-1.5">
              {[...Array(7)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                const dateKey = date.toISOString().split('T')[0];
                const wasCompleted = progressHistory.find(p => p.date === dateKey)?.completed;
                const isToday = i === 6;
                const isPast = i < 6;
                
                return (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] transition-all ${
                      wasCompleted 
                        ? 'bg-[#4A7C59] text-white' 
                        : isToday 
                          ? 'bg-[#4A7C59]/20 border-2 border-[#4A7C59] border-dashed'
                          : isPast
                            ? 'bg-black/[0.04]'
                            : 'bg-white border border-black/10'
                    }`}
                    title={date.toLocaleDateString()}
                  >
                    {wasCompleted && '✓'}
                    {isToday && !wasCompleted && '•'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default JourneyProgressBar;

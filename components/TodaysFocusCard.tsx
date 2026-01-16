import React, { useState, useEffect } from 'react';
import { GoalWithStreak, getAllGoals } from '../lib/goals';
import { getCharacterAvatar } from '../lib/characters';

interface TodaysFocusCardProps {
  onTaskClick: (goal: GoalWithStreak) => void;
  onMarkDone: (goalId: string) => void;
}

const TodaysFocusCard: React.FC<TodaysFocusCardProps> = ({ onTaskClick, onMarkDone }) => {
  const [goals, setGoals] = useState<GoalWithStreak[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const loadGoals = async () => {
      setIsLoading(true);
      const allGoals = await getAllGoals();
      // Filter to active goals only
      const activeGoals = allGoals.filter(g => g.status === 'active');
      setGoals(activeGoals);
      setIsLoading(false);
    };
    loadGoals();
  }, []);

  // Calculate overall progress
  const completedToday = goals.filter(g => g.completed_today).length;
  const totalActive = goals.length;
  const progressPercent = totalActive > 0 ? (completedToday / totalActive) * 100 : 0;
  const allDone = totalActive > 0 && completedToday === totalActive;

  // Get the most urgent task (not completed today)
  const nextTask = goals.find(g => !g.completed_today);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-black/[0.06] shadow-sm animate-pulse">
        <div className="h-6 w-32 bg-black/5 rounded-lg mb-4" />
        <div className="h-16 bg-black/5 rounded-xl" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="bg-gradient-to-br from-[#4A7C59]/5 to-[#4A7C59]/10 rounded-2xl p-6 border border-[#4A7C59]/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A7C59] flex items-center justify-center">
            <span className="text-2xl">🎯</span>
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-[#1A1A1A]">Start Your Journey</h3>
            <p className="text-[13px] text-[#8A8A8A]">Chat with a coach to set your first challenge</p>
          </div>
        </div>
        <p className="text-[14px] text-[#4A4A4A] leading-relaxed">
          Watch a video and chat with your coach. They'll help you create a personalized daily challenge! 
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Confetti effect when all done */}
      {allDone && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                fontSize: `${14 + Math.random() * 8}px`,
              }}
            >
              {['🎉', '⭐', '✨', '🎊', '💪'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <div className={`bg-gradient-to-br rounded-2xl p-5 border shadow-sm transition-all duration-500 ${
        allDone 
          ? 'from-[#4A7C59]/10 to-[#C9A227]/10 border-[#4A7C59]/30' 
          : 'from-white to-[#FAF9F6] border-black/[0.06]'
      }`}>
        {/* Header with progress */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{allDone ? '🏆' : '📌'}</span>
            <h3 className="text-[15px] font-semibold text-[#1A1A1A]">
              {allDone ? "Today's Done!" : "Today's Focus"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[#4A7C59]">
              {completedToday}/{totalActive}
            </span>
            <div className="w-16 h-2 bg-black/[0.06] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#4A7C59] rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* All done celebration */}
        {allDone ? (
          <div className="text-center py-4 animate-slide-up">
            <p className="text-[20px] mb-2">🎉</p>
            <h4 className="text-[16px] font-semibold text-[#1A1A1A] mb-1">Amazing Work!</h4>
            <p className="text-[13px] text-[#8A8A8A]">
              You completed all {totalActive} task{totalActive > 1 ? 's' : ''} today. Come back tomorrow!
            </p>
          </div>
        ) : (
          <>
            {/* Next task to do - SUPER CLEAR */}
            {nextTask && (
              <div 
                className="bg-white rounded-xl p-4 border-2 border-[#4A7C59]/30 mb-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                onClick={() => onTaskClick(nextTask)}
              >
                <div className="flex items-start gap-3">
                  <img 
                    src={getCharacterAvatar(nextTask.creator_id)} 
                    alt={nextTask.creator_id}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] text-[10px] font-semibold uppercase tracking-wide">
                        Do This Now
                      </span>
                      {nextTask.current_streak > 0 && (
                        <span className="text-[11px] text-[#C77B58] font-semibold">
                          🔥 {nextTask.current_streak}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[15px] font-semibold text-[#1A1A1A] truncate">{nextTask.title}</h4>
                    <p className="text-[13px] text-[#4A4A4A] leading-snug mt-1">
                      👉 {nextTask.daily_task}
                    </p>
                  </div>
                </div>
                
                {/* Big action button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkDone(nextTask.id);
                  }}
                  className="w-full mt-4 py-3 rounded-xl bg-[#4A7C59] text-white font-semibold text-[15px] hover:bg-[#3D6549] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>I Did It!</span>
                </button>
              </div>
            )}

            {/* Other tasks (if any) */}
            {goals.filter(g => g !== nextTask && !g.completed_today).length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#8A8A8A] uppercase tracking-wide font-medium">Also Today</p>
                {goals.filter(g => g !== nextTask && !g.completed_today).slice(0, 2).map(goal => (
                  <div 
                    key={goal.id}
                    onClick={() => onTaskClick(goal)}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-black/[0.06] cursor-pointer hover:bg-black/[0.01] transition-all"
                  >
                    <img 
                      src={getCharacterAvatar(goal.creator_id)} 
                      alt={goal.creator_id}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A1A] truncate">{goal.daily_task}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkDone(goal.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#4A7C59]/10 text-[#4A7C59] text-[12px] font-semibold hover:bg-[#4A7C59]/20 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Completed tasks (collapsed) */}
            {completedToday > 0 && (
              <div className="mt-4 pt-3 border-t border-black/[0.06]">
                <div className="flex items-center gap-2 text-[12px] text-[#4A7C59]">
                  <span>✓</span>
                  <span className="font-medium">{completedToday} task{completedToday > 1 ? 's' : ''} done today</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(200px) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default TodaysFocusCard;

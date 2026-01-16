import React, { useState, useEffect } from 'react';
import { getAllGoals, GoalWithStreak, markTaskDone } from '../lib/goals';
import { getCharacterAvatar } from '../lib/characters';

interface GoalsViewProps {
  onClose: () => void;
  onGoalSelect?: (goal: GoalWithStreak) => void;
}

const GoalsView: React.FC<GoalsViewProps> = ({ onClose, onGoalSelect }) => {
  const [goals, setGoals] = useState<GoalWithStreak[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load goals
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const allGoals = await getAllGoals();
      setGoals(allGoals);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleMarkDone = async (goalId: string) => {
    await markTaskDone(goalId);
    // Reload goals to update completion status
    const allGoals = await getAllGoals();
    setGoals(allGoals);
  };

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-[#FAF9F6] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-[#FAF9F6] border-b border-black/[0.06]">
        <div>
          <h3 className="text-[18px] font-semibold text-[#1A1A1A] tracking-tight">Challenges</h3>
          <p className="text-[12px] text-[#8A8A8A]">Track your daily progress</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-black/[0.04] flex items-center justify-center hover:bg-black/[0.08] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#8A8A8A]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#4A7C59]/20 border-t-[#4A7C59] rounded-full animate-spin" />
            <p className="text-[#8A8A8A] text-[13px]">Loading...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-28 pt-4">
          {goals.filter(g => g.status === 'active').length > 0 ? (
            <div className="px-4">
              <h3 className="text-[12px] font-medium text-[#8A8A8A] uppercase tracking-wide mb-3">
                Your Challenges ({goals.filter(g => g.status === 'active').length})
              </h3>
              <div className="space-y-3">
                {goals.filter(g => g.status === 'active').map(goal => {
                  return (
                    <div
                      key={goal.id}
                      className="bg-white rounded-xl p-4 border border-black/[0.06] hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <img 
                          src={getCharacterAvatar(goal.creator_id)} 
                          alt={goal.creator_id}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[#1A1A1A] font-medium text-[14px] truncate mb-1">{goal.title}</h4>
                          <p className="text-[#8A8A8A] text-[13px] leading-relaxed mb-3">{goal.daily_task}</p>
                          
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-[#C77B58] text-[12px] font-medium">{goal.current_streak} streak</span>
                            {goal.completed_today ? (
                              <span className="text-[#4A7C59] text-[12px] font-medium flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                </svg>
                                Done today
                              </span>
                            ) : (
                              <span className="text-[#ACACAC] text-[12px]">○ Pending</span>
                            )}
                          </div>

                          {!goal.completed_today && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkDone(goal.id);
                              }}
                              className="w-full py-2 rounded-xl bg-[#4A7C59] text-white font-medium text-[13px] hover:bg-[#3D6549] transition-colors"
                            >
                              Mark as Done
                            </button>
                          )}

                          {goal.completed_today && onGoalSelect && (
                            <button
                              onClick={() => onGoalSelect(goal)}
                              className="w-full py-2 rounded-xl bg-transparent border border-black/[0.08] text-[#4A4A4A] font-medium text-[13px] hover:bg-black/[0.02] transition-colors mt-2"
                            >
                              View Details
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-16 px-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#4A7C59]/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#4A7C59]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="text-[17px] font-semibold text-[#1A1A1A] mb-1">No Challenges Yet</h3>
              <p className="text-[#8A8A8A] text-[14px] max-w-[260px] mx-auto">
                Start a chat with any coach to set your first challenge
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>
    </div>
  );
};

export default GoalsView;

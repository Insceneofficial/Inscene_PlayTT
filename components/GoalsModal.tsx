import React from 'react';
import { GoalWithStreak } from '../lib/goals';

interface GoalsModalProps {
  goal: GoalWithStreak;
  onClose: () => void;
  onMarkDone: () => void;
  onPause: () => void;
  onEdit: () => void;
}

const GoalsModal: React.FC<GoalsModalProps> = ({
  goal,
  onClose,
  onMarkDone,
  onPause,
  onEdit
}) => {
  const getDifficultyLabel = (level: number): string => {
    const labels = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
    return labels[level - 1] || 'Medium';
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl animate-slide-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C9A227]/10 flex items-center justify-center text-lg">
                🎯
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#1A1A1A]">Your Goal</h3>
                <p className="text-[12px] text-[#8A8A8A]">with {goal.creator_id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-black/[0.04] flex items-center justify-center hover:bg-black/[0.08] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#8A8A8A]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 bg-[#FAF9F6]">
          {/* Goal Title */}
          <div className="bg-white rounded-xl p-4 border border-black/[0.06]">
            <p className="text-[11px] text-[#8A8A8A] uppercase tracking-wide font-medium mb-1">Goal</p>
            <p className="text-[#1A1A1A] font-medium text-[15px] leading-snug">{goal.title}</p>
          </div>

          {/* Today's Task */}
          <div className="bg-white rounded-xl p-4 border border-[#4A7C59]/20">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] text-[#4A7C59] uppercase tracking-wide font-medium">Today's Task</p>
            </div>
            <p className="text-[#4A4A4A] text-[14px] leading-relaxed">{goal.daily_task}</p>
            
            {goal.completed_today ? (
              <div className="mt-4 flex items-center gap-2 text-[#4A7C59] text-[13px] bg-[#4A7C59]/10 rounded-lg px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Done for today</span>
              </div>
            ) : (
              <button
                onClick={onMarkDone}
                className="mt-4 w-full py-2.5 rounded-xl bg-[#4A7C59] text-white font-medium text-[14px] hover:bg-[#3D6549] transition-colors"
              >
                Mark as Done
              </button>
            )}
          </div>

          {/* Target Date */}
          {goal.target_date && (
            <div className="bg-white rounded-xl p-4 border border-[#C9A227]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#C9A227] uppercase tracking-wide font-medium mb-1">Target Date</p>
                  <p className="text-[#1A1A1A] font-medium text-[14px]">
                    {new Date(goal.target_date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  {(() => {
                    const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (daysLeft < 0) {
                      return <p className="text-[#C77B58] font-semibold text-[14px]">Overdue</p>;
                    } else if (daysLeft === 0) {
                      return <p className="text-[#C9A227] font-semibold text-[14px]">Due Today</p>;
                    } else {
                      return (
                        <div>
                          <p className="text-[#C9A227] font-semibold text-xl">{daysLeft}</p>
                          <p className="text-[11px] text-[#8A8A8A]">days left</p>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Streak */}
            <div className="bg-white rounded-xl p-3 text-center border border-[#C77B58]/20">
              <p className="text-xl font-semibold text-[#C77B58]">{goal.current_streak}</p>
              <p className="text-[10px] text-[#8A8A8A] font-medium uppercase">Streak</p>
            </div>
            
            {/* Difficulty */}
            <div className="bg-white rounded-xl p-3 text-center border border-black/[0.06]">
              <p className="text-xl font-semibold text-[#4A4A4A]">{goal.difficulty_level}/5</p>
              <p className="text-[10px] text-[#8A8A8A] font-medium uppercase">{getDifficultyLabel(goal.difficulty_level)}</p>
            </div>
            
            {/* Commitment */}
            <div className="bg-white rounded-xl p-3 text-center border border-[#4A90A4]/20">
              <p className="text-xl font-semibold text-[#4A90A4]">{goal.commitment_days}</p>
              <p className="text-[10px] text-[#8A8A8A] font-medium uppercase">Days/Wk</p>
            </div>
          </div>

          {/* Blocker */}
          {goal.blocker && (
            <div className="bg-white rounded-xl p-3 border border-[#C9A227]/20">
              <p className="text-[11px] text-[#C9A227] uppercase tracking-wide font-medium mb-1">Challenge</p>
              <p className="text-[#4A4A4A] text-[13px]">{goal.blocker}</p>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-6 py-4 bg-white border-t border-black/[0.06] flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 py-2.5 rounded-xl bg-transparent border border-black/[0.08] text-[#4A4A4A] font-medium text-[13px] hover:bg-black/[0.02] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onPause}
            className="flex-1 py-2.5 rounded-xl bg-transparent border border-black/[0.08] text-[#8A8A8A] font-medium text-[13px] hover:text-[#C77B58] hover:border-[#C77B58]/30 transition-colors"
          >
            Pause
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default GoalsModal;

import React, { useEffect, useState } from 'react';
import { GoalWithStreak } from '../lib/goals';
import { getCharacterAvatar } from '../lib/characters';

interface ChallengeCompletedModalProps {
  goal: GoalWithStreak;
  newStreak: number;
  pointsEarned: number;
  onClose: () => void;
  onContinueChat: () => void;
  nextTask?: GoalWithStreak | null;
  onNextTask?: () => void;
}

const ChallengeCompletedModal: React.FC<ChallengeCompletedModalProps> = ({
  goal,
  newStreak,
  pointsEarned,
  onClose,
  onContinueChat,
  nextTask,
  onNextTask,
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    // Progressive animation steps
    const timers = [
      setTimeout(() => setAnimationStep(1), 100),  // Trophy bounces in
      setTimeout(() => setAnimationStep(2), 400),  // Message fades in
      setTimeout(() => setAnimationStep(3), 700),  // Stats appear
      setTimeout(() => setAnimationStep(4), 1000), // Actions appear
    ];

    // Hide confetti after animation
    const confettiTimer = setTimeout(() => setShowConfetti(false), 3000);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(confettiTimer);
    };
  }, []);

  // Get milestone message
  const getMilestoneMessage = () => {
    if (newStreak === 7) return "🎉 One week streak! You're on fire!";
    if (newStreak === 14) return "🌟 Two weeks strong! Incredible!";
    if (newStreak === 30) return "🏅 One month! You're a champion!";
    if (newStreak === 100) return "👑 100 days! You're legendary!";
    if (newStreak >= 50) return "⚡ Unstoppable! Keep going!";
    if (newStreak >= 21) return "💪 Habit formed! You got this!";
    if (newStreak >= 10) return "🔥 Double digits! Amazing!";
    if (newStreak >= 5) return "✨ Five day streak! Great momentum!";
    if (newStreak >= 3) return "🌱 Building consistency!";
    return "🎯 Great start!";
  };

  const isNewMilestone = [7, 14, 21, 30, 50, 100].includes(newStreak);

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md animate-fade-in">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => {
            const emoji = ['🎉', '⭐', '✨', '🎊', '💫', '🌟', '🔥', '💪'][Math.floor(Math.random() * 8)];
            const left = Math.random() * 100;
            const delay = Math.random() * 0.5;
            const duration = 2 + Math.random() * 1;
            const size = 14 + Math.random() * 10;
            
            return (
              <div
                key={i}
                className="absolute animate-confetti-fall"
                style={{
                  left: `${left}%`,
                  top: '-20px',
                  fontSize: `${size}px`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                }}
              >
                {emoji}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Content */}
      <div className={`relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ${
        animationStep >= 1 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
      }`}>
        {/* Celebration Header */}
        <div className="relative bg-gradient-to-br from-[#4A7C59] via-[#5A9469] to-[#6BAB79] px-6 py-8 text-center overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          {/* Trophy/Check animation */}
          <div className={`relative transition-all duration-700 ease-out ${
            animationStep >= 1 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-75'
          }`}>
            <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ${
              isNewMilestone ? 'animate-bounce-gentle' : ''
            }`}>
              <span className="text-5xl">{isNewMilestone ? '🏆' : '✅'}</span>
            </div>
          </div>

          <h2 className={`text-2xl font-bold text-white mb-2 transition-all duration-500 delay-200 ${
            animationStep >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}>
            Challenge Complete!
          </h2>
          
          <p className={`text-white/90 text-[15px] transition-all duration-500 delay-300 ${
            animationStep >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}>
            {getMilestoneMessage()}
          </p>
        </div>

        {/* Stats Section */}
        <div className="px-6 py-5 bg-[#FAF9F6]">
          <div className={`grid grid-cols-2 gap-3 mb-5 transition-all duration-500 delay-500 ${
            animationStep >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            {/* Streak */}
            <div className="bg-white rounded-xl p-4 text-center border border-[#C77B58]/20">
              <div className="text-3xl font-bold text-[#C77B58] mb-1">
                🔥 {newStreak}
              </div>
              <div className="text-[11px] text-[#8A8A8A] uppercase tracking-wide font-medium">
                Day Streak
              </div>
            </div>

            {/* Points */}
            <div className="bg-white rounded-xl p-4 text-center border border-[#C9A227]/20">
              <div className="text-3xl font-bold text-[#C9A227] mb-1">
                +{pointsEarned}
              </div>
              <div className="text-[11px] text-[#8A8A8A] uppercase tracking-wide font-medium">
                Points Earned
              </div>
            </div>
          </div>

          {/* Completed Task */}
          <div className={`bg-white rounded-xl p-4 border border-[#4A7C59]/20 mb-4 transition-all duration-500 delay-600 ${
            animationStep >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            <div className="flex items-center gap-3">
              <img 
                src={getCharacterAvatar(goal.creator_id)} 
                alt={goal.creator_id}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#4A7C59] font-medium">Completed</p>
                <p className="text-[14px] text-[#1A1A1A] font-medium truncate">{goal.daily_task}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#4A7C59]/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#4A7C59]">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Next Task Preview (if available) */}
          {nextTask && (
            <div className={`bg-gradient-to-r from-[#4A90A4]/5 to-[#4A90A4]/10 rounded-xl p-4 border border-[#4A90A4]/20 mb-4 transition-all duration-500 delay-700 ${
              animationStep >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">👉</span>
                <p className="text-[12px] text-[#4A90A4] font-semibold uppercase tracking-wide">Up Next</p>
              </div>
              <div className="flex items-center gap-3">
                <img 
                  src={getCharacterAvatar(nextTask.creator_id)} 
                  alt={nextTask.creator_id}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <p className="text-[14px] text-[#1A1A1A] flex-1">{nextTask.daily_task}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`px-6 pb-6 bg-[#FAF9F6] flex flex-col gap-3 transition-all duration-500 delay-800 ${
          animationStep >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          {nextTask && onNextTask ? (
            <>
              <button
                onClick={onNextTask}
                className="w-full py-3.5 rounded-xl bg-[#4A7C59] text-white font-semibold text-[15px] hover:bg-[#3D6549] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>Continue to Next Task</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-transparent text-[#8A8A8A] font-medium text-[14px] hover:bg-black/[0.02] transition-colors"
              >
                Done for now
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onContinueChat}
                className="w-full py-3.5 rounded-xl bg-[#4A7C59] text-white font-semibold text-[15px] hover:bg-[#3D6549] active:scale-[0.98] transition-all"
              >
                Chat with {goal.creator_id}
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-transparent text-[#8A8A8A] font-medium text-[14px] hover:bg-black/[0.02] transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        @keyframes confetti-fall {
          0% { 
            transform: translateY(0) rotate(0deg) scale(1); 
            opacity: 1; 
          }
          50% {
            opacity: 1;
          }
          100% { 
            transform: translateY(80vh) rotate(720deg) scale(0.5); 
            opacity: 0; 
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall 2.5s ease-out forwards;
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ChallengeCompletedModal;

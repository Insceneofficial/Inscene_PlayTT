import React from 'react';
import { GoalWithStreak } from '../lib/goals';
import { getCharacterAvatar } from '../lib/characters';

interface WhatsNextPromptProps {
  type: 'task_completed' | 'session_end' | 'daily_reminder' | 'streak_risk';
  goal?: GoalWithStreak | null;
  nextTask?: GoalWithStreak | null;
  streakCount?: number;
  onAction: (action: 'continue_chat' | 'next_task' | 'dismiss') => void;
}

const WhatsNextPrompt: React.FC<WhatsNextPromptProps> = ({
  type,
  goal,
  nextTask,
  streakCount = 0,
  onAction,
}) => {
  // Get content based on type
  const getContent = () => {
    switch (type) {
      case 'task_completed':
        return {
          icon: '✨',
          title: 'Great job!',
          subtitle: nextTask 
            ? "Ready for the next challenge?" 
            : "You're making progress!",
          bgGradient: 'from-[#4A7C59]/10 to-[#4A7C59]/5',
          borderColor: 'border-[#4A7C59]/20',
          accentColor: '#4A7C59',
        };
      
      case 'session_end':
        return {
          icon: '👋',
          title: 'Before you go...',
          subtitle: goal?.completed_today 
            ? "See you tomorrow for your next challenge!"
            : "Don't forget today's task!",
          bgGradient: 'from-[#4A90A4]/10 to-[#4A90A4]/5',
          borderColor: 'border-[#4A90A4]/20',
          accentColor: '#4A90A4',
        };
      
      case 'daily_reminder':
        return {
          icon: '📌',
          title: "Today's Challenge",
          subtitle: `Keep your ${streakCount} day streak going!`,
          bgGradient: 'from-[#C9A227]/10 to-[#C9A227]/5',
          borderColor: 'border-[#C9A227]/20',
          accentColor: '#C9A227',
        };
      
      case 'streak_risk':
        return {
          icon: '⚠️',
          title: 'Streak at risk!',
          subtitle: `Complete your task to save your ${streakCount} day streak`,
          bgGradient: 'from-[#C77B58]/10 to-[#C77B58]/5',
          borderColor: 'border-[#C77B58]/20',
          accentColor: '#C77B58',
        };
      
      default:
        return {
          icon: '👉',
          title: 'What\'s next?',
          subtitle: 'Continue your journey',
          bgGradient: 'from-white to-[#FAF9F6]',
          borderColor: 'border-black/[0.06]',
          accentColor: '#4A7C59',
        };
    }
  };

  const content = getContent();
  const showCurrentTask = goal && !goal.completed_today && (type !== 'task_completed' || !nextTask);
  const showNextTask = nextTask && type === 'task_completed';

  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br ${content.bgGradient} border ${content.borderColor} animate-slide-up`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{content.icon}</span>
        <div>
          <h4 className="text-[14px] font-semibold text-[#1A1A1A]">{content.title}</h4>
          <p className="text-[12px] text-[#8A8A8A]">{content.subtitle}</p>
        </div>
      </div>

      {/* Current Task Card */}
      {showCurrentTask && (
        <div className="bg-white rounded-xl p-3 border border-black/[0.04] mb-3">
          <div className="flex items-center gap-3">
            <img 
              src={getCharacterAvatar(goal.creator_id)} 
              alt={goal.creator_id}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#8A8A8A] uppercase tracking-wide font-medium">Today's Task</p>
              <p className="text-[13px] text-[#1A1A1A] font-medium truncate">{goal.daily_task}</p>
            </div>
          </div>
          
        </div>
      )}

      {/* Next Task Card */}
      {showNextTask && (
        <div className="bg-white rounded-xl p-3 border border-black/[0.04] mb-3">
          <div className="flex items-center gap-3">
            <img 
              src={getCharacterAvatar(nextTask.creator_id)} 
              alt={nextTask.creator_id}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#4A7C59] uppercase tracking-wide font-medium">Up Next</p>
              <p className="text-[13px] text-[#1A1A1A] font-medium truncate">{nextTask.daily_task}</p>
            </div>
          </div>
          
          <button
            onClick={() => onAction('next_task')}
            className="w-full mt-3 py-2.5 rounded-lg bg-[#4A7C59] text-white font-semibold text-[13px] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>Continue</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {type === 'task_completed' && !nextTask && (
          <button
            onClick={() => onAction('continue_chat')}
            className="flex-1 py-2.5 rounded-lg bg-[#4A7C59] text-white font-semibold text-[13px] transition-all active:scale-[0.98]"
          >
            Keep Chatting
          </button>
        )}
        
        {type === 'session_end' && !goal?.completed_today && (
          <button
            onClick={() => onAction('continue_chat')}
            className="flex-1 py-2.5 rounded-lg bg-[#4A90A4] text-white font-semibold text-[13px] transition-all active:scale-[0.98]"
          >
            Stay & Complete Task
          </button>
        )}
        
        <button
          onClick={() => onAction('dismiss')}
          className="px-4 py-2.5 rounded-lg bg-black/[0.04] text-[#8A8A8A] font-medium text-[13px] hover:bg-black/[0.06] transition-colors"
        >
          {type === 'task_completed' ? 'Done for now' : 'Dismiss'}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default WhatsNextPrompt;

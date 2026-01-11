import React, { useState, useEffect } from 'react';
import { getAllGoals, getGoalProgressHistory, GoalWithStreak } from '../lib/goals';
import { getCharacterAvatar } from '../lib/characters';

interface CalendarViewProps {
  onClose: () => void;
  onGoalSelect?: (goal: GoalWithStreak) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ onClose, onGoalSelect }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalWithStreak[]>([]);
  const [progressByGoal, setProgressByGoal] = useState<Record<string, Record<string, boolean>>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load goals and progress
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const allGoals = await getAllGoals();
      setGoals(allGoals);
      
      // Load progress for each goal
      const progressMap: Record<string, Record<string, boolean>> = {};
      await Promise.all(
        allGoals.map(async (goal) => {
          progressMap[goal.id] = await getGoalProgressHistory(goal.id);
        })
      );
      setProgressByGoal(progressMap);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const navigateMonth = (delta: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
    setSelectedDate(null);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date().toISOString().split('T')[0];

  // Get goals for a specific date
  const getGoalsForDate = (dateKey: string): GoalWithStreak[] => {
    return goals.filter(goal => {
      if (goal.target_date === dateKey) return true;
      if (goal.created_at.split('T')[0] === dateKey) return true;
      return false;
    });
  };

  // Check if any goal has progress on this date
  const getProgressForDate = (dateKey: string): { completed: number; total: number } => {
    let completed = 0;
    let total = 0;
    
    goals.forEach(goal => {
      if (goal.status !== 'active') return;
      
      const startDate = goal.created_at.split('T')[0];
      const endDate = goal.target_date;
      
      if (dateKey >= startDate && (!endDate || dateKey <= endDate)) {
        total++;
        if (progressByGoal[goal.id]?.[dateKey]) {
          completed++;
        }
      }
    });
    
    return { completed, total };
  };

  // Get goal deadline indicator
  const getDeadlineGoals = (dateKey: string): GoalWithStreak[] => {
    return goals.filter(goal => goal.target_date === dateKey && goal.status === 'active');
  };

  const renderCalendarDays = () => {
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-11" />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = dateKey === today;
      const isSelected = dateKey === selectedDate;
      const progress = getProgressForDate(dateKey);
      const deadlineGoals = getDeadlineGoals(dateKey);
      const hasGoals = getGoalsForDate(dateKey).length > 0;
      
      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
          className={`
            relative h-11 rounded-xl flex flex-col items-center justify-center transition-all font-medium text-[14px]
            ${isToday && !isSelected ? 'bg-[#4A7C59] text-white' : ''}
            ${isSelected ? 'bg-[#1A1A1A] text-white' : ''}
            ${!isToday && !isSelected ? 'text-[#4A4A4A] hover:bg-black/[0.04]' : ''}
            ${deadlineGoals.length > 0 && !isSelected ? 'ring-1 ring-[#C9A227]' : ''}
          `}
        >
          {day}
          
          {/* Progress dots */}
          {progress.total > 0 && !isSelected && (
            <div className="absolute bottom-1 flex gap-0.5">
              {progress.completed > 0 && (
                <div className="w-1 h-1 rounded-full bg-[#4A7C59]" />
              )}
              {progress.total - progress.completed > 0 && (
                <div className="w-1 h-1 rounded-full bg-[#ACACAC]" />
              )}
            </div>
          )}
          
          {/* Deadline indicator */}
          {deadlineGoals.length > 0 && !isSelected && (
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#C9A227] flex items-center justify-center text-[9px] font-semibold text-white">
              {deadlineGoals.length}
            </div>
          )}
        </button>
      );
    }
    
    return days;
  };

  const activeGoalsOnDate = selectedDate 
    ? goals.filter(goal => {
        const startDate = goal.created_at.split('T')[0];
        const endDate = goal.target_date;
        return goal.status === 'active' && selectedDate >= startDate && (!endDate || selectedDate <= endDate);
      })
    : [];

  const getDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-[#FAF9F6] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-[#FAF9F6] border-b border-black/[0.06]">
        <div>
          <h3 className="text-[18px] font-semibold text-[#1A1A1A] tracking-tight">Progress</h3>
          <p className="text-[12px] text-[#8A8A8A]">Track your daily goals</p>
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
        <div className="flex-1 overflow-y-auto pb-28">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-black/[0.04]">
            <button
              onClick={() => navigateMonth(-1)}
              className="w-9 h-9 rounded-xl bg-black/[0.04] flex items-center justify-center hover:bg-black/[0.08] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#4A4A4A]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            
            <h2 className="text-[16px] font-semibold text-[#1A1A1A]">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            
            <button
              onClick={() => navigateMonth(1)}
              className="w-9 h-9 rounded-xl bg-black/[0.04] flex items-center justify-center hover:bg-black/[0.08] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#4A4A4A]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 px-4 py-3 bg-white border-b border-black/[0.04]">
            {dayNames.map((day, i) => (
              <div key={i} className="h-6 flex items-center justify-center">
                <span className="text-[11px] font-medium text-[#ACACAC]">{day}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 px-4 py-3 bg-white">
            {renderCalendarDays()}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4A7C59]" />
              <span className="text-[11px] text-[#8A8A8A] font-medium">Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ACACAC]" />
              <span className="text-[11px] text-[#8A8A8A] font-medium">Missed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#C9A227]" />
              <span className="text-[11px] text-[#8A8A8A] font-medium">Deadline</span>
            </div>
          </div>

          {/* Selected Date Goals */}
          {selectedDate && (
            <div className="mt-6 px-4 animate-fade-in">
              <h3 className="text-[12px] font-medium text-[#8A8A8A] uppercase tracking-wide mb-3">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              
              {activeGoalsOnDate.length === 0 ? (
                <div className="bg-white rounded-xl p-5 border border-black/[0.06] text-center">
                  <p className="text-[#8A8A8A] text-[14px]">No goals for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeGoalsOnDate.map(goal => {
                    const isDeadline = goal.target_date === selectedDate;
                    const wasCompleted = progressByGoal[goal.id]?.[selectedDate];
                    const daysRemaining = goal.target_date ? getDaysRemaining(goal.target_date) : null;
                    
                    return (
                      <div
                        key={goal.id}
                        onClick={() => onGoalSelect?.(goal)}
                        className={`bg-white rounded-xl p-4 border transition-all cursor-pointer hover:shadow-sm ${
                          isDeadline ? 'border-[#C9A227]/30' : 'border-black/[0.06]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <img 
                            src={getCharacterAvatar(goal.creator_id)} 
                            alt={goal.creator_id}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[#1A1A1A] font-medium text-[14px] truncate">{goal.title}</h4>
                            <p className="text-[#8A8A8A] text-[13px] truncate">{goal.daily_task}</p>
                            
                            <div className="flex items-center gap-3 mt-2">
                              {isDeadline && (
                                <span className="text-[#C9A227] text-[12px] font-medium">Deadline</span>
                              )}
                              {daysRemaining !== null && daysRemaining > 0 && !isDeadline && (
                                <span className="text-[#8A8A8A] text-[12px]">{daysRemaining}d left</span>
                              )}
                              <span className="text-[#C77B58] text-[12px] font-medium">{goal.current_streak} streak</span>
                              {wasCompleted !== undefined && (
                                <span className={`text-[12px] ${wasCompleted ? 'text-[#4A7C59]' : 'text-[#ACACAC]'}`}>
                                  {wasCompleted ? '✓ Done' : '○ Pending'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* All Goals Summary */}
          {!selectedDate && goals.length > 0 && (
            <div className="mt-6 px-4">
              <h3 className="text-[12px] font-medium text-[#8A8A8A] uppercase tracking-wide mb-3">
                Your Goals ({goals.filter(g => g.status === 'active').length})
              </h3>
              <div className="space-y-3">
                {goals.filter(g => g.status === 'active').map(goal => {
                  const daysRemaining = goal.target_date ? getDaysRemaining(goal.target_date) : null;
                  
                  return (
                    <div
                      key={goal.id}
                      onClick={() => onGoalSelect?.(goal)}
                      className="bg-white rounded-xl p-4 border border-black/[0.06] cursor-pointer hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <img 
                          src={getCharacterAvatar(goal.creator_id)} 
                          alt={goal.creator_id}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[#1A1A1A] font-medium text-[14px] truncate">{goal.title}</h4>
                          <p className="text-[#8A8A8A] text-[13px] truncate">{goal.daily_task}</p>
                          
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[#C77B58] text-[12px] font-medium">{goal.current_streak} streak</span>
                            {daysRemaining !== null && (
                              <span className={`text-[12px] ${daysRemaining < 0 ? 'text-[#C77B58]' : daysRemaining <= 7 ? 'text-[#C9A227]' : 'text-[#8A8A8A]'}`}>
                                {daysRemaining < 0 
                                  ? `${Math.abs(daysRemaining)}d overdue`
                                  : daysRemaining === 0 
                                    ? 'Due today'
                                    : `${daysRemaining}d left`
                                }
                              </span>
                            )}
                            {goal.completed_today ? (
                              <span className="text-[#4A7C59] text-[12px]">✓ Done today</span>
                            ) : (
                              <span className="text-[#ACACAC] text-[12px]">○ Pending</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!selectedDate && goals.length === 0 && (
            <div className="mt-16 px-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#4A7C59]/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#4A7C59]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="text-[17px] font-semibold text-[#1A1A1A] mb-1">No Goals Yet</h3>
              <p className="text-[#8A8A8A] text-[14px] max-w-[260px] mx-auto">
                Start a chat with any coach to set your first goal
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

export default CalendarView;

import React from 'react';
import { Milestone, GoalStatus } from '../lib/goalTracking';

interface HorizontalMilestoneTimelineProps {
  milestones: Milestone[];
  currentMilestoneIndex: number;
  currentStatus: GoalStatus;
  themeColor?: string;
}

const HorizontalMilestoneTimeline: React.FC<HorizontalMilestoneTimelineProps> = ({
  milestones,
  currentMilestoneIndex,
  currentStatus,
  themeColor = '#8b5cf6',
}) => {
  const getStatusColor = (index: number, status: GoalStatus): string => {
    if (index < currentMilestoneIndex) {
      return 'text-green-400';
    } else if (index === currentMilestoneIndex) {
      if (status === 'Completed') return 'text-green-400';
      if (status === 'In Progress') return themeColor;
      if (status === 'Stuck') return 'text-orange-400';
      return 'text-white/40';
    } else {
      return 'text-white/20';
    }
  };

  const getProgressWidth = (index: number): number => {
    if (index < currentMilestoneIndex) return 100;
    if (index === currentMilestoneIndex && currentStatus === 'Completed') return 100;
    if (index === currentMilestoneIndex && currentStatus === 'In Progress') return 50;
    return 0;
  };

  return (
    <div className="relative">
      {/* Progress line */}
      <div className="absolute top-6 left-0 right-0 h-0.5 bg-white/10">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${((currentMilestoneIndex + (currentStatus === 'Completed' ? 1 : 0.5)) / milestones.length) * 100}%`,
            backgroundColor: currentMilestoneIndex < milestones.length - 1 ? themeColor : '#10b981',
          }}
        />
      </div>

      {/* Milestones */}
      <div className="relative flex justify-between items-start">
        {milestones.map((milestone, index) => {
          const isCompleted = index < currentMilestoneIndex || (index === currentMilestoneIndex && currentStatus === 'Completed');
          const isCurrent = index === currentMilestoneIndex;
          const isUpcoming = index > currentMilestoneIndex;

          return (
            <div key={milestone.id} className="flex flex-col items-center flex-1">
              {/* Milestone dot */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all backdrop-blur-sm ${
                  isCompleted
                    ? 'bg-green-500/20 border-2 border-green-400 text-green-400'
                    : isCurrent
                    ? 'bg-white/5 border-2 text-white'
                    : 'bg-white/[0.02] border-2 border-white/10 text-white/30'
                }`}
                style={isCurrent && !isCompleted ? {
                  backgroundColor: `${themeColor}20`,
                  borderColor: themeColor,
                } : {}}
              >
                {isCompleted ? '✓' : index + 1}
              </div>

              {/* Milestone label */}
              <div className="mt-2.5 text-center max-w-[100px]">
                <div className={`text-[10px] font-medium mb-0.5 ${getStatusColor(index, milestone.status)}`}>
                  {isCompleted ? 'Done' : isCurrent ? 'Current' : 'Upcoming'}
                </div>
                <div className="text-[9px] text-white/50 leading-tight line-clamp-2">
                  {milestone.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HorizontalMilestoneTimeline;


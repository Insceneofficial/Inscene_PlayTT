import React from 'react';
import { Milestone, GoalStatus } from '../lib/goalTracking';

interface MilestoneTimelineProps {
  milestones: Milestone[];
  currentMilestoneIndex: number;
  currentStatus: GoalStatus;
}

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  milestones,
  currentMilestoneIndex,
  currentStatus,
}) => {
  const getStatusIcon = (index: number, status: GoalStatus): string => {
    if (index < currentMilestoneIndex) {
      return '✅';
    } else if (index === currentMilestoneIndex) {
      if (status === 'Completed') return '✅';
      if (status === 'In Progress') return '🔄';
      if (status === 'Stuck') return '⚠️';
      return '⏸️';
    } else {
      return '○';
    }
  };

  const getStatusColor = (index: number, status: GoalStatus): string => {
    if (index < currentMilestoneIndex) {
      return 'text-green-400';
    } else if (index === currentMilestoneIndex) {
      if (status === 'Completed') return 'text-green-400';
      if (status === 'In Progress') return 'text-violet-400';
      if (status === 'Stuck') return 'text-orange-400';
      return 'text-white/40';
    } else {
      return 'text-white/20';
    }
  };

  const getLineColor = (index: number): string => {
    if (index < currentMilestoneIndex) {
      return 'bg-green-400';
    } else if (index === currentMilestoneIndex && currentStatus === 'Completed') {
      return 'bg-green-400';
    } else {
      return 'bg-white/10';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {milestones.map((milestone, index) => (
        <div key={milestone.id} className="flex gap-4">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={`text-2xl ${getStatusColor(index, milestone.status)}`}>
              {getStatusIcon(index, milestone.status)}
            </div>
            {index < milestones.length - 1 && (
              <div className={`w-0.5 h-16 mt-2 ${getLineColor(index)}`} />
            )}
          </div>
          
          {/* Milestone content */}
          <div className="flex-1 pb-4">
            <div className={`font-medium mb-1 ${getStatusColor(index, milestone.status)}`}>
              Milestone {index + 1}
            </div>
            <div className="text-white/80 text-sm">{milestone.title}</div>
            {index === currentMilestoneIndex && currentStatus !== 'Not Started' && (
              <div className="text-white/50 text-xs mt-1">
                Status: {currentStatus}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MilestoneTimeline;


import React, { useState, useEffect } from 'react';
import { getCurrentGoal, UserGoal, updateGoalStatus, GoalStatus } from '../lib/goalTracking';
import { 
  getUserGamification, 
  getEarnedBadges, 
  recordCheckIn, 
  checkAndAwardBadges,
  getPointsForNextLevel,
  UserGamification,
  UserBadge,
  BadgeType
} from '../lib/gamification';
import { getCharacterTheme, getCharacterAvatar } from '../lib/characters';
import { isUserLoggedIn } from '../lib/chatStorage';
import HorizontalMilestoneTimeline from './HorizontalMilestoneTimeline';
import BadgeDisplay from './BadgeDisplay';
import { getBadgeInfo } from '../lib/gamification';

const NewBadgeNotification: React.FC<{ badges: BadgeType[] }> = ({ badges }) => {
  return (
    <div className="bg-white/[0.05] backdrop-blur-xl border border-white/20 rounded-xl p-3 flex items-center gap-3">
      <div className="text-lg">🎉</div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-white">New Badge Unlocked!</div>
        <div className="text-xs text-white/70">
          {badges.map((badgeType, i) => {
            const badgeInfo = getBadgeInfo(badgeType);
            return i === 0 ? badgeInfo.name : `, ${badgeInfo.name}`;
          })}
        </div>
      </div>
    </div>
  );
};

interface GoalTrackerProps {
  characterName: string;
  onOpenChat?: () => void;
}

const GoalTracker: React.FC<GoalTrackerProps> = ({ characterName, onOpenChat }) => {
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [newBadges, setNewBadges] = useState<BadgeType[]>([]);

  const theme = getCharacterTheme(characterName);
  const avatar = getCharacterAvatar(characterName);

  // Theme color mapping
  const themeColors: Record<string, string> = {
    blue: '#3b82f6',
    pink: '#ec4899',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    green: '#10b981',
  };

  const themeColor = themeColors[theme] || themeColors.purple;

  useEffect(() => {
    loadData();
  }, [characterName]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [goalData, gamificationData, badgesData] = await Promise.all([
        getCurrentGoal(characterName),
        getUserGamification(characterName),
        getEarnedBadges(characterName),
      ]);

      setGoal(goalData);
      setGamification(gamificationData);
      setBadges(badgesData);
    } catch (error) {
      console.error('Failed to load goal tracker data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!goal || checkingIn) return;

    setCheckingIn(true);
    try {
      // Record check-in in gamification system
      await recordCheckIn(characterName, goal.id);
      
      // Check for new badges
      const awarded = await checkAndAwardBadges(characterName, goal.id);
      if (awarded.length > 0) {
        setNewBadges(awarded);
        // Reload badges
        const updatedBadges = await getEarnedBadges(characterName);
        setBadges(updatedBadges);
      }

      // Reload gamification stats
      const updatedGamification = await getUserGamification(characterName);
      setGamification(updatedGamification);

      // Show success message
      setTimeout(() => {
        setNewBadges([]);
      }, 3000);
    } catch (error) {
      console.error('Failed to check in', error);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleMarkMilestoneComplete = async (milestoneIndex: number) => {
    if (!goal) return;

    try {
      const nextIndex = milestoneIndex + 1;
      await updateGoalStatus(characterName, 'Completed', nextIndex);
      
      // Record milestone completion in gamification
      const { recordActivity } = await import('../lib/gamification');
      await recordActivity(characterName, 'milestone_completed', goal.id, {
        milestone_index: milestoneIndex,
      });

      // Check for badges
      const awarded = await checkAndAwardBadges(characterName, goal.id);
      if (awarded.length > 0) {
        setNewBadges(awarded);
        const updatedBadges = await getEarnedBadges(characterName);
        setBadges(updatedBadges);
      }

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Failed to mark milestone complete', error);
    }
  };

  const calculateProgress = (): number => {
    if (!goal || goal.milestones.length === 0) return 0;
    
    const completed = goal.current_milestone_index;
    const total = goal.milestones.length;
    
    // If current milestone is completed, count it
    if (goal.current_status === 'Completed') {
      return ((completed + 1) / total) * 100;
    }
    
    // Otherwise, base progress on completed milestones
    return (completed / total) * 100;
  };

  const getProgressToNextLevel = (): number => {
    if (!gamification) return 0;
    
    const currentLevelPoints = gamification.level === 1 ? 0 : getPointsForNextLevel(gamification.level - 1);
    const nextLevelPoints = getPointsForNextLevel(gamification.level);
    const progress = ((gamification.total_points - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100;
    
    return Math.max(0, Math.min(100, progress));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/60">Loading your goals...</div>
      </div>
    );
  }

  // Show demo view if user is not logged in
  if (!isUserLoggedIn()) {
    return <DemoGoalTracker characterName={characterName} themeColor={themeColor} avatar={avatar} onOpenChat={onOpenChat} />;
  }

  if (!goal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center px-6">
        <div className="text-6xl mb-4">🎯</div>
        <h3 className="text-2xl font-bold text-white">No Goal Set Yet</h3>
        <p className="text-white/60 max-w-md">
          Start your journey by setting a goal with {characterName}. They'll help you break it down into achievable milestones.
        </p>
        {onOpenChat && (
          <button
            onClick={onOpenChat}
            className="px-6 py-3 bg-violet-500 hover:bg-violet-600 rounded-full font-medium text-white transition-colors"
          >
            Set Your First Goal
          </button>
        )}
      </div>
    );
  }

  const progress = calculateProgress();
  const earnedBadgeTypes = badges.map(b => b.badge_type);

  return (
    <div className="space-y-6 pb-8">
      {/* New Badge Notifications */}
      {newBadges.length > 0 && (
        <NewBadgeNotification badges={newBadges} />
      )}

      {/* Badges Row - Top */}
      <div className="bg-white/[0.03] backdrop-blur-2xl rounded-xl p-4 border border-white/10">
        <BadgeDisplay
          characterName={characterName}
          earnedBadges={earnedBadgeTypes}
        />
      </div>

      {/* Header Section with Single-Line Stats */}
      <div className="bg-white/[0.03] backdrop-blur-2xl rounded-xl p-5 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <img src={avatar} alt={characterName} className="w-10 h-10 rounded-full" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{characterName}</h2>
            <p className="text-sm text-white/70 truncate">{goal.goal_text}</p>
          </div>
        </div>

        {/* Single-Line Stats Bar */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Progress</span>
            <span className="text-base font-semibold text-white">{Math.round(progress)}%</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Level</span>
            <span className="text-base font-semibold text-white">Lv.{gamification?.level || 1}</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <span className="text-base font-semibold text-white">{gamification?.current_streak || 0}</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Points</span>
            <span className="text-base font-semibold text-white">{gamification?.total_points || 0}</span>
          </div>
        </div>
      </div>

      {/* Milestone Timeline - Horizontal */}
      <div className="bg-white/[0.03] backdrop-blur-2xl rounded-xl p-6 border border-white/10">
        <HorizontalMilestoneTimeline
          milestones={goal.milestones}
          currentMilestoneIndex={goal.current_milestone_index}
          currentStatus={goal.current_status}
          themeColor={themeColor}
        />
      </div>

      {/* Chat-Powered Actions */}
      <div className="flex gap-3">
        {onOpenChat && (
          <>
            <button
              onClick={onOpenChat}
              className="flex-1 px-4 py-2.5 bg-white/[0.05] backdrop-blur-xl hover:bg-white/[0.08] border border-white/10 rounded-lg text-sm font-medium text-white transition-all"
            >
              Update via Chat
            </button>
            {goal.current_status === 'Stuck' && (
              <button
                onClick={onOpenChat}
                className="flex-1 px-4 py-2.5 bg-white/[0.05] backdrop-blur-xl hover:bg-white/[0.08] border border-white/10 rounded-lg text-sm font-medium text-white transition-all"
              >
                Ask for Help
              </button>
            )}
          </>
        )}
        <button
          onClick={handleCheckIn}
          disabled={checkingIn}
          className="px-4 py-2.5 bg-white/[0.05] backdrop-blur-xl hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm font-medium text-white transition-all"
        >
          {checkingIn ? 'Checking in...' : 'Check In'}
        </button>
      </div>
    </div>
  );
};

// Demo Goal Tracker Component - Shows how it works
const DemoGoalTracker: React.FC<{
  characterName: string;
  themeColor: string;
  avatar: string;
  onOpenChat?: () => void;
}> = ({ characterName, themeColor, avatar, onOpenChat }) => {
  // Demo data
  const demoGoal = {
    goal_text: "Become a professional filmmaker",
    current_status: "In Progress" as GoalStatus,
    current_milestone_index: 1,
    milestones: [
      { id: '1', title: 'Learn camera basics and composition', status: 'Completed' as GoalStatus, order: 0 },
      { id: '2', title: 'Create 5 short films', status: 'In Progress' as GoalStatus, order: 1 },
      { id: '3', title: 'Build a portfolio website', status: 'Not Started' as GoalStatus, order: 2 },
      { id: '4', title: 'Network with industry professionals', status: 'Not Started' as GoalStatus, order: 3 },
    ],
  };

  const demoGamification = {
    current_streak: 7,
    total_points: 185,
    level: 2,
  };

  const demoBadges: BadgeType[] = ['first_goal', 'first_milestone', 'streak_7', 'consistent'];

  const progress = 50; // 2 out of 4 milestones
  const levelProgress = 35; // Example progress

  return (
    <div className="space-y-6 pb-8">
      {/* Demo Banner */}
      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/20 rounded-xl p-3 flex items-center gap-3">
        <div className="text-lg">👀</div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Demo Mode</div>
          <div className="text-xs text-white/60">This is how your goal tracker will look. Sign in to start tracking your own goals!</div>
        </div>
      </div>

      {/* Badges Row - Top */}
      <div className="bg-white/[0.03] backdrop-blur-2xl rounded-xl p-4 border border-white/10">
        <BadgeDisplay
          characterName={characterName}
          earnedBadges={demoBadges}
        />
      </div>

      {/* Header Section with Single-Line Stats */}
      <div className="bg-white/[0.03] backdrop-blur-2xl rounded-xl p-5 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <img src={avatar} alt={characterName} className="w-10 h-10 rounded-full" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{characterName}</h2>
            <p className="text-sm text-white/70 truncate">{demoGoal.goal_text}</p>
          </div>
        </div>

        {/* Single-Line Stats Bar */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Progress</span>
            <span className="text-base font-semibold text-white">{Math.round(progress)}%</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Level</span>
            <span className="text-base font-semibold text-white">Lv.{demoGamification.level}</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <span className="text-base font-semibold text-white">{demoGamification.current_streak}</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Points</span>
            <span className="text-base font-semibold text-white">{demoGamification.total_points}</span>
          </div>
        </div>
      </div>

      {/* Milestone Timeline - Horizontal */}
      <div className="bg-white/[0.03] backdrop-blur-2xl rounded-xl p-6 border border-white/10">
        <HorizontalMilestoneTimeline
          milestones={demoGoal.milestones}
          currentMilestoneIndex={demoGoal.current_milestone_index}
          currentStatus={demoGoal.current_status}
          themeColor={themeColor}
        />
      </div>

      {/* Chat-Powered Actions */}
      <div className="flex gap-3">
        {onOpenChat && (
          <button
            onClick={onOpenChat}
            className="flex-1 px-4 py-2.5 bg-white/[0.05] backdrop-blur-xl hover:bg-white/[0.08] border border-white/10 rounded-lg text-sm font-medium text-white transition-all"
          >
            Start Chatting
          </button>
        )}
      </div>
    </div>
  );
};

export default GoalTracker;


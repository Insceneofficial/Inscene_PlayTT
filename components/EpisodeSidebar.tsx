import React from 'react';
import LeaderboardDrawer from './LeaderboardDrawer';
import ChatWidget from './ChatWidget';
import {
  getUserEngagementSummary,
  formatPoints,
  UserEngagementSummary,
} from '../lib/streaksAndPoints';
import { useAuth } from '../lib/auth';
import { useState, useEffect } from 'react';

interface EpisodeSidebarProps {
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  episode: any;
  series: any;
  onChatClick: (char: string, intro: string, hook: string, entryPoint: string) => void;
  onClose: () => void;
}

const EpisodeSidebar: React.FC<EpisodeSidebarProps> = ({
  creatorId,
  creatorName,
  creatorAvatar,
  episode,
  series,
  onChatClick,
  onClose,
}) => {
  const { isAuthenticated } = useAuth();
  const [userSummary, setUserSummary] = useState<UserEngagementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserSummary = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const summary = await getUserEngagementSummary(creatorId);
        setUserSummary(summary);
      } catch (error) {
        console.error('[EpisodeSidebar] Failed to load user summary:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserSummary();
  }, [creatorId, isAuthenticated]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
        <h2 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">Menu</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-all active:scale-95"
          aria-label="Close menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4 text-[#8A8A8A]"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* User Stats Summary */}
        {isAuthenticated && userSummary && !isLoading && (
          <div className="px-6 py-4 bg-gradient-to-b from-[#4A7C59]/5 to-transparent border-b border-black/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Streak */}
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-bold text-[#4A7C59]">
                    {userSummary.streak?.current_streak || 0}
                  </div>
                  <div className="text-[10px] font-medium text-[#8A8A8A] uppercase tracking-wide">
                    Day Streak
                  </div>
                </div>
                
                {/* Divider */}
                <div className="w-px h-8 bg-black/10" />
                
                {/* Points */}
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-bold text-[#1A1A1A]">
                    {formatPoints(userSummary.points?.total_points || 0)}
                  </div>
                  <div className="text-[10px] font-medium text-[#8A8A8A] uppercase tracking-wide">
                    Points
                  </div>
                </div>
                
                {/* Divider */}
                <div className="w-px h-8 bg-black/10" />
                
                {/* Rank */}
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-bold text-[#C77B58]">
                    #{userSummary.rank?.rank || '—'}
                  </div>
                  <div className="text-[10px] font-medium text-[#8A8A8A] uppercase tracking-wide">
                    Rank
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Button */}
        {episode.triggers && episode.triggers.length > 0 && (
          <div className="px-6 py-4 border-b border-black/[0.06]">
            {episode.triggers.map((trigger: any, idx: number) => (
              <ChatWidget
                key={idx}
                characterName={trigger.char}
                avatar={series.avatars[trigger.char]}
                onClick={() => {
                  onChatClick(trigger.char, trigger.intro, trigger.hook, 'video_sidebar');
                  onClose();
                }}
                isOnline={true}
              />
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <div className="border-t border-black/[0.06] -mx-6">
          <LeaderboardDrawer
            creatorId={creatorId}
            creatorName={creatorName}
            creatorAvatar={creatorAvatar}
          />
        </div>
      </div>
    </div>
  );
};

export default EpisodeSidebar;

import React, { useState, useEffect } from 'react';
import {
  getCreatorLeaderboard,
  formatPoints,
  LeaderboardEntry,
} from '../lib/streaksAndPoints';
import { useAuth } from '../lib/auth';

interface LeaderboardDrawerProps {
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
}

const LeaderboardDrawer: React.FC<LeaderboardDrawerProps> = ({
  creatorId,
  creatorName,
  creatorAvatar,
}) => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const leaderboardData = await getCreatorLeaderboard(creatorId, 50);
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error('[LeaderboardDrawer] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [creatorId]);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return { emoji: '🥇', color: 'bg-yellow-400/20 text-yellow-600' };
      case 2: return { emoji: '🥈', color: 'bg-gray-300/30 text-gray-600' };
      case 3: return { emoji: '🥉', color: 'bg-orange-400/20 text-orange-600' };
      default: return { emoji: `#${rank}`, color: 'bg-black/5 text-[#8A8A8A]' };
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-black/[0.06]" data-drawer-header>
        {creatorAvatar && (
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#4A7C59]">
            <img src={creatorAvatar} alt={creatorName} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[#1A1A1A] tracking-tight truncate">{creatorName}</h2>
          <p className="text-xs text-[#8A8A8A]">Leaderboard</p>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="overflow-y-auto px-6 py-4 max-h-[60vh]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-[#4A7C59]/20 border-t-[#4A7C59] rounded-full animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏆</div>
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">Be the First!</h3>
            <p className="text-sm text-[#8A8A8A]">
              Start watching videos and chatting to earn points and claim the top spot.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => {
              const badge = getRankBadge(entry.rank);
              const isCurrentUser = entry.google_user_id === user?.id;
              
              return (
                <div
                  key={entry.google_user_id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrentUser 
                      ? 'bg-[#4A7C59]/10 border border-[#4A7C59]/20' 
                      : 'bg-white border border-black/[0.04]'
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${badge.color}`}>
                    {entry.rank <= 3 ? badge.emoji : entry.rank}
                  </div>
                  
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#F5F3EE]">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt={entry.user_name || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#8A8A8A] font-semibold">
                        {(entry.user_name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Name & Badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-[14px] truncate ${isCurrentUser ? 'text-[#4A7C59]' : 'text-[#1A1A1A]'}`}>
                        {entry.user_name || 'Anonymous'}
                        {isCurrentUser && ' (You)'}
                      </span>
                    </div>
                    {entry.current_streak > 0 && (
                      <span className="text-[11px] text-[#C77B58] font-medium">
                        🔥 {entry.current_streak} day streak
                      </span>
                    )}
                  </div>
                  
                  {/* Points */}
                  <div className="text-right">
                    <div className="font-bold text-[15px] text-[#1A1A1A]">
                      {formatPoints(entry.total_points)}
                    </div>
                    <div className="text-[10px] text-[#8A8A8A]">pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardDrawer;

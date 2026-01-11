import React, { useState, useEffect } from 'react';
import {
  getCreatorLeaderboard,
  getUserEngagementSummary,
  getRecentTransactions,
  formatPoints,
  getStreakStatus,
  getTopPercentageBadge,
  getTransactionTypeName,
  LeaderboardEntry,
  UserEngagementSummary,
  PointTransaction,
  POINTS_CONFIG,
} from '../lib/streaksAndPoints';
import { useAuth } from '../lib/auth';

interface LeaderboardModalProps {
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  onClose: () => void;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  creatorId,
  creatorName,
  creatorAvatar,
  onClose,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'stats' | 'history'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userSummary, setUserSummary] = useState<UserEngagementSummary | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [leaderboardData, summaryData, transactionsData] = await Promise.all([
          getCreatorLeaderboard(creatorId, 50),
          getUserEngagementSummary(creatorId),
          getRecentTransactions(creatorId, 20),
        ]);
        
        setLeaderboard(leaderboardData);
        setUserSummary(summaryData);
        setTransactions(transactionsData);
      } catch (error) {
        console.error('[Leaderboard] Failed to load data:', error);
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
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="bg-[#FAF9F6] w-full max-w-lg h-[85vh] sm:h-[80vh] sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-black/[0.06]">
          {/* Drag Handle for Mobile */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-black/10 sm:hidden" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {creatorAvatar && (
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#4A7C59]">
                  <img src={creatorAvatar} alt={creatorName} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-[#1A1A1A] tracking-tight">{creatorName}</h2>
                <p className="text-xs text-[#8A8A8A]">Community Leaderboard</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#8A8A8A]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* User Stats Summary */}
        {isAuthenticated && userSummary && (
          <div className="px-6 py-4 bg-gradient-to-b from-[#4A7C59]/5 to-transparent">
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
              
              {/* Top Percentage Badge */}
              {userSummary.rank && userSummary.rank.top_percentage <= 50 && (
                <div className="px-3 py-1.5 rounded-full bg-[#4A7C59] text-white text-xs font-semibold">
                  {getTopPercentageBadge(userSummary.rank.top_percentage)}
                </div>
              )}
            </div>
            
            {/* Streak Status */}
            <p className="text-xs text-[#8A8A8A] mt-3 text-center">
              {getStreakStatus(userSummary.streak)}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-black/[0.06] px-6">
          {(['leaderboard', 'stats', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[13px] font-semibold transition-all relative ${
                activeTab === tab ? 'text-[#4A7C59]' : 'text-[#8A8A8A]'
              }`}
            >
              {tab === 'leaderboard' && 'Rankings'}
              {tab === 'stats' && 'How to Earn'}
              {tab === 'history' && 'History'}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A7C59] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-[#4A7C59]/20 border-t-[#4A7C59] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Leaderboard Tab */}
              {activeTab === 'leaderboard' && (
                <div className="px-6 py-4">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-3">🏆</div>
                      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">Be the First!</h3>
                      <p className="text-sm text-[#8A8A8A]">
                        Start watching videos and chatting to earn points and claim the top spot.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {leaderboard.map((entry, idx) => {
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
              )}

              {/* Stats Tab - How to Earn Points */}
              {activeTab === 'stats' && (
                <div className="px-6 py-4 space-y-4">
                  <div className="text-center mb-6">
                    <div className="text-3xl mb-2">⭐️</div>
                    <h3 className="text-lg font-semibold text-[#1A1A1A]">How to Earn Points</h3>
                    <p className="text-sm text-[#8A8A8A]">Engage daily to climb the leaderboard!</p>
                  </div>
                  
                  {/* Streaks Section */}
                  <div className="bg-white rounded-xl border border-black/[0.04] p-4">
                    <h4 className="font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                      🔥 Streaks
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">Daily activity</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.STREAK_DAILY} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">7 day streak</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.STREAK_MILESTONE_7} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">14 day streak</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.STREAK_MILESTONE_14} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">30 day streak</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.STREAK_MILESTONE_30} pts</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Videos Section */}
                  <div className="bg-white rounded-xl border border-black/[0.04] p-4">
                    <h4 className="font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                      🎬 Videos
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">Watch a video</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.VIDEO_WATCHED} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">Complete a video (90%+)</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.VIDEO_COMPLETED} pts</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Chat Section */}
                  <div className="bg-white rounded-xl border border-black/[0.04] p-4">
                    <h4 className="font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                      💬 Chat
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">Start a chat session</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.CHAT_SESSION} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">Send messages (up to {POINTS_CONFIG.CHAT_MESSAGE_DAILY_CAP}/day)</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.CHAT_MESSAGE} pt each</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Goals Section */}
                  <div className="bg-white rounded-xl border border-black/[0.04] p-4">
                    <h4 className="font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                      🎯 Goals
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8A8A8A]">Complete a goal</span>
                        <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.GOAL_COMPLETED} pts</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* First Activity Bonus */}
                  <div className="bg-gradient-to-r from-[#4A7C59]/10 to-[#4A90A4]/10 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-2">🎉</div>
                    <h4 className="font-semibold text-[#1A1A1A] mb-1">First Activity Bonus</h4>
                    <p className="text-sm text-[#8A8A8A]">
                      Get <span className="font-semibold text-[#4A7C59]">+{POINTS_CONFIG.FIRST_ACTIVITY} pts</span> when you first engage with {creatorName}!
                    </p>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="px-6 py-4">
                  {transactions.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-3">📝</div>
                      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">No Activity Yet</h3>
                      <p className="text-sm text-[#8A8A8A]">
                        Start watching videos and chatting to earn your first points!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-black/[0.04]"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#4A7C59]/10 flex items-center justify-center text-lg">
                            {tx.transaction_type === 'streak_daily' && '🔥'}
                            {tx.transaction_type === 'streak_milestone' && '🏆'}
                            {tx.transaction_type === 'goal_completed' && '🎯'}
                            {tx.transaction_type === 'video_watched' && '🎬'}
                            {tx.transaction_type === 'video_completed' && '✅'}
                            {tx.transaction_type === 'chat_session' && '💬'}
                            {tx.transaction_type === 'chat_messages' && '💬'}
                            {tx.transaction_type === 'first_activity' && '🎉'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[14px] text-[#1A1A1A] truncate">
                              {getTransactionTypeName(tx.transaction_type)}
                            </div>
                            <div className="text-[11px] text-[#8A8A8A]">
                              {new Date(tx.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          <div className="font-bold text-[15px] text-[#4A7C59]">
                            +{tx.points}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp { 
          from { transform: translateY(100%); opacity: 0; } 
          to { transform: translateY(0); opacity: 1; } 
        }
        @keyframes fadeIn { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default LeaderboardModal;

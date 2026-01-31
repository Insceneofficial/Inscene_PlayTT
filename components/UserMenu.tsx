import React, { useState, useRef, useEffect } from 'react';
import { useAuth, getUserDisplayName, getUserAvatar } from '../lib/auth';
import { isDevMode, isDevUser, signInWithDevAccount } from '../lib/devAuth';

interface UserMenuProps {
  onSignInClick: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onSignInClick }) => {
  const { user, isAuthenticated, signOut, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDev = isDevMode();
  const isDevAccount = isDevUser();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="w-9 h-9 rounded-xl bg-black/[0.04] animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        {/* Dev Login Button - Only visible in dev mode */}
        {isDev && (
          <button
            onClick={signInWithDevAccount}
            className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[12px] font-semibold hover:bg-amber-500/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
            title="Sign in with Dev Account (Local Testing Only)"
          >
            <span>🔧</span>
            <span>Dev Login</span>
          </button>
        )}
        <button
          onClick={onSignInClick}
          className="px-4 py-2 rounded-xl bg-[#4A7C59] text-white text-[13px] font-semibold hover:bg-[#3D6549] active:scale-[0.98] transition-all"
        >
          Sign In
        </button>
      </div>
    );
  }

  const displayName = getUserDisplayName(user);
  const avatarUrl = getUserAvatar(user);
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      {/* Dev Account Badge */}
      {isDevAccount && (
        <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 text-[10px] font-bold uppercase tracking-wide">
          🔧 DEV
        </span>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 p-0.5 rounded-xl bg-white border hover:border-black/[0.12] active:scale-[0.98] transition-all shadow-sm ${
          isDevAccount ? 'border-amber-500/40' : 'border-black/[0.06]'
        }`}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={displayName} 
            className="w-8 h-8 rounded-lg object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm ${
            isDevAccount ? 'bg-amber-500' : 'bg-[#4A7C59]'
          }`}>
            {isDevAccount ? '🔧' : initials}
          </div>
        )}
      </button>

      {/* Dropdown Menu - Minimal Elegance */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-56 bg-white border border-black/[0.08] rounded-xl shadow-lg overflow-hidden animate-fade-in z-[100]">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-black/[0.06] bg-[#FAF9F6]">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={displayName} 
                  className="w-10 h-10 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#4A7C59] flex items-center justify-center text-white font-semibold">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[#1A1A1A] font-semibold text-[14px] truncate">{displayName}</p>
                <p className="text-[#8A8A8A] text-[12px] truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-[#4A4A4A] hover:bg-black/[0.02] transition-all text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[#8A8A8A]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="text-[13px] font-medium">Profile</span>
            </button>

            <div className="my-1 border-t border-black/[0.06] mx-3" />

            <button
              onClick={async () => {
                setIsOpen(false);
                await signOut();
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-[#C77B58] hover:bg-[#C77B58]/5 transition-all text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              <span className="text-[13px] font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.15s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default UserMenu;

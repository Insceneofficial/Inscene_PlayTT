import React, { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { addToWaitlist } from '../lib/chatStorage';
import { resetGuestCounts, getGuestEpisodeCount, getGuestChatCount } from '../lib/usageLimits';

interface GuestLimitModalProps {
  isOpen: boolean;
  onSignInSuccess: () => void;
}

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

const GuestLimitModal: React.FC<GuestLimitModalProps> = ({ isOpen, onSignInSuccess }) => {
  const { isAuthenticated, signInWithGoogle, user } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const hasAddedToWaitlist = useRef(false);

  // Get counts for display
  const episodeCount = getGuestEpisodeCount();
  const chatCount = getGuestChatCount();

  // Handle successful auth - add to waitlist
  useEffect(() => {
    const handleAuthSuccess = async () => {
      if (isAuthenticated && isOpen && !hasAddedToWaitlist.current) {
        hasAddedToWaitlist.current = true;
        
        // Add user to waitlist
        await addToWaitlist(user?.email, user?.name);
        
        // Reset guest counts after successful sign-in
        resetGuestCounts();
        
        // Notify parent of success
        onSignInSuccess();
      }
    };
    
    handleAuthSuccess();
  }, [isAuthenticated, isOpen, user, onSignInSuccess]);

  // Reset flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasAddedToWaitlist.current = false;
    }
  }, [isOpen]);

  // Render Google button when modal opens
  useEffect(() => {
    if (isOpen && googleButtonRef.current && window.google && GOOGLE_CLIENT_ID) {
      // Clear existing button
      googleButtonRef.current.innerHTML = '';
      
      // Render new Google button
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 280,
        logo_alignment: 'center',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl animate-slide-up">
        {/* Header - No close button, non-dismissable */}
        <div className="relative px-8 pt-8 pb-6">
          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#C9A227]/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#C9A227]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight">
                Free Trial Complete
              </h2>
              <p className="text-[#8A8A8A] text-[14px] mt-2 max-w-[260px]">
                You've enjoyed {episodeCount} episode{episodeCount !== 1 ? 's' : ''} and {chatCount} chat{chatCount !== 1 ? 's' : ''}. 
                Sign in to join the premium waitlist for unlimited access.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 space-y-4 bg-[#FAF9F6]">
          {/* Google Sign-In temporarily disabled - keeping code for future use
          <div className="flex justify-center pt-4">
            {GOOGLE_CLIENT_ID ? (
              <div ref={googleButtonRef} className="google-signin-container" />
            ) : (
              <button
                onClick={signInWithGoogle}
                className="w-full max-w-[280px] py-3.5 rounded-xl bg-white text-[#1A1A1A] font-semibold flex items-center justify-center gap-3 hover:bg-black/[0.02] active:scale-[0.98] transition-all border border-black/[0.08] shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            )}
          </div>
          */}

          {/* Premium benefits hint */}
          <div className="text-center pt-2">
            <p className="text-[#4A7C59] text-[12px] font-medium">
              Premium includes unlimited episodes, chats, and personalized coaching
            </p>
          </div>

          {/* Terms */}
          <p className="text-center text-[#ACACAC] text-[11px] leading-relaxed pt-2">
            By continuing, you agree to our{' '}
            <span className="text-[#4A7C59] hover:underline cursor-pointer">Terms</span>
            {' '}and{' '}
            <span className="text-[#4A7C59] hover:underline cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .google-signin-container { min-height: 44px; display: flex; align-items: center; justify-content: center; }
      `}</style>
    </div>
  );
};

export default GuestLimitModal;

import React from 'react';
import { useAuth } from '../lib/auth';
import { markSignupPromptShown } from '../lib/usageLimits';
import { isDevMode, createDevUser } from '../lib/devAuth';

interface SignupPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
}

const SignupPromptModal: React.FC<SignupPromptModalProps> = ({ isOpen, onClose, onSignIn }) => {
  const { isAuthenticated } = useAuth();
  const isDev = isDevMode();

  if (!isOpen || isAuthenticated) return null;

  const handleContinueAsGuest = () => {
    markSignupPromptShown();
    onClose();
  };

  const handleSignIn = () => {
    markSignupPromptShown();
    onSignIn();
  };

  const handleDevLogin = () => {
    // Clear the disabled flag
    localStorage.removeItem('inscene_dev_auth_disabled');
    // Mark prompt as shown
    markSignupPromptShown();
    // Create and set dev user
    const devUser = createDevUser();
    if (devUser) {
      // Reload to apply the auth state
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl animate-slide-up">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6">
          {/* Close Button */}
          <button 
            onClick={handleContinueAsGuest}
            className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#8A8A8A]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#4A7C59] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight mb-2">
                Get Started
              </h2>
              <p className="text-[#8A8A8A] text-[14px] mt-2 max-w-[280px]">
                Get 5 chat messages + 5 episodes for free.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 space-y-4 bg-[#FAF9F6]">
          {/* Sign up / Log in Button */}
          <button
            onClick={handleSignIn}
            className="w-full py-3.5 rounded-xl bg-[#4A7C59] text-white font-semibold text-[15px] hover:bg-[#3D6549] active:scale-[0.98] transition-all"
          >
            Sign up / Log in
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-black/[0.06]" />
            <span className="text-[#ACACAC] text-[12px] font-medium">or</span>
            <div className="flex-1 h-px bg-black/[0.06]" />
          </div>

          {/* Continue as Guest */}
          <button
            onClick={handleContinueAsGuest}
            className="w-full py-3 rounded-xl bg-transparent border border-black/[0.08] text-[#4A4A4A] font-medium hover:bg-black/[0.02] active:scale-[0.98] transition-all text-[14px]"
          >
            Continue as Guest
          </button>

          {/* Dev Login Button - Only in dev mode */}
          {isDev && (
            <>
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-black/[0.06]" />
                <span className="text-[#ACACAC] text-[12px] font-medium">or</span>
                <div className="flex-1 h-px bg-black/[0.06]" />
              </div>
              <button
                onClick={handleDevLogin}
                className="w-full py-3 rounded-xl bg-[#C9A227]/10 border border-[#C9A227]/20 text-[#C9A227] font-medium hover:bg-[#C9A227]/20 active:scale-[0.98] transition-all text-[14px]"
              >
                🔧 Dev Account (Local Only)
              </button>
            </>
          )}

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
      `}</style>
    </div>
  );
};

export default SignupPromptModal;

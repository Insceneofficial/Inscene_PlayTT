import React, { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';

interface MandatorySignInModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
}

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

const MandatorySignInModal: React.FC<MandatorySignInModalProps> = ({ isOpen, onSuccess }) => {
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Close modal on successful auth
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      onSuccess?.();
    }
  }, [isAuthenticated, isOpen, onSuccess]);

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
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6">
          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#4A7C59] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight">
                Sign In Required
              </h2>
              <p className="text-[#8A8A8A] text-[14px] mt-2 max-w-[260px]">
                You've reached the guest limit. Sign in to continue watching episodes and chatting.
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

export default MandatorySignInModal;

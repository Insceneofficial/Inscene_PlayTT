import React from 'react';
import { useAuth } from '../lib/auth';

interface PremiumBlockedModalProps {
  isOpen: boolean;
}

const PremiumBlockedModal: React.FC<PremiumBlockedModalProps> = ({ isOpen }) => {
  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl animate-slide-up">
        {/* Header - No close button, non-dismissable */}
        <div className="relative px-8 pt-8 pb-6">
          {/* Logo/Title */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#4A7C59] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight">
                You're on the Waitlist!
              </h2>
              <p className="text-[#8A8A8A] text-[14px] mt-2 max-w-[260px]">
                Thanks for signing up{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! You've been added to our premium waitlist.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 space-y-5 bg-[#FAF9F6]">
          {/* What's coming */}
          <div className="pt-2">
            <p className="text-[#1A1A1A] text-[13px] font-medium mb-3 text-center">What you'll get with Premium:</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-[#4A4A4A] text-[13px]">
                <div className="w-5 h-5 rounded-full bg-[#4A7C59]/10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-[#4A7C59]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span>Unlimited episodes & coaching videos</span>
              </div>
              <div className="flex items-center gap-3 text-[#4A4A4A] text-[13px]">
                <div className="w-5 h-5 rounded-full bg-[#4A7C59]/10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-[#4A7C59]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span>Unlimited AI coaching chats</span>
              </div>
              <div className="flex items-center gap-3 text-[#4A4A4A] text-[13px]">
                <div className="w-5 h-5 rounded-full bg-[#4A7C59]/10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-[#4A7C59]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span>Personalized training plans</span>
              </div>
              <div className="flex items-center gap-3 text-[#4A4A4A] text-[13px]">
                <div className="w-5 h-5 rounded-full bg-[#4A7C59]/10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-[#4A7C59]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span>Exclusive content & early access</span>
              </div>
            </div>
          </div>

          {/* Email notification note */}
          <div className="bg-[#4A7C59]/5 rounded-xl px-4 py-3">
            <p className="text-center text-[#4A7C59] text-[12px] font-medium">
              We'll email you at {user?.email || 'your email'} when premium is available.
            </p>
          </div>

          {/* Thank you message */}
          <p className="text-center text-[#ACACAC] text-[11px] leading-relaxed">
            Thank you for your interest in Inscene!
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

export default PremiumBlockedModal;

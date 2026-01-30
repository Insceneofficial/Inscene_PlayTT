import React, { useState } from 'react';
import { addToWaitlist } from '../lib/chatStorage';
import { useAuth } from '../lib/auth';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType?: 'chat' | 'episode';
}

const WaitlistModal: React.FC<WaitlistModalProps> = ({ isOpen, onClose, limitType = 'chat' }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  // Customize messaging based on limit type
  const title = limitType === 'episode' ? 'Episode limit reached' : 'Message limit reached';
  const description = limitType === 'episode' 
    ? "You've completed your free episodes. Get personalized cricket exercise sessions — join the Premium Waitlist."
    : "You've used your free credits. Get personalized cricket exercise sessions — join the Premium Waitlist.";

  const handleJoinWaitlist = async () => {
    setIsSubmitting(true);
    try {
      const success = await addToWaitlist(user?.email, user?.name);
      if (success) {
        setIsSuccess(true);
        setTimeout(() => {
          onClose();
          setIsSuccess(false);
        }, 2000);
      } else {
        alert('Failed to join waitlist. Please try again.');
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      alert('Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-black/30 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl p-8 animate-slide-up">
        <div className="flex flex-col items-center gap-5 mt-2">
          {isSuccess ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[#4A7C59] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-[#1A1A1A] mb-1">You're on the list</h3>
                <p className="text-[#8A8A8A] text-[14px]">We'll notify you when premium is available.</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[#C9A227]/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#C9A227]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-[#1A1A1A] mb-1">{title}</h3>
                <p className="text-[#8A8A8A] text-[14px] mb-6 max-w-[280px]">
                  {description}
                </p>
              </div>
              
              <button
                onClick={handleJoinWaitlist}
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#4A7C59] text-white font-semibold text-[15px] hover:bg-[#3D6549] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Joining...' : 'Apply for Premium Waitlist'}
              </button>
            </>
          )}
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

export default WaitlistModal;

import React, { useState } from 'react';
import { addToWaitlist } from '../lib/chatStorage';
import { useAuth } from '../lib/auth';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WaitlistModal: React.FC<WaitlistModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-[#0a0a0f]/90 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#121218]/95 backdrop-blur-[60px] border border-violet-500/20 rounded-[3.5rem] overflow-hidden shadow-[0_30px_100px_rgba(139,92,246,0.2)] p-8 animate-slide-up">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-[#1a1a24]/80 hover:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center transition-all active:scale-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white/50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center gap-6 mt-4">
          {isSuccess ? (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-10 h-10 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">You're on the list!</h3>
                <p className="text-violet-400/60 text-sm">We'll notify you when premium is available.</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/20 border-2 border-violet-500/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-violet-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">Message Limit Reached</h3>
                <p className="text-violet-400/60 text-sm mb-6">
                  You've used your 10 free messages. Join the waitlist to get early access to premium and unlimited messaging!
                </p>
              </div>
              
              <button
                onClick={handleJoinWaitlist}
                disabled={isSubmitting}
                className="w-full py-5 rounded-[2rem] bg-gradient-to-r from-violet-500 to-blue-500 text-white font-black uppercase tracking-widest text-[10px] shadow-[0_10px_30px_rgba(139,92,246,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Joining...' : 'Join Premium Waitlist'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitlistModal;


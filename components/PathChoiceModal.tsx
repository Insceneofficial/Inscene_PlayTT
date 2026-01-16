import React from 'react';

interface PathChoiceModalProps {
  seriesId: string;
  seriesTitle: string;
  onChoice: (path: 'building' | 'exploring') => void;
}

/**
 * Path Choice Modal - Shows after first video completion
 * Asks user: "Are you currently building something or just exploring?"
 */
const PathChoiceModal: React.FC<PathChoiceModalProps> = ({ seriesId, seriesTitle, onChoice }) => {
  const handleBuilding = () => {
    // Store choice in localStorage
    const storageKey = `inscene_path_choice_${seriesId}`;
    localStorage.setItem(storageKey, 'building');
    onChoice('building');
  };

  const handleExploring = () => {
    // Store choice in localStorage
    const storageKey = `inscene_path_choice_${seriesId}`;
    localStorage.setItem(storageKey, 'exploring');
    onChoice('exploring');
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl p-8 animate-slide-up">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight mb-2">
              What's your focus?
            </h2>
            <p className="text-[#8A8A8A] text-[15px] leading-relaxed">
              Are you currently building something or just exploring?
            </p>
          </div>
          
          <div className="w-full flex flex-col gap-3 mt-4">
            <button
              onClick={handleBuilding}
              className="w-full py-4 px-6 rounded-xl bg-[#4A7C59] text-white font-semibold text-[16px] hover:bg-[#3D6549] active:scale-[0.98] transition-all shadow-lg hover:shadow-xl"
            >
              Building
            </button>
            
            <button
              onClick={handleExploring}
              className="w-full py-4 px-6 rounded-xl bg-transparent border-2 border-[#4A7C59] text-[#4A7C59] font-semibold text-[16px] hover:bg-[#4A7C59]/5 active:scale-[0.98] transition-all"
            >
              Just Exploring
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        .animate-fade-in { 
          animation: fadeIn 0.3s ease-out forwards; 
        }
        @keyframes slideUp { 
          from { transform: translateY(20px); opacity: 0; } 
          to { transform: translateY(0); opacity: 1; } 
        }
        .animate-slide-up { 
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
      `}</style>
    </div>
  );
};

export default PathChoiceModal;

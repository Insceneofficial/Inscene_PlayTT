import React, { useEffect, useRef } from 'react';
import { usePointsEarning, PointEarningEvent } from '../lib/pointsEarningContext';
import { formatPoints } from '../lib/streaksAndPoints';

const PointEarningAnimation: React.FC = () => {
  const { events, removeEvent } = usePointsEarning();
  const animationRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    // Clean up any existing timeouts
    return () => {
      animationRefs.current.forEach(timeout => clearTimeout(timeout));
      animationRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    events.forEach(event => {
      // Remove event after animation completes (2.5 seconds)
      const timeout = setTimeout(() => {
        removeEvent(event.id);
        animationRefs.current.delete(event.id);
      }, 2500);
      
      animationRefs.current.set(event.id, timeout);
    });

    return () => {
      animationRefs.current.forEach(timeout => clearTimeout(timeout));
      animationRefs.current.clear();
    };
  }, [events, removeEvent]);

  // #region agent log
  useEffect(() => {
    if (events.length > 0) {
      fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PointEarningAnimation.tsx:34',message:'Rendering animations',data:{eventsCount:events.length,events:events.map(e=>({id:e.id,points:e.points,reason:e.reason}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    }
  }, [events]);
  // #endregion

  if (events.length === 0) return null;

  return (
    <div 
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
      style={{ 
        transform: 'translateX(-50%)',
        willChange: 'transform, opacity'
      }}
    >
      <div className="flex flex-col items-center gap-2">
        {events.map((event, index) => (
          <PointEarningItem 
            key={event.id} 
            event={event} 
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

interface PointEarningItemProps {
  event: PointEarningEvent;
  index: number;
}

const PointEarningItem: React.FC<PointEarningItemProps> = ({ event, index }) => {
  return (
    <div
      className="px-6 py-3 bg-white/95 backdrop-blur-sm rounded-full border border-black/[0.08] shadow-lg flex items-center gap-2"
      style={{
        animation: 'pointsEarn 2.5s ease-out forwards',
        animationDelay: `${index * 0.1}s`,
        transform: 'translateY(0) scale(0.8)',
        opacity: 0,
      }}
    >
      <span className="text-lg font-bold text-[#4A7C59]">
        +{formatPoints(event.points)}
      </span>
      <span className="text-lg">⭐</span>
      {event.reason && (
        <span className="text-xs text-[#8A8A8A] font-medium ml-1">
          {event.reason}
        </span>
      )}
    </div>
  );
};

// Add CSS animation styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pointsEarn {
    0% {
      transform: translateY(0) scale(0.8);
      opacity: 0;
    }
    10% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    90% {
      transform: translateY(-100px) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateY(-100px) scale(0.9);
      opacity: 0;
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    @keyframes pointsEarn {
      0% {
        transform: translateY(0) scale(0.95);
        opacity: 0;
      }
      20% {
        opacity: 1;
      }
      80% {
        opacity: 1;
      }
      100% {
        transform: translateY(-50px) scale(0.95);
        opacity: 0;
      }
    }
  }
`;

// Inject styles if not already added
if (!document.getElementById('points-earning-animation-styles')) {
  styleSheet.id = 'points-earning-animation-styles';
  document.head.appendChild(styleSheet);
}

export default PointEarningAnimation;

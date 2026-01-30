import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';

export interface PointEarningEvent {
  id: string;
  points: number;
  reason?: string;
}

interface PointsEarningContextType {
  triggerPointsAnimation: (points: number, reason?: string) => void;
  events: PointEarningEvent[];
  removeEvent: (id: string) => void;
}

const PointsEarningContext = createContext<PointsEarningContextType | undefined>(undefined);

// Global callback registry for non-React code
let globalTriggerCallback: ((points: number, reason?: string) => void) | null = null;

export const triggerPointsAnimationGlobal = (points: number, reason?: string) => {
  if (globalTriggerCallback) {
    globalTriggerCallback(points, reason);
  }
};

export const usePointsEarning = () => {
  const context = useContext(PointsEarningContext);
  if (!context) {
    throw new Error('usePointsEarning must be used within PointsEarningProvider');
  }
  return context;
};

interface PointsEarningProviderProps {
  children: ReactNode;
}

export const PointsEarningProvider: React.FC<PointsEarningProviderProps> = ({ children }) => {
  const [events, setEvents] = useState<PointEarningEvent[]>([]);
  const triggerRef = useRef<((points: number, reason?: string) => void) | null>(null);

  const triggerPointsAnimation = useCallback((points: number, reason?: string) => {
    if (points <= 0) return;
    
    const id = `${Date.now()}-${Math.random()}`;
    const newEvent: PointEarningEvent = { id, points, reason };
    const timestamp = Date.now();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pointsEarningContext.tsx:42',message:'triggerPointsAnimation called',data:{points,reason,eventId:id,timestamp},timestamp,sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    setEvents(prev => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pointsEarningContext.tsx:49',message:'Adding event to queue',data:{points,reason,eventId:id,previousCount:prev.length,newCount:prev.length+1,allEventIds:prev.map(e=>e.id).concat([id])},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return [...prev, newEvent];
    });
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  }, []);

  // Register global callback
  useEffect(() => {
    triggerRef.current = triggerPointsAnimation;
    globalTriggerCallback = triggerPointsAnimation;
    
    return () => {
      globalTriggerCallback = null;
    };
  }, [triggerPointsAnimation]);

  return (
    <PointsEarningContext.Provider value={{ triggerPointsAnimation, events, removeEvent }}>
      {children}
    </PointsEarningContext.Provider>
  );
};

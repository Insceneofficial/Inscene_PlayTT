import React, { useEffect, useState } from 'react';
import { pointEarningEmitter, PointEarningEvent, prefersReducedMotion } from '../lib/animations';
import FloatingNumber from './FloatingNumber';
import ConfettiEffect from './ConfettiEffect';

interface PointEarningAnimationProps {
  targetElement?: HTMLElement | null;
}

const PointEarningAnimation: React.FC<PointEarningAnimationProps> = ({
  targetElement,
}) => {
  const [events, setEvents] = useState<Array<PointEarningEvent & { id: string }>>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const unsubscribe = pointEarningEmitter.subscribe((event) => {
      const id = `${Date.now()}-${Math.random()}`;
      setEvents(prev => [...prev, { ...event, id }]);

      // Show confetti for milestones
      if (event.type === 'streak_milestone' || event.type === 'goal_completed') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      // Remove event after animation completes
      setTimeout(() => {
        setEvents(prev => prev.filter(e => e.id !== id));
      }, 1000);
    });

    return unsubscribe;
  }, []);

  const getPosition = (event: PointEarningEvent): { x: number; y: number } => {
    if (event.position) {
      return event.position;
    }

    // Default to center if no position specified
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      return {
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      };
    }

    // Default to top-center for better visibility
    return { x: 50, y: 30 };
  };

  const getAnimationType = (type: PointEarningEvent['type']): 'points' | 'streak' | 'milestone' => {
    if (type === 'streak_daily' || type === 'streak_milestone') {
      return 'streak';
    }
    if (type === 'streak_milestone' || type === 'goal_completed') {
      return 'milestone';
    }
    return 'points';
  };

  if (reducedMotion) {
    return null;
  }

  return (
    <>
      {events.map((event) => (
        <FloatingNumber
          key={event.id}
          value={event.points}
          position={getPosition(event)}
          type={getAnimationType(event.type)}
        />
      ))}
      <ConfettiEffect show={showConfetti} />
    </>
  );
};

export default PointEarningAnimation;

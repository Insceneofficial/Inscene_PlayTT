/**
 * Animation utilities and constants for gamification
 */

// Animation timing constants
export const ANIMATION_TIMING = {
  QUICK: 200,
  STANDARD: 300,
  SLOW: 500,
  CELEBRATION: 1000,
} as const;

// Easing curves
export const EASING = {
  SMOOTH: 'cubic-bezier(0.16, 1, 0.3, 1)',
  BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  EASE_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

// Check for reduced motion preference
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Format animation duration with reduced motion support
export const getAnimationDuration = (duration: number): string => {
  if (prefersReducedMotion()) {
    return '0ms';
  }
  return `${duration}ms`;
};

// Animation styles for reduced motion
export const getReducedMotionStyle = () => {
  if (prefersReducedMotion()) {
    return {
      animation: 'none',
      transition: 'none',
    };
  }
  return {};
};

// Point earning event types
export type PointEarningType = 
  | 'streak_daily'
  | 'streak_milestone'
  | 'goal_completed'
  | 'video_watched'
  | 'video_completed'
  | 'chat_session'
  | 'chat_messages'
  | 'first_activity';

export interface PointEarningEvent {
  type: PointEarningType;
  points: number;
  position?: { x: number; y: number };
  metadata?: Record<string, any>;
}

// Global event emitter for point earnings
class PointEarningEmitter {
  private listeners: Set<(event: PointEarningEvent) => void> = new Set();

  emit(event: PointEarningEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[PointEarningEmitter] Error in listener:', error);
      }
    });
  }

  subscribe(listener: (event: PointEarningEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const pointEarningEmitter = new PointEarningEmitter();

// Helper to trigger point earning animation
export const triggerPointEarning = (
  type: PointEarningType,
  points: number,
  position?: { x: number; y: number },
  metadata?: Record<string, any>
) => {
  pointEarningEmitter.emit({
    type,
    points,
    position,
    metadata,
  });
};

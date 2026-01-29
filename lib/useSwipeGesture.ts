import { useState, useRef, useCallback } from 'react';

interface SwipeGestureState {
  isSwiping: boolean;
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
  swipeProgress: number; // 0 to 1
  distance: number; // Distance in pixels
  velocity: number; // Velocity in pixels per ms
}

interface UseSwipeGestureOptions {
  onSwipeComplete?: (direction: 'left' | 'right' | 'up' | 'down') => void;
  onSwipeStart?: (direction: 'left' | 'right' | 'up' | 'down', position: { x: number; y: number }) => void;
  threshold?: number; // Minimum distance in pixels
  thresholdPercent?: number; // Minimum distance as percentage of element width
  velocityThreshold?: number; // Minimum velocity for quick swipes
  detectAllDirections?: boolean; // If true, detect all directions, not just horizontal
}

interface UseSwipeGestureReturn {
  handlers: {
    onTouchStart: (e: React.TouchEvent | React.MouseEvent) => void;
    onTouchMove: (e: React.TouchEvent | React.MouseEvent) => void;
    onTouchEnd: (e: React.TouchEvent | React.MouseEvent) => void;
  };
  state: SwipeGestureState;
  reset: () => void;
}

export const useSwipeGesture = (
  options: UseSwipeGestureOptions = {}
): UseSwipeGestureReturn => {
  const {
    onSwipeComplete,
    onSwipeStart,
    threshold = 50,
    thresholdPercent = 0.3,
    velocityThreshold = 0.3,
    detectAllDirections = false,
  } = options;

  const [state, setState] = useState<SwipeGestureState>({
    isSwiping: false,
    swipeDirection: null,
    swipeProgress: 0,
    distance: 0,
    velocity: 0,
  });

  const startPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const isSwipingRef = useRef(false);
  const isMouseDownRef = useRef(false);
  const swipeStartCalledRef = useRef(false);

  const getTouchPosition = (
    e: React.TouchEvent | React.MouseEvent
  ): { x: number; y: number } => {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if ('clientX' in e) {
      return { x: e.clientX, y: e.clientY };
    }
    return { x: 0, y: 0 };
  };

  const handleStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      elementRef.current = target;
      const pos = getTouchPosition(e);
      const time = Date.now();

      startPosRef.current = { x: pos.x, y: pos.y, time };
      currentPosRef.current = { x: pos.x, y: pos.y };
      isSwipingRef.current = true;
      swipeStartCalledRef.current = false;
      
      // Track mouse button state
      if ('button' in e || !('touches' in e)) {
        isMouseDownRef.current = true;
      }

      setState({
        isSwiping: true,
        swipeDirection: null,
        swipeProgress: 0,
        distance: 0,
        velocity: 0,
      });

      // Don't prevent default here - let touch-action handle it
      // This allows better mobile performance
    },
    []
  );

  const handleMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // For mouse events, only process if mouse button is down
      if ('button' in e || !('touches' in e)) {
        if (!isMouseDownRef.current) {
          return;
        }
      }
      
      if (!startPosRef.current || !isSwipingRef.current || !elementRef.current) {
        return;
      }

      const pos = getTouchPosition(e);
      currentPosRef.current = { x: pos.x, y: pos.y };

      const deltaX = pos.x - startPosRef.current.x;
      const deltaY = pos.y - startPosRef.current.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const deltaTime = Date.now() - startPosRef.current.time;
      const velocity = deltaTime > 0 ? distance / deltaTime : 0;

      let direction: 'left' | 'right' | 'up' | 'down' | null = null;
      let progress = 0;

      if (detectAllDirections) {
        // Detect all directions - determine primary direction
        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          direction = deltaX > 0 ? 'right' : 'left';
          const elementWidth = elementRef.current.offsetWidth;
          progress = Math.min(absDeltaX / (elementWidth * thresholdPercent), 1);
        } else {
          // Vertical swipe
          direction = deltaY > 0 ? 'down' : 'up';
          const elementHeight = elementRef.current.offsetHeight;
          progress = Math.min(absDeltaY / (elementHeight * thresholdPercent), 1);
        }
      } else {
        // Original behavior: only horizontal swipes
        // Only process horizontal swipes (ignore if vertical movement is significantly greater)
        if (absDeltaY > absDeltaX * 1.5) {
          return;
        }

        const elementWidth = elementRef.current.offsetWidth;
        progress = Math.min(absDeltaX / (elementWidth * thresholdPercent), 1);
        direction = deltaX > 0 ? 'right' : 'left';
      }

      // Trigger onSwipeStart callback on first significant movement
      if (onSwipeStart && direction && distance > 10 && !swipeStartCalledRef.current) {
        swipeStartCalledRef.current = true;
        onSwipeStart(direction, { x: pos.x, y: pos.y });
      }

      setState({
        isSwiping: true,
        swipeDirection: direction,
        swipeProgress: progress,
        distance,
        velocity,
      });

      // Don't prevent default - touch-action CSS handles it
      // This prevents interference with native scrolling
    },
    [thresholdPercent, detectAllDirections, onSwipeStart]
  );

  const handleEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Reset mouse button state
      isMouseDownRef.current = false;
      
      if (!startPosRef.current || !currentPosRef.current || !elementRef.current) {
        isSwipingRef.current = false;
        setState({
          isSwiping: false,
          swipeDirection: null,
          swipeProgress: 0,
        });
        return;
      }

      const endPos = currentPosRef.current;
      const startPos = startPosRef.current;
      const deltaX = endPos.x - startPos.x;
      const deltaY = endPos.y - startPos.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const deltaTime = Date.now() - startPos.time;
      const velocity = deltaTime > 0 ? distance / deltaTime : 0; // pixels per ms

      let direction: 'left' | 'right' | 'up' | 'down' | null = null;
      let thresholdPixels = 0;
      let meetsDistanceThreshold = false;
      let meetsVelocityThreshold = false;

      if (detectAllDirections) {
        // Determine primary direction
        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          direction = deltaX > 0 ? 'right' : 'left';
          const elementWidth = elementRef.current.offsetWidth;
          thresholdPixels = Math.max(threshold, elementWidth * thresholdPercent);
          meetsDistanceThreshold = absDeltaX >= thresholdPixels;
          meetsVelocityThreshold = velocity >= velocityThreshold && absDeltaX >= 30;
        } else {
          // Vertical swipe
          direction = deltaY > 0 ? 'down' : 'up';
          const elementHeight = elementRef.current.offsetHeight;
          thresholdPixels = Math.max(threshold, elementHeight * thresholdPercent);
          meetsDistanceThreshold = absDeltaY >= thresholdPixels;
          meetsVelocityThreshold = velocity >= velocityThreshold && absDeltaY >= 30;
        }
      } else {
        // Original behavior: only horizontal
        const elementWidth = elementRef.current.offsetWidth;
        thresholdPixels = Math.max(threshold, elementWidth * thresholdPercent);
        direction = deltaX > 0 ? 'right' : 'left';
        meetsDistanceThreshold = absDeltaX >= thresholdPixels;
        meetsVelocityThreshold = velocity >= velocityThreshold && absDeltaX >= 30;
      }

      // Check if swipe threshold is met (either distance or velocity)
      if (meetsDistanceThreshold || meetsVelocityThreshold) {
        // Successful swipe
        if (onSwipeComplete && direction) {
          onSwipeComplete(direction);
        }
      }

      // Reset state
      isSwipingRef.current = false;
      swipeStartCalledRef.current = false;
      startPosRef.current = null;
      currentPosRef.current = null;

      // Reset with slight delay to allow animation to complete
      setTimeout(() => {
        setState({
          isSwiping: false,
          swipeDirection: null,
          swipeProgress: 0,
          distance: 0,
          velocity: 0,
        });
      }, 100);
    },
    [onSwipeComplete, threshold, thresholdPercent, velocityThreshold, detectAllDirections]
  );

  const reset = useCallback(() => {
    isSwipingRef.current = false;
    swipeStartCalledRef.current = false;
    startPosRef.current = null;
    currentPosRef.current = null;
    setState({
      isSwiping: false,
      swipeDirection: null,
      swipeProgress: 0,
      distance: 0,
      velocity: 0,
    });
  }, []);

  return {
    handlers: {
      onTouchStart: handleStart,
      onTouchMove: handleMove,
      onTouchEnd: handleEnd,
    },
    state,
    reset,
  };
};

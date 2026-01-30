// lib/devAuth.ts
/**
 * DEVELOPMENT ONLY: Local authentication bypass
 * This file is ONLY active in development mode and completely disabled in production builds
 * DO NOT use this pattern for production authentication
 */

/**
 * Check if we're in development mode
 * Vite sets import.meta.env.DEV to true only in dev mode
 * In production builds, this is always false
 */
export const isDevMode = (): boolean => {
  // Multiple checks to ensure this NEVER works in production
  if (typeof import.meta === 'undefined') return false;
  if (typeof (import.meta as any).env === 'undefined') return false;
  
  const env = (import.meta as any).env;
  
  // Check Vite's DEV flag (true only in npm run dev)
  const isViteDev = env.DEV === true;
  
  // Check MODE (should be 'development' in dev)
  const isDevMode = env.MODE === 'development';
  
  // Check if we're NOT in production
  const isNotProd = env.PROD !== true;
  
  // Check hostname (additional safety - localhost only)
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname === '');
  
  // ALL conditions must be true for dev mode
  return isViteDev && isDevMode && isNotProd && isLocalhost;
};

/**
 * Create a mock user for local development
 * This simulates a logged-in user without requiring Google OAuth
 */
export const createDevUser = () => {
  if (!isDevMode()) {
    console.warn('[DevAuth] Attempted to create dev user in non-dev mode - blocked');
    return null;
  }
  
  // Check if dev auth is disabled (after sign-out)
  const devAuthDisabled = localStorage.getItem('inscene_dev_auth_disabled') === 'true';
  if (devAuthDisabled) {
    console.log('[DevAuth] Dev auth is disabled - not creating dev user');
    return null;
  }
  
  const devUser = {
    id: 'dev-user-local-testing',
    email: 'dev@local.test',
    name: 'Dev Tester',
    picture: '',
    given_name: 'Dev',
    family_name: 'Tester',
  };
  
  // Save to localStorage (same format as real Google auth)
  localStorage.setItem('inscene_google_user', JSON.stringify(devUser));
  localStorage.setItem('inscene_google_token', 'dev-token-local-testing');
  
  console.log('[DevAuth] Created dev user for local testing:', devUser);
  return devUser;
};

/**
 * Check if dev bypass is enabled and should be used
 */
export const shouldUseDevAuth = (): boolean => {
  return isDevMode();
};

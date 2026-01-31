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
 * @param forceCreate - If true, creates user even if dev auth is disabled
 */
export const createDevUser = (forceCreate: boolean = false) => {
  if (!isDevMode()) {
    console.warn('[DevAuth] Attempted to create dev user in non-dev mode - blocked');
    return null;
  }
  
  // Check if dev auth is disabled (after sign-out) - skip check if forceCreate
  if (!forceCreate) {
    const devAuthDisabled = localStorage.getItem('inscene_dev_auth_disabled') === 'true';
    if (devAuthDisabled) {
      console.log('[DevAuth] Dev auth is disabled - not creating dev user');
      return null;
    }
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
  // Clear disabled flag when explicitly logging in
  localStorage.removeItem('inscene_dev_auth_disabled');
  
  console.log('[DevAuth] ✅ Created dev user for local testing:', devUser);
  return devUser;
};

/**
 * Check if dev bypass is enabled and should be used for AUTO-LOGIN
 * Now returns false by default - dev login must be triggered manually
 */
export const shouldUseDevAuth = (): boolean => {
  // Auto-login disabled - user must click "Dev Login" button manually
  // This gives more control during testing
  return false;
};

/**
 * Check if the current user is a dev user
 */
export const isDevUser = (): boolean => {
  try {
    const savedUser = localStorage.getItem('inscene_google_user');
    if (!savedUser) return false;
    const parsed = JSON.parse(savedUser);
    return parsed.id === 'dev-user-local-testing' || parsed.email === 'dev@local.test';
  } catch {
    return false;
  }
};

/**
 * Sign in with dev account (manual trigger)
 */
export const signInWithDevAccount = (): boolean => {
  if (!isDevMode()) {
    console.warn('[DevAuth] Cannot use dev account outside of dev mode');
    return false;
  }
  
  const devUser = createDevUser(true); // Force create
  if (devUser) {
    console.log('[DevAuth] 🔧 Signed in with dev account');
    window.location.reload();
    return true;
  }
  return false;
};

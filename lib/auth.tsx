import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// Types
// ============================================

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
}

interface AuthContextType {
  user: GoogleUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
          revoke: (email: string, callback: () => void) => void;
        };
      };
    };
    handleGoogleCredentialResponse?: (response: any) => void;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google Client ID - Get from Google Cloud Console
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

// ============================================
// Auth Provider
// ============================================

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Parse JWT token from Google
  const parseJwt = (token: string): any => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  // Handle credential response from Google
  const handleCredentialResponse = useCallback(async (response: any) => {
    if (response.credential) {
      const decoded = parseJwt(response.credential);
      
      if (decoded) {
        const googleUser: GoogleUser = {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          given_name: decoded.given_name,
          family_name: decoded.family_name,
        };

        // Save to localStorage
        localStorage.setItem('inscene_google_user', JSON.stringify(googleUser));
        localStorage.setItem('inscene_google_token', response.credential);
        
        setUser(googleUser);

        // Save user to Supabase (if configured)
        await saveUserToDatabase(googleUser);

        // Link viewer to user
        await linkViewerToUser(googleUser.id);
      }
    }
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('inscene_google_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('inscene_google_user');
      }
    }
    setIsLoading(false);

    // Load Google script
    if (!GOOGLE_CLIENT_ID) {
      console.warn('Google Client ID not configured');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsGoogleLoaded(true);
    };
    document.head.appendChild(script);

    // Set global callback
    window.handleGoogleCredentialResponse = handleCredentialResponse;

    return () => {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.remove();
      }
      delete window.handleGoogleCredentialResponse;
    };
  }, [handleCredentialResponse]);

  // Initialize Google Sign-In when script is loaded
  useEffect(() => {
    if (isGoogleLoaded && window.google && GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true, // Auto sign-in if user was previously signed in
        cancel_on_tap_outside: true,
      });
    }
  }, [isGoogleLoaded, handleCredentialResponse]);

  const signInWithGoogle = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.error('Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to your .env.local');
      return;
    }

    if (window.google) {
      // Show the One Tap prompt
      window.google.accounts.id.prompt();
    }
  }, []);

  const signOut = async () => {
    const userEmail = user?.email;
    
    // Clear local storage
    localStorage.removeItem('inscene_google_user');
    localStorage.removeItem('inscene_google_token');
    setUser(null);

    // Revoke Google token
    if (window.google && userEmail) {
      window.google.accounts.id.revoke(userEmail, () => {
        console.log('Google session revoked');
      });
    }
    
    // Refresh the page to reflect logout state
    window.location.reload();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================
// Auth Hook
// ============================================

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============================================
// Helper Functions
// ============================================

export const getUserDisplayName = (user: GoogleUser | null): string => {
  if (!user) return 'Guest';
  return user.name || user.email?.split('@')[0] || 'User';
};

export const getUserAvatar = (user: GoogleUser | null): string | null => {
  if (!user) return null;
  return user.picture || null;
};

// ============================================
// Database Functions
// ============================================

const saveUserToDatabase = async (user: GoogleUser): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  try {
    // Upsert user to users table
    await supabase
      .from('users')
      .upsert({
        google_id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.picture,
        last_sign_in: new Date().toISOString(),
      }, {
        onConflict: 'google_id'
      });
  } catch (error) {
    console.warn('Failed to save user to database:', error);
  }
};

const linkViewerToUser = async (googleUserId: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  const viewerId = localStorage.getItem('inscene_viewer_id');
  if (!viewerId) return;

  try {
    // Update viewers table to link anonymous viewer to Google user
    await supabase
      .from('viewers')
      .update({ google_user_id: googleUserId })
      .eq('viewer_id', viewerId);

    // Update video_sessions
    await supabase
      .from('video_sessions')
      .update({ google_user_id: googleUserId })
      .eq('viewer_id', viewerId);

    // Update chat_sessions
    await supabase
      .from('chat_sessions')
      .update({ google_user_id: googleUserId })
      .eq('viewer_id', viewerId);

  } catch (error) {
    console.warn('Failed to link viewer to user:', error);
  }
};

// ============================================
// Google Sign-In Button Component
// ============================================

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  width?: number;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  theme = 'filled_blue',
  size = 'large',
  text = 'continue_with',
  width = 300,
}) => {
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (buttonRef.current && window.google && !isAuthenticated) {
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme,
        size,
        text,
        width,
        logo_alignment: 'center',
      });
    }
  }, [isAuthenticated, theme, size, text, width]);

  if (isAuthenticated) return null;

  return <div ref={buttonRef} className="google-signin-button" />;
};

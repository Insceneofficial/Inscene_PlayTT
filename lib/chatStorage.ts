import { supabase, isSupabaseConfigured } from './supabase';

// ============================================
// Constants
// ============================================

/**
 * Maximum number of user messages allowed before requiring waitlist
 */
export const MAX_USER_MESSAGES = 10;

// ============================================
// Types
// ============================================

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  time?: string;
  sent_at?: string;
}

export interface CharacterChatHistory {
  characterName: string;
  messages: ChatMessage[];
  lastMessageAt: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get current Google user ID from localStorage
 */
const getGoogleUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const savedUser = localStorage.getItem('inscene_google_user');
    console.log('ChatStorage: Raw saved user from localStorage:', savedUser);
    if (savedUser) {
      const user = JSON.parse(savedUser);
      console.log('ChatStorage: Parsed user:', user, 'ID:', user?.id);
      return user?.id || null;
    }
    return null;
  } catch (e) {
    console.error('ChatStorage: Error parsing user', e);
    return null;
  }
};

/**
 * Check if user is logged in
 */
export const isUserLoggedIn = (): boolean => {
  return !!getGoogleUserId();
};

/**
 * Debug function to list all messages for the current user
 */
export const debugListAllMessages = async (): Promise<void> => {
  if (!isSupabaseConfigured()) {
    console.log('DEBUG: Supabase not configured');
    return;
  }
  
  const googleUserId = getGoogleUserId();
  console.log('DEBUG: Current Google User ID:', googleUserId);
  
  if (!googleUserId) {
    console.log('DEBUG: No user logged in');
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('google_user_id', googleUserId)
      .limit(20);
    
    console.log('DEBUG: All messages for user:', data);
    console.log('DEBUG: Error:', error);
    
    if (data && data.length > 0) {
      console.log('DEBUG: Character names in DB:', [...new Set(data.map(m => m.character_name))]);
    }
  } catch (e) {
    console.error('DEBUG: Query failed', e);
  }
};

// ============================================
// Chat Message Storage
// ============================================

/**
 * Save a single message to the database
 */
export const saveMessage = async (
  characterName: string,
  role: 'user' | 'assistant',
  content: string,
  seriesId?: string,
  episodeId?: number
): Promise<string | null> => {
  if (!isSupabaseConfigured()) {
    console.log('ChatStorage: Supabase not configured, cannot save');
    return null;
  }
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) {
    console.log('ChatStorage: No Google user ID, cannot save');
    return null; // Only save for logged-in users
  }
  
  const messageData = {
    google_user_id: googleUserId,
    character_name: characterName,
    role,
    content,
    series_id: seriesId,
    episode_id: episodeId,
    sent_at: new Date().toISOString()
  };
  
  console.log('ChatStorage: Saving message', messageData);
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();
    
    if (error) {
      console.error('ChatStorage: Save error', error);
      throw error;
    }
    console.log('ChatStorage: Message saved with ID', data?.id);
    return data?.id || null;
  } catch (error) {
    console.warn('ChatStorage: Failed to save message', error);
    return null;
  }
};

/**
 * Save multiple messages at once (for bulk sync)
 */
export const saveMessages = async (
  characterName: string,
  messages: ChatMessage[],
  seriesId?: string,
  episodeId?: number
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;
  
  try {
    const messagesToInsert = messages.map(msg => ({
      google_user_id: googleUserId,
      character_name: characterName,
      role: msg.role,
      content: msg.content,
      series_id: seriesId,
      episode_id: episodeId,
      sent_at: msg.sent_at || new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('ChatStorage: Failed to save messages', error);
    return false;
  }
};

/**
 * Load chat history for a specific character
 * Returns messages and the prompt version used (if available)
 */
export const loadChatHistory = async (
  characterName: string
): Promise<{ messages: ChatMessage[]; promptVersion: string | null }> => {
  if (!isSupabaseConfigured()) {
    console.log('ChatStorage: Supabase not configured');
    return { messages: [], promptVersion: null };
  }
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) {
    console.log('ChatStorage: No Google user ID found');
    return { messages: [], promptVersion: null };
  }
  
  console.log('ChatStorage: Loading history for', characterName, 'user:', googleUserId);
  
  try {
    // First, try to get the prompt version from the most recent chat session
    const { data: sessionData } = await supabase
      .from('chat_sessions')
      .select('prompt_version')
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    const promptVersion = sessionData?.prompt_version || null;
    
    // Load messages
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, sent_at')
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName)
      .order('sent_at', { ascending: true });
    
    console.log('ChatStorage: Query result', { data, error, promptVersion });
    
    if (error) throw error;
    
    const messages = (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      time: new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sent_at: msg.sent_at
    }));
    
    return { messages, promptVersion };
  } catch (error) {
    console.warn('ChatStorage: Failed to load chat history', error);
    return { messages: [], promptVersion: null };
  }
};

/**
 * Load all chat histories for all characters (for chat list)
 */
export const loadAllChatHistories = async (): Promise<CharacterChatHistory[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return [];
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, character_name, role, content, sent_at')
      .eq('google_user_id', googleUserId)
      .order('sent_at', { ascending: true });
    
    if (error) throw error;
    
    // Group by character
    const grouped: Record<string, ChatMessage[]> = {};
    const lastMessageTimes: Record<string, string> = {};
    
    for (const msg of data || []) {
      const char = msg.character_name;
      if (!grouped[char]) {
        grouped[char] = [];
      }
      grouped[char].push({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        time: new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sent_at: msg.sent_at
      });
      lastMessageTimes[char] = msg.sent_at;
    }
    
    // Convert to array and sort by most recent
    const histories: CharacterChatHistory[] = Object.entries(grouped).map(([characterName, messages]) => ({
      characterName,
      messages,
      lastMessageAt: lastMessageTimes[characterName]
    }));
    
    // Sort by most recent chat first
    histories.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    
    return histories;
  } catch (error) {
    console.warn('ChatStorage: Failed to load all chat histories', error);
    return [];
  }
};

/**
 * Delete all chat history for a specific character
 */
export const clearChatHistory = async (characterName: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;
  
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('ChatStorage: Failed to clear chat history', error);
    return false;
  }
};

/**
 * Get the last message for each character (for preview in chat list)
 */
export const getLastMessages = async (): Promise<Record<string, ChatMessage>> => {
  if (!isSupabaseConfigured()) return {};
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return {};
  
  try {
    // Get all messages ordered by sent_at desc, then take the first one per character
    const { data, error } = await supabase
      .from('chat_messages')
      .select('character_name, role, content, sent_at')
      .eq('google_user_id', googleUserId)
      .order('sent_at', { ascending: false });
    
    if (error) throw error;
    
    const lastMessages: Record<string, ChatMessage> = {};
    
    for (const msg of data || []) {
      if (!lastMessages[msg.character_name]) {
        lastMessages[msg.character_name] = {
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          time: new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sent_at: msg.sent_at
        };
      }
    }
    
    return lastMessages;
  } catch (error) {
    console.warn('ChatStorage: Failed to get last messages', error);
    return {};
  }
};

/**
 * Check if user has any chat history with a character
 */
/**
 * Check if user has unlimited messages (bypass limit)
 */
export const hasUnlimitedMessages = (): boolean => {
  try {
    const savedUser = localStorage.getItem('inscene_google_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      return user?.email === 'insceneofficial@gmail.com';
    }
  } catch (error) {
    console.warn('ChatStorage: Failed to check unlimited messages', error);
  }
  return false;
};

/**
 * Count total user messages (not assistant messages) for the current user
 */
export const getUserMessageCount = async (): Promise<number> => {
  if (!isSupabaseConfigured()) return 0;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return 0;
  
  try {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('google_user_id', googleUserId)
      .eq('role', 'user');
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.warn('ChatStorage: Failed to count user messages', error);
    return 0;
  }
};

/**
 * Add user to premium waitlist
 */
export const addToWaitlist = async (email?: string, name?: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;
  
  try {
    const { error } = await supabase
      .from('premium_waitlist')
      .insert({
        google_user_id: googleUserId,
        email: email || null,
        name: name || null,
        status: 'pending'
      });
    
    if (error) throw error;
    console.log('ChatStorage: Successfully added to waitlist');
    return true;
  } catch (error) {
    console.warn('ChatStorage: Failed to add to waitlist', error);
    return false;
  }
};

export const hasChatHistory = async (characterName: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  
  const googleUserId = getGoogleUserId();
  if (!googleUserId) return false;
  
  try {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('google_user_id', googleUserId)
      .eq('character_name', characterName);
    
    if (error) throw error;
    return (count || 0) > 0;
  } catch (error) {
    console.warn('ChatStorage: Failed to check chat history', error);
    return false;
  }
};


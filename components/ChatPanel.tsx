import OpenAI from "openai";
import React, { useState, useEffect, useRef } from 'react';
import { trackChatStart, updateChatMessages, trackChatEnd } from '../lib/analytics';
import { saveMessage, loadChatHistory, isUserLoggedIn, debugListAllMessages, getUserMessageCount, MAX_USER_MESSAGES, hasUnlimitedMessages } from '../lib/chatStorage';
import { getCharacterPrompt } from '../lib/characters';

interface ChatPanelProps {
  character: string;
  episodeLabel: string;
  instantGreeting: string;
  initialHook: string;
  avatar: string;
  onClose: () => void;
  onMessagesUpdate?: (messages: any[]) => void;
  onTypingStatusChange?: (isTyping: boolean) => void;
  existingMessages?: { role: 'user' | 'assistant'; content: string }[];
  isWhatsApp?: boolean;
  // Analytics props
  entryPoint?: 'video_sidebar' | 'video_end_screen' | 'choice_modal' | 'chat_history';
  seriesId?: string;
  seriesTitle?: string;
  episodeId?: number;
  onWaitlistRequired?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  character, 
  episodeLabel, 
  instantGreeting, 
  initialHook, 
  avatar, 
  onClose,
  onMessagesUpdate,
  onTypingStatusChange,
  existingMessages,
  isWhatsApp = false,
  entryPoint = 'choice_modal' as const,
  seriesId,
  seriesTitle,
  episodeId,
  onWaitlistRequired
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; time: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const conversationHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const systemPrompt = useRef<string>('');
  
  // Analytics tracking refs
  const analyticsRecordId = useRef<string | null>(null);
  const trackChatStartPromise = useRef<Promise<string | null> | null>(null);
  const chatStartTime = useRef<number>(Date.now());
  const messagesRef = useRef(messages);
  const hasEndedSession = useRef<boolean>(false);
  
  // Store callback in ref so we can call it on unmount
  const onTypingStatusChangeRef = useRef(onTypingStatusChange);
  
  // Track if initial messages have been saved (to avoid duplicates)
  const initialMessagesSaved = useRef(false);
  
  // Drop-off reminder system refs
  const reminderCount = useRef<number>(0);
  const reminderTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGeneratingReminder = useRef<boolean>(false);
  const MAX_REMINDERS = 2;
  
  // Get random delay between 10 seconds and 2 minutes
  const getRandomDelay = () => {
    const minMs = 30 * 1000;      // 30 seconds
    const maxMs = 2 * 60 * 1000; // 2 minutes
    return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  };
  
  // Keep callback ref in sync
  useEffect(() => {
    onTypingStatusChangeRef.current = onTypingStatusChange;
  }, [onTypingStatusChange]);
  
  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  // Load chat history on mount (for logged-in users)
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      
      const isLoggedIn = isUserLoggedIn();
      console.log('ChatPanel: Loading history, isLoggedIn:', isLoggedIn, 'character:', character);
      
      // Debug: List all messages in DB
      await debugListAllMessages();
      
      if (isLoggedIn) {
        // Load saved chat history from Supabase
        const savedMessages = await loadChatHistory(character);
        console.log('ChatPanel: Loaded messages:', savedMessages.length, savedMessages);
        
        if (savedMessages.length > 0) {
          // User has existing chat history - restore it
          setMessages(savedMessages.map(m => ({
            role: m.role,
            content: m.content,
            time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
          initialMessagesSaved.current = true;
        } else if (existingMessages && existingMessages.length > 0) {
          // No saved history but have existing messages from props
          setMessages(existingMessages.map(m => ({
            ...m,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        } else {
          // No history - start with greeting
          setMessages([{
            role: 'assistant',
            content: instantGreeting,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          // Save the greeting message
          saveMessage(character, 'assistant', instantGreeting, seriesId, episodeId);
          initialMessagesSaved.current = true;
        }
      } else {
        // Not logged in - use existing messages or greeting
        if (existingMessages && existingMessages.length > 0) {
          setMessages(existingMessages.map(m => ({
            ...m,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        } else {
          setMessages([{
            role: 'assistant',
            content: instantGreeting,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        }
      }
      
      setIsLoadingHistory(false);
    };
    
    loadHistory();
  }, [character, existingMessages, instantGreeting, seriesId, episodeId]);
  
  // Helper function to end chat session
  const endChatSession = async () => {
    // Prevent duplicate calls
    if (hasEndedSession.current) {
      return;
    }
    
    // If recordId is not set, wait for the trackChatStart promise to complete
    if (!analyticsRecordId.current && trackChatStartPromise.current) {
      console.log('[Chat Analytics] Waiting for trackChatStart to complete...');
      try {
        const recordId = await trackChatStartPromise.current;
        if (recordId) {
          analyticsRecordId.current = recordId;
          console.log('[Chat Analytics] Got recordId from promise:', recordId);
        }
      } catch (error) {
        console.error('[Chat Analytics] Error waiting for trackChatStart:', error);
      }
    }
    
    if (!analyticsRecordId.current) {
      console.warn('[Chat Analytics] No recordId available, cannot end session');
      return;
    }
    
    // Prevent ending session too quickly (likely from React StrictMode double-invocation)
    const durationMs = Date.now() - chatStartTime.current;
    const durationSeconds = Math.floor(durationMs / 1000);
    if (durationMs < 1000) { // Less than 1 second
      console.log('[Chat Analytics] Session too short (' + durationMs + 'ms), skipping end (likely StrictMode double-invocation)');
      return;
    }
    
    // Mark as ended immediately to prevent duplicate calls
    hasEndedSession.current = true;
    
    const recordId = analyticsRecordId.current; // Save recordId before clearing
    const currentMessages = messagesRef.current;
    const userMsgCount = currentMessages.filter(m => m.role === 'user').length;
    const assistantMsgCount = currentMessages.filter(m => m.role === 'assistant').length;
    
    console.log('[Chat Analytics] Ending session:', {
      recordId,
      durationSeconds,
      messageCount: currentMessages.length,
      userMsgCount,
      assistantMsgCount
    });
    
    trackChatEnd(
      recordId,
      durationSeconds,
      currentMessages.length,
      userMsgCount,
      assistantMsgCount
    );
    analyticsRecordId.current = null; // Prevent duplicate calls
    trackChatStartPromise.current = null;
  };

  // Wrapper for onClose that ends the session
  const handleClose = () => {
    endChatSession();
    onClose();
  };

  // Start chat session tracking on mount
  useEffect(() => {
    chatStartTime.current = Date.now();
    analyticsRecordId.current = null; // Reset previous recordId
    hasEndedSession.current = false; // Reset ended flag for new session
    
    // Start new session tracking
    const startPromise = trackChatStart({
      characterName: character,
      seriesId,
      seriesTitle,
      episodeId,
      episodeLabel,
      isWhatsAppStyle: isWhatsApp,
      entryPoint
    });
    
    trackChatStartPromise.current = startPromise;
    
    startPromise.then(recordId => {
      if (recordId) {
        console.log('[Chat Analytics] Session started, recordId:', recordId);
        analyticsRecordId.current = recordId;
      } else {
        console.warn('[Chat Analytics] Failed to get recordId from trackChatStart');
      }
    }).catch(error => {
      console.error('[Chat Analytics] Error starting session:', error);
    });
    
    // Handle page unload/visibility change
    const handleBeforeUnload = () => {
      endChatSession();
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        endChatSession();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // End tracking on unmount or dependency change
    return () => {
      // Only end session if it was actually started (has a recordId)
      // This prevents ending a session that was just created
      if (analyticsRecordId.current && !hasEndedSession.current) {
        endChatSession();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [character, seriesId, seriesTitle, episodeId, episodeLabel, isWhatsApp, entryPoint]);

  useEffect(() => {
    conversationHistory.current = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
    
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
    
    // Update analytics with message counts
    if (analyticsRecordId.current) {
      const userMsgCount = messages.filter(m => m.role === 'user').length;
      const assistantMsgCount = messages.filter(m => m.role === 'assistant').length;
      updateChatMessages(
        analyticsRecordId.current,
        messages.length,
        userMsgCount,
        assistantMsgCount
      );
    }
  }, [messages]);

  // Notify parent of typing status changes
  useEffect(() => {
    console.log('[ChatPanel] Typing status changed:', isTyping, 'Callback:', !!onTypingStatusChangeRef.current);
    if (onTypingStatusChangeRef.current) {
      onTypingStatusChangeRef.current(isTyping);
    }
  }, [isTyping]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    // Get system prompt from centralized character config
    systemPrompt.current = getCharacterPrompt(character, episodeLabel);
  }, [character, episodeLabel]);

  // Generate personalized drop-off reminder using OpenAI
  const generateDropOffReminder = async () => {
    // Prevent duplicate calls and check limits
    if (isGeneratingReminder.current || reminderCount.current >= MAX_REMINDERS) return;
    
    isGeneratingReminder.current = true;
    const apiKey = process.env.API_KEY;
    
    try {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      
      // Build context from recent conversation
      const currentMessages = messagesRef.current;
      const recentMessages = currentMessages.slice(-6); // Last 6 messages for context
      const contextSummary = recentMessages
        .map(m => `${m.role === 'user' ? 'User' : character}: ${m.content}`)
        .join('\n');
      
      const dropOffPrompt = `
You are ${character}. The user has been inactive for a while during your conversation.
Based on your ongoing chat, send a SHORT, natural follow-up message to re-engage them.
Stay completely in character. Be playful, curious, teasing, or concerned — match the tone of your previous messages.

Recent conversation:
${contextSummary}

Rules:
- Keep it under 20 words
- Don't repeat what you already said
- Make it feel spontaneous and natural, not robotic
- Reference something specific from the conversation if possible
- Use emojis sparingly if it fits your character
- Sound like a real person checking in, not a notification

Generate ONLY the follow-up message, nothing else.
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt.current },
          { role: 'user', content: dropOffPrompt }
        ],
        temperature: 0.95
      });

      const reminderText = response.choices[0]?.message?.content?.trim();
      if (reminderText) {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: reminderText,
          time: now
        }]);
        
        // Save to Supabase if logged in
        if (isUserLoggedIn()) {
          saveMessage(character, 'assistant', reminderText, seriesId, episodeId);
        }
        
        reminderCount.current += 1;
        console.log(`[DropOff] Sent reminder ${reminderCount.current}/${MAX_REMINDERS}: "${reminderText}"`);
        
        // Schedule next reminder if we haven't hit the limit
        if (reminderCount.current < MAX_REMINDERS) {
          scheduleNextReminder();
        }
      }
    } catch (error) {
      console.error('[DropOff] Reminder generation error:', error);
    } finally {
      isGeneratingReminder.current = false;
    }
  };

  // Schedule the next drop-off reminder
  const scheduleNextReminder = () => {
    if (reminderCount.current >= MAX_REMINDERS) return;
    
    // Clear any existing timer
    if (reminderTimeoutId.current) {
      clearTimeout(reminderTimeoutId.current);
      reminderTimeoutId.current = null;
    }
    
    const delay = getRandomDelay();
    console.log(`[DropOff] Next reminder scheduled in ${Math.round(delay / 1000)}s`);
    
    reminderTimeoutId.current = setTimeout(() => {
      generateDropOffReminder();
    }, delay);
  };

  // Initialize drop-off reminder system after history loads
  useEffect(() => {
    if (!isLoadingHistory) {
      // Start the reminder timer once chat is ready
      scheduleNextReminder();
    }
    
    // Cleanup on unmount
    return () => {
      if (reminderTimeoutId.current) {
        clearTimeout(reminderTimeoutId.current);
        reminderTimeoutId.current = null;
      }
    };
  }, [isLoadingHistory]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    
    // Check message count limit before sending (skip for unlimited users)
    if (isUserLoggedIn() && !hasUnlimitedMessages()) {
      const messageCount = await getUserMessageCount();
      if (messageCount >= MAX_USER_MESSAGES) {
        // User has reached limit - show waitlist modal
        if (onWaitlistRequired) {
          onWaitlistRequired();
        }
        return;
      }
    }
    
    const apiKey = process.env.API_KEY;
    const userText = inputValue.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userText, time: now }]);
    setIsTyping(true);
    
    // Reset drop-off reminder system on user engagement
    reminderCount.current = 0;
    scheduleNextReminder();
    
    // Save user message to Supabase
    if (isUserLoggedIn()) {
      saveMessage(character, 'user', userText, seriesId, episodeId);
    }

    try {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt.current },
          ...conversationHistory.current,
          { role: 'user', content: userText }
        ],
        temperature: 0.8,
      });

      const assistantResponse = response.choices[0]?.message?.content || "...";
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: assistantResponse, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
      
      // Save assistant response to Supabase
      if (isUserLoggedIn()) {
        saveMessage(character, 'assistant', assistantResponse, seriesId, episodeId);
      }
    } catch (error) {
      console.error("AI Error:", error);
      const errorMessage = "Network issue. Try again later.";
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } finally {
      setIsTyping(false);
      // Ensure typing status is cleared even if component unmounts
      if (onTypingStatusChangeRef.current) {
        onTypingStatusChangeRef.current(false);
      }
    }
  };

  // Loading state
  if (isLoadingHistory) {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-[#0a0a0f]/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-violet-400/60 text-sm">Loading chat...</p>
        </div>
      </div>
    );
  }

  // PATH A: WhatsApp-style UI (Full Screen) - Now with Charcoal Theme
  if (isWhatsApp) {
    return (
      <div className="fixed inset-0 z-[5000] flex flex-col bg-[#0a0a0f] animate-fade-in h-full w-full overflow-hidden">
        {/* Chat Background Image */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none chat-bg-image" 
          style={{ 
            backgroundImage: `url('/chat_bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />

        {/* Dark Theme Header with Violet Accent */}
        <div className="relative z-10 flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#1a1a24] to-[#121218] border-b border-violet-500/20 shadow-lg">
          <button onClick={handleClose} className="p-1 hover:bg-violet-500/20 rounded-full transition-colors active:scale-90 flex items-center">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-violet-400"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
            <div className="w-9 h-9 rounded-full overflow-hidden border border-violet-500/30 ml-1 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
              <img src={avatar} alt={character} className="w-full h-full object-cover" />
            </div>
          </button>
          <div className="flex flex-col flex-1" onClick={handleClose}>
            <h4 className="text-[16px] font-semibold text-white leading-tight truncate">{character}</h4>
            <p className="text-[12px] text-violet-400">{isTyping ? 'typing...' : 'online'}</p>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-2 flex flex-col hide-scrollbar pb-24">
          <div className="self-center my-3 bg-[#1a1a24] text-violet-400/60 text-[12px] px-3 py-1 rounded-lg shadow-sm font-medium uppercase border border-violet-500/10">
            Today
          </div>

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative px-3 py-2 rounded-2xl shadow-lg text-[14.5px] max-w-[85%] flex flex-col ${
                m.role === 'user' 
                  ? 'bg-gradient-to-br from-violet-600 to-blue-600 rounded-tr-sm text-white' 
                  : 'bg-[#1a1a24] border border-violet-500/10 rounded-tl-sm text-white/90'
              }`}>
                <span className="leading-relaxed break-words">{m.content}</span>
                <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
                  <span className={`text-[10px] leading-none uppercase ${m.role === 'user' ? 'text-white/60' : 'text-violet-400/50'}`}>{m.time}</span>
                  {m.role === 'user' && (
                    <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor" className="text-blue-300"><path d="M11.231.329a.963.963 0 0 0-1.362.012L4.583 5.645 2.328 3.39a.962.962 0 0 0-1.36 1.36l2.935 2.935a.963.963 0 0 0 1.362-.012l5.978-5.978a.963.963 0 0 0-.012-1.366zm3.437 0a.963.963 0 0 0-1.362.012l-5.978 5.978a.963.963 0 0 0 1.362 1.362l5.978-5.978a.963.963 0 0 0-.012-1.366z"></path></svg>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-[#1a1a24] border border-violet-500/10 px-4 py-2 rounded-2xl rounded-tl-sm shadow-lg flex items-center gap-1.5">
                <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                <div className="w-2 h-2 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="relative z-10 bg-[#121218] border-t border-violet-500/10 px-3 py-3 flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[#1a1a24] rounded-full px-4 py-2.5 border border-violet-500/10 focus-within:border-violet-500/30 transition-colors">
            <input 
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="Message"
              className="flex-1 outline-none text-white text-[16px] bg-transparent placeholder:text-white/30"
            />
          </div>

          <button 
            onClick={handleSend} disabled={!inputValue.trim() || isTyping}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
          </button>
        </div>
        <style>{`
          @media (max-width: 768px) {
            .chat-bg-image {
              background-size: 150% !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // PATH B: Floating chat UI - Dark Theme
  return (
    <div className="fixed inset-0 z-[5000] flex items-end justify-center p-4 md:p-8 animate-fade-in pointer-events-none">
      <div 
        className="w-full max-w-lg border border-violet-500/20 rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(139,92,246,0.15)] pointer-events-auto h-[80vh] max-h-[750px] mb-20 md:mb-0 transition-all duration-500 transform translate-y-0 bg-[#0a0a0f]/95 backdrop-blur-3xl"
      >
        <div className="px-8 py-6 flex justify-between items-center border-b border-violet-500/10 bg-gradient-to-r from-[#1a1a24]/80 to-[#121218]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full p-0.5 border-2 border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.3)] flex items-center justify-center text-lg font-black bg-[#1a1a24]">
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                <img src={avatar} alt={character} className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-[#0a0a0f] rounded-full animate-pulse z-10 shadow-[0_0_10px_#10b981]" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-violet-400/60 leading-none mb-1">Inscene Live</p>
              <h4 className="text-xl font-black italic tracking-tighter uppercase leading-none text-white">{character}</h4>
            </div>
          </div>
          <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center hover:bg-violet-500/20 bg-[#1a1a24] rounded-full transition-all active:scale-90 border border-violet-500/20">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 text-violet-400/60"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 hide-scrollbar bg-transparent">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[85%] px-5 py-3.5 rounded-3xl text-[14px] shadow-lg ${
                m.role === 'user' 
                  ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-tr-none font-medium shadow-[0_4px_20px_rgba(139,92,246,0.3)]' 
                  : 'bg-[#1a1a24] border border-violet-500/10 text-white/90 font-medium rounded-tl-none'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
               <div className="bg-[#1a1a24] px-5 py-3.5 rounded-3xl rounded-tl-none border border-violet-500/10 flex gap-1.5 items-center">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
               </div>
            </div>
          )}
        </div>

        <div className="p-8 pt-0 pb-10">
          <div className="relative group">
            <input 
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={`Reply to ${character}...`}
              className="w-full bg-[#1a1a24] border border-violet-500/20 rounded-[2rem] px-8 py-5 text-sm font-medium focus:outline-none focus:border-violet-500/50 focus:bg-[#222230] transition-all text-white placeholder:text-white/30 pr-16"
            />
            <button 
              onClick={handleSend} disabled={!inputValue.trim() || isTyping}
              className="absolute right-2 top-2 bottom-2 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all disabled:opacity-30 bg-gradient-to-br from-violet-500 to-blue-500 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
            </button>
          </div>
        </div>
      </div>
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default ChatPanel;

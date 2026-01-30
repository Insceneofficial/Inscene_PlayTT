import React, { useState, useEffect, useRef } from 'react';
import { trackChatStart, updateChatMessages, trackChatEnd } from '../lib/analytics';
import { saveMessage, loadChatHistory, isUserLoggedIn, debugListAllMessages, getUserMessageCount, MAX_USER_MESSAGES, hasUnlimitedMessages } from '../lib/chatStorage';
import { getCharacterPrompt } from '../lib/characters';
import { getGoalState, markTaskDone, createGoal, GoalWithStreak } from '../lib/goals';
import { recordActivity, recordChatMessages, recordGoalCompletion } from '../lib/streaksAndPoints';
import { getChallengePrompt, markChallengeCompleted, isChallengeCompleted, getFirstChallengeMessage, getChallengeForEpisode } from '../lib/challenges';
import { getEpisodeCoachingInstructions } from '../lib/episodeFlow';
import GoalsModal from './GoalsModal';

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
  onChallengeCompleted?: (seriesId: string, episodeId: number) => void;
  // Guided chat props
  isGuidedChat?: boolean;
  guidedChatDuration?: number; // in seconds
  onGuidedChatComplete?: () => void;
  // Chat UI configuration
  closeEnabled?: boolean; // Whether close button should be enabled
  startImmediately?: boolean; // Whether timer should start immediately
  showTimer?: boolean; // Whether to show timer
  timerSeconds?: number; // Timer duration in seconds
  nextSessionButton?: {
    enabled: boolean;
    style: string;
    label: string;
  };
  // Navigation props
  onNavigateToMessages?: () => void; // Navigate to messages/all chats view
  onNavigateToEpisode1?: () => void; // Navigate to Chirag Episode 1
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
  onWaitlistRequired,
  onChallengeCompleted,
  isGuidedChat = false,
  guidedChatDuration = 45,
  onGuidedChatComplete,
  closeEnabled = true, // Default to enabled
  startImmediately = true, // Default to immediate start
  showTimer = false,
  timerSeconds = 45,
  nextSessionButton,
  onNavigateToMessages,
  onNavigateToEpisode1
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; time: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Guided chat timer
  const [guidedChatTimeRemaining, setGuidedChatTimeRemaining] = useState<number | null>(null);
  const guidedChatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Goal state
  const [currentGoal, setCurrentGoal] = useState<GoalWithStreak | null>(null);
  const [goalContext, setGoalContext] = useState<string>('');
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  
  // Message counting for auto-close (if no goal interest after 10 user messages)
  const userMessageCountRef = useRef<number>(0);
  const hasShownGoalInterestRef = useRef<boolean>(false);
  const [isChatClosing, setIsChatClosing] = useState(false);
  const MAX_MESSAGES_WITHOUT_GOAL = 10;
  
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

  // Helper function to call the chat API route
  const callChatAPI = async (params: {
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    model?: string;
    tools?: any[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    temperature?: number;
  }) => {
    const apiUrl = '/api/chat';
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: params.messages,
          model: params.model || 'gpt-4o-mini',
          tools: params.tools,
          tool_choice: params.tool_choice || 'auto',
          temperature: params.temperature || 0.8,
        }),
      });

      if (!response.ok) {
        // Check if API route doesn't exist (404) - means we're in npm run dev without vercel dev
        if (response.status === 404) {
          const devModeError = new Error('API_ROUTE_NOT_FOUND');
          (devModeError as any).isDevModeIssue = true;
          throw devModeError;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[ChatPanel] API call error:', error);
      
      // Check if it's a network/fetch error (API route not available)
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('network') ||
          error.name === 'TypeError' ||
          error.isDevModeIssue) {
        const devModeError = new Error('API_ROUTE_NOT_FOUND');
        (devModeError as any).isDevModeIssue = true;
        throw devModeError;
      }
      
      throw error;
    }
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
        
        // For guided chat sessions (floating UI), ALWAYS start fresh with episode-specific prompt
        // Do NOT load previous history - each episode session should be independent
        if (savedMessages.length > 0 && !isGuidedChat) {
          // User has existing chat history - restore it (only for NON-guided chats)
          setMessages(savedMessages.map(m => ({
            role: m.role,
            content: m.content,
            time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
          initialMessagesSaved.current = true;
        } else if (existingMessages && existingMessages.length > 0 && !isGuidedChat) {
          // No saved history but have existing messages from props
          setMessages(existingMessages.map(m => ({
            ...m,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        } else {
          // No history or guided chat - use episode-specific greeting
          let firstMessage = instantGreeting;
          
          if (entryPoint === 'video_end_screen' && seriesId && episodeId && episodeId > 1) {
            const challengeMessage = getFirstChallengeMessage(seriesId, episodeId);
            if (challengeMessage) {
              firstMessage = challengeMessage;
            }
          }
          
          // For guided chat, use special greeting only for Cover Drive episode 3
          if (isGuidedChat && episodeId === 3 && episodeLabel === "Cover Drive") {
            firstMessage = "Hi! I see you just finished the Cover Drive lesson. I'd love to help you improve your technique. Can you briefly explain what problem you're facing with your cover drive? Also, please upload an image of your cover drive so I can review it. We have 45 seconds for this quick review session.";
          }
          
          setMessages([{
            role: 'assistant',
            content: firstMessage,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          // Save the greeting message
          saveMessage(character, 'assistant', firstMessage, seriesId, episodeId);
          initialMessagesSaved.current = true;
        }
        } else {
          // Not logged in - use existing messages or greeting
          // FIX: For guided chat sessions, ALWAYS start fresh with episode-specific prompt
          if (existingMessages && existingMessages.length > 0 && !isGuidedChat) {
            setMessages(existingMessages.map(m => ({
              ...m,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
          } else {
            // Not logged in OR guided chat - use episode-specific greeting
            let firstMessage = instantGreeting;
            if (entryPoint === 'video_end_screen' && seriesId && episodeId && episodeId > 1 && !isGuidedChat) {
              const challengeMessage = getFirstChallengeMessage(seriesId, episodeId);
              if (challengeMessage) {
                firstMessage = challengeMessage;
              }
            }
            
            setMessages([{
              role: 'assistant',
              content: firstMessage,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
          }
        }
      
      setIsLoadingHistory(false);
    };
    
    loadHistory();
  }, [character, existingMessages, instantGreeting, seriesId, episodeId, entryPoint, isGuidedChat, episodeLabel]);
  
  // Auto-send AI challenge message when chat opens after video ends
  const hasAutoSentRef = useRef(false);
  useEffect(() => {
    // Only auto-send if:
    // 1. History has loaded
    // 2. Entry point is video_end_screen
    // 3. Episode ID > 1 (episode 1 shows path choice modal instead)
    // 4. No existing messages (fresh chat)
    // 5. Haven't already auto-sent
    // 6. System prompt is ready
    if (
      !isLoadingHistory &&
      entryPoint === 'video_end_screen' &&
      seriesId &&
      episodeId &&
      episodeId > 1 &&
      messages.length === 1 &&
      messages[0]?.role === 'assistant' &&
      systemPrompt.current &&
      !hasAutoSentRef.current
    ) {
      hasAutoSentRef.current = true;
      console.log('[ChatPanel] Auto-generating AI challenge message for episode', episodeId);
      
      // Generate AI message automatically
      const generateAutoMessage = async () => {
        setIsTyping(true);
        
        try {
          // Build conversation - use the challenge context in system prompt
          // The system prompt already has instructions about the challenge
          // We just need to trigger the AI to start the conversation
          const aiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: systemPrompt.current }
          ];
          
          // Add a simple user message that prompts the AI to start talking about the challenge
          // The system prompt will guide the AI on what to say
          aiMessages.push({
            role: 'user',
            content: 'Hi!'
          });
          
          // Get AI response via API route
          const response = await callChatAPI({
            messages: aiMessages,
            model: 'gpt-4o-mini',
            temperature: 0.95
          });
          
          const assistantResponse = response.choices[0]?.message?.content || "...";
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          // Replace the initial static message with AI-generated one
          setMessages([{
            role: 'assistant',
            content: assistantResponse,
            time: now
          }]);
          
          // Update conversation history
          conversationHistory.current = [
            { role: 'user', content: aiMessages[1].content },
            { role: 'assistant', content: assistantResponse }
          ];
          
          // Save to Supabase if logged in
          if (isUserLoggedIn()) {
            // Remove old message and save new one
            saveMessage(character, 'assistant', assistantResponse, seriesId, episodeId);
          }
        } catch (error) {
          console.error('[ChatPanel] Auto-message generation error:', error);
          // Keep the initial message if AI generation fails
        } finally {
          setIsTyping(false);
        }
      };
      
      // Small delay to ensure system prompt is ready
      setTimeout(() => {
        generateAutoMessage();
      }, 800);
    }
  }, [isLoadingHistory, entryPoint, seriesId, episodeId, messages, character, systemPrompt]);
  
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
    
    // Record streak activity for chatting
    if (isUserLoggedIn()) {
      recordActivity(character, 'chat').then(result => {
        console.log('[Chat Streaks] Activity recorded:', result);
      });
    }
    
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

  // Initialize guided chat timer (only for WhatsApp UI, not floating UI)
  useEffect(() => {
    // Only start timer for WhatsApp UI, not for floating UI
    if (isGuidedChat && guidedChatDuration > 0 && isWhatsApp) {
      // Use timerSeconds from props if provided, otherwise use guidedChatDuration
      const durationToUse = timerSeconds > 0 ? timerSeconds : guidedChatDuration;
      setGuidedChatTimeRemaining(durationToUse);
      
      guidedChatTimerRef.current = setInterval(() => {
        setGuidedChatTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            // Timer expired - close chat and trigger completion callback
            if (guidedChatTimerRef.current) {
              clearInterval(guidedChatTimerRef.current);
              guidedChatTimerRef.current = null;
            }
            if (onGuidedChatComplete) {
              onGuidedChatComplete();
            }
            onClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (guidedChatTimerRef.current) {
          clearInterval(guidedChatTimerRef.current);
          guidedChatTimerRef.current = null;
        }
      };
    }
  }, [isGuidedChat, guidedChatDuration, onGuidedChatComplete, onClose, isWhatsApp]);

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

  // Load goal state for the character
  useEffect(() => {
    const loadGoalState = async () => {
      console.log('[ChatPanel Goals] Loading goal state for character:', character, 'isLoggedIn:', isUserLoggedIn());
      if (isUserLoggedIn()) {
        const state = await getGoalState(character);
        console.log('[ChatPanel Goals] Goal state loaded:', {
          hasGoal: state.hasGoal,
          goalTitle: state.goal?.title,
          streak: state.goal?.current_streak
        });
        setCurrentGoal(state.goal);
        
        // Build enhanced context with video/series info
        const videoContext = seriesTitle && episodeLabel 
          ? `\nVIDEO CONTEXT:\n- Series: "${seriesTitle}"\n- Episode: "${episodeLabel}"\n- Video Hook: "${initialHook}"\n\nUse this video content as reference when suggesting goals and tasks. The user just watched this episode.\n`
          : '';
        
        setGoalContext(state.contextForAI + videoContext);
        hasShownGoalInterestRef.current = state.hasGoal;
        console.log('[ChatPanel Goals] Goal context set, hasShownGoalInterest:', state.hasGoal);
      } else {
        console.log('[ChatPanel Goals] User not logged in, skipping goal load');
      }
    };
    loadGoalState();
  }, [character, seriesTitle, episodeLabel, initialHook]);

  useEffect(() => {
    // Get system prompt from centralized character config, including goal context
    let basePrompt = getCharacterPrompt(character, episodeLabel, goalContext);
    
    // Add episode-specific coaching instructions for guided chat sessions
    if (isGuidedChat && episodeLabel) {
      const coachingInstructions = getEpisodeCoachingInstructions(episodeLabel);
      if (coachingInstructions) {
        basePrompt += '\n\n' + coachingInstructions;
      }
    }
    
    // Add challenge prompt if episode has a challenge
    // Only add if previous challenge is complete (or episode 2, which has no previous challenge)
    if (seriesId && episodeId && episodeId > 1) {
      // Check if previous challenge is complete
      const previousEpisodeId = episodeId - 1;
      const isPreviousComplete = episodeId === 2 || isChallengeCompleted(seriesId, previousEpisodeId);
      
      if (isPreviousComplete) {
        // Previous challenge complete - can set new challenge
        const challengePrompt = getChallengePrompt(seriesId, episodeId);
        if (challengePrompt) {
          basePrompt += '\n\n' + challengePrompt;
        }
      } else {
        // Previous challenge not complete - focus on that
        const previousChallenge = getChallengeForEpisode(seriesId, previousEpisodeId);
        if (previousChallenge) {
          basePrompt += `\n\nIMPORTANT: The user has NOT completed their previous challenge for episode ${previousEpisodeId}: "${previousChallenge}". 

Your role:
1. Gently remind them about this incomplete challenge
2. Help them complete it before moving to the next one
3. Only when they explicitly mention they've completed it, acknowledge and then you can help them with the next challenge
4. Be encouraging and supportive, but keep them focused on completing the previous challenge first

Do NOT set a new challenge until the previous one is completed.`;
        }
      }
    }
    
    systemPrompt.current = basePrompt;
  }, [character, episodeLabel, goalContext, seriesId, episodeId, isGuidedChat]);

  // Generate personalized drop-off reminder using OpenAI
  const generateDropOffReminder = async () => {
    // Prevent duplicate calls and check limits
    if (isGeneratingReminder.current || reminderCount.current >= MAX_REMINDERS) return;
    
    isGeneratingReminder.current = true;
    try {
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

      const response = await callChatAPI({
        messages: [
          { role: 'system', content: systemPrompt.current },
          { role: 'user', content: dropOffPrompt }
        ],
        model: 'gpt-4o-mini',
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

  // Quick action: inject a message into the chat
  const injectMessage = (message: string) => {
    setInputValue(message);
  };

  // Handle goal-related quick actions
  const handleQuickAction = (action: 'my_goal' | 'adjust') => {
    switch (action) {
      case 'my_goal':
        if (currentGoal) {
          setShowGoalsModal(true);
        } else {
          injectMessage("I want to set a challenge");
        }
        break;
      case 'adjust':
        injectMessage("I need to adjust my challenge - it's too difficult");
        break;
    }
  };

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
      
      // Increment user message count
      userMessageCountRef.current += 1;
      
      // Award points for chat messages
      recordChatMessages(character, 1).then(points => {
        if (points > 0) {
          console.log('[Chat Points] Awarded', points, 'points for message');
        }
      });
      
      // Check if user is expressing goal interest
      const goalInterestPatterns = /\b(goal|set a goal|want to achieve|improve|learn|practice|commit|challenge|habit|routine|daily|task|progress|track)\b/i;
      if (goalInterestPatterns.test(userText)) {
        hasShownGoalInterestRef.current = true;
      }
      
      // Check if user is marking task as done OR asking about the task
      if (currentGoal && !currentGoal.completed_today) {
        const donePatterns = /\b(done|completed|finished|did it|i did|task done|marked done|i completed|finished it|completed it)\b/i;
        const isCompletionStatement = donePatterns.test(userText);
        
        // Detect doubt/clarification questions about goal or episode task
        const questionWords = /\b(how|what|why|when|where|can you|could you|would you|should i|do i|does it|is it|explain|clarify|help me|i don't|i'm not|confused|unsure|not sure)\b/i;
        const taskKeywords = /\b(task|challenge|goal|episode|this|it|that)\b/i;
        const isDoubtQuestion = questionWords.test(userText) && taskKeywords.test(userText);
        
        // Check if question is about episode challenge (if episodeId exists)
        let isEpisodeTaskQuestion = false;
        if (seriesId && episodeId) {
          const episodeChallenge = getChallengeForEpisode(seriesId, episodeId);
          if (episodeChallenge && questionWords.test(userText)) {
            // Check if message references challenge-related terms
            const challengeKeywords = /\b(challenge|episode|task|this|it|that)\b/i;
            isEpisodeTaskQuestion = challengeKeywords.test(userText);
          }
        }
        
        if (isCompletionStatement || isDoubtQuestion || isEpisodeTaskQuestion) {
          // Mark task as done
          await markTaskDone(currentGoal.id);
          // Award points for completing goal task
          const points = await recordGoalCompletion(character, currentGoal.id);
          if (points > 0) {
            console.log('[Goal Points] Awarded', points, 'points for completing task');
          }
          // Refresh goal state for next message
          const state = await getGoalState(character);
          setCurrentGoal(state.goal);
          setGoalContext(state.contextForAI);
          hasShownGoalInterestRef.current = true;
        }
      }
      
      // Check if user has completed the episode challenge
      if (seriesId && episodeId && episodeId > 1) {
        const challengeCompletionPatterns = /\b(completed|finished|done|did it|i did|finished the challenge|completed the challenge|i'm done|i finished|finished it|completed it|i completed|done with|finished with)\b/i;
        if (challengeCompletionPatterns.test(userText) && !isChallengeCompleted(seriesId, episodeId)) {
          // Check if the context suggests they're talking about the challenge
          // Look for challenge-related keywords
          const challengeKeywords = /\b(prototype|ai|feedback|users|lovable|replit|friends|test|launch|10 users|3 friends)\b/i;
          if (challengeKeywords.test(userText)) {
            console.log('[ChatPanel] Challenge completion detected for episode', episodeId);
            markChallengeCompleted(seriesId, episodeId);
            // Notify parent component to update episode list
            if (onChallengeCompleted) {
              onChallengeCompleted(seriesId, episodeId);
            }
          }
        }
      }
      
      // Check if user has completed the episode challenge
      if (seriesId && episodeId && episodeId > 1) {
        const challengeCompletionPatterns = /\b(completed|finished|done|did it|i did|finished the challenge|completed the challenge|i'm done|i finished|finished it|completed it)\b/i;
        if (challengeCompletionPatterns.test(userText) && !isChallengeCompleted(seriesId, episodeId)) {
          // Check if the context suggests they're talking about the challenge
          // This is a simple check - in production you might want more sophisticated detection
          const challengeKeywords = /\b(prototype|ai|feedback|users|lovable|replit|friends|test|launch)\b/i;
          if (challengeKeywords.test(userText)) {
            console.log('[ChatPanel] Challenge completion detected for episode', episodeId);
            markChallengeCompleted(seriesId, episodeId);
            // Trigger a callback to update episode list if available
            if (onMessagesUpdate) {
              // The parent component should check challenge completion and update episode list
              onMessagesUpdate(messages);
            }
          }
        }
      }
      
      // Check if we should auto-close (no goal, no interest, reached limit)
      if (!currentGoal && !hasShownGoalInterestRef.current && userMessageCountRef.current >= MAX_MESSAGES_WITHOUT_GOAL) {
        // Will trigger closing remark after this response
        setIsChatClosing(true);
      }
    }

    try {
      // Build the messages array
      const aiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt.current },
        ...conversationHistory.current,
        { role: 'user', content: userText }
      ];
      
      // If chat is closing, add instruction to provide closing remark
      if (isChatClosing) {
        aiMessages.push({
          role: 'system',
          content: `IMPORTANT: This is the final message. The user hasn't shown interest in setting challenges. 
End the conversation gracefully with a warm closing remark.
Include: "Feel free to come back and chat with me anytime from the Chat Rooms section! I'll be here whenever you're ready to set a challenge and work on something together. Take care! 💫"
Keep it brief and friendly.`
        });
      }
      
      // Define the function/tool for creating goals
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'create_goal',
            description: 'Create a new goal for the user. Only call this when the user has explicitly asked to set a goal AND you have gathered all required information: goal title and daily task. The user should have confirmed they want to proceed with this goal.',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The main goal title (e.g., "Increase Strength", "Learn Spanish", "Build Morning Routine")'
                },
                daily_task: {
                  type: 'string',
                  description: 'The specific daily micro-task (10-20 minutes) that the user will do to achieve this goal (e.g., "Strength training for 15 minutes", "Practice Spanish for 20 minutes", "Meditate for 10 minutes")'
                },
                commitment_days: {
                  type: 'number',
                  description: 'Number of days per week the user commits to (typically 5-7 days). Default is 5 if not specified.',
                  default: 5
                },
                difficulty_level: {
                  type: 'number',
                  description: 'Difficulty level from 1-5 (1 = easiest, 5 = hardest). Default is 1 if not specified.',
                  default: 1,
                  minimum: 1,
                  maximum: 5
                },
                blocker: {
                  type: 'string',
                  description: 'What usually blocks the user\'s consistency (optional)'
                },
                duration_days: {
                  type: 'number',
                  description: 'How many days the goal should last (typically 30 days). Default is 30 if not specified.',
                  default: 30
                }
              },
              required: ['title', 'daily_task']
            }
          }
        }
      ];

      console.log('[ChatPanel Goals] Making API call with tools:', {
        hasTools: !!tools,
        toolCount: tools.length,
        toolNames: tools.map(t => t.function.name),
        userText,
        messageCount: aiMessages.length
      });

      // Call the API route instead of OpenAI directly
      const response = await callChatAPI({
        messages: aiMessages,
        model: 'gpt-4o-mini',
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.8,
      });

      console.log('[ChatPanel Goals] API response received:', {
        hasChoices: !!response.choices,
        choiceCount: response.choices?.length || 0,
        finishReason: response.choices[0]?.finish_reason,
        hasMessage: !!response.choices[0]?.message
      });

      const message = response.choices[0]?.message;
      const assistantResponse = message?.content || "...";
      
      console.log('[ChatPanel Goals] Message details:', {
        hasContent: !!message?.content,
        contentLength: message?.content?.length || 0,
        hasToolCalls: !!message?.tool_calls,
        toolCallsCount: message?.tool_calls?.length || 0,
        toolCalls: message?.tool_calls
      });
      
      // Check if the model wants to call a function
      const toolCalls = message?.tool_calls;
      
      if (toolCalls && toolCalls.length > 0) {
        console.log('[ChatPanel Goals] Tool calls found:', {
          count: toolCalls.length,
          toolCalls: toolCalls.map(tc => ({
            id: tc.id,
            type: tc.type,
            functionName: tc.type === 'function' ? tc.function?.name : 'N/A',
            functionArgs: tc.type === 'function' ? tc.function?.arguments : 'N/A'
          }))
        });

        // Add the assistant's message with tool calls to the conversation
        const followUpMessages: any[] = [
          ...aiMessages,
          {
            role: 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls
          }
        ];

        const toolResults: any[] = [];

        // Handle function calls
        for (const toolCall of toolCalls) {
          console.log('[ChatPanel Goals] Processing tool call:', {
            id: toolCall.id,
            type: toolCall.type,
            isFunction: toolCall.type === 'function',
            functionName: toolCall.type === 'function' ? toolCall.function?.name : 'N/A',
            isCreateGoal: toolCall.type === 'function' && toolCall.function?.name === 'create_goal'
          });

          if (toolCall.type === 'function' && toolCall.function.name === 'create_goal') {
            try {
              console.log('[ChatPanel Goals] Parsing function arguments:', {
                rawArgs: toolCall.function.arguments,
                argsType: typeof toolCall.function.arguments
              });

              const args = JSON.parse(toolCall.function.arguments);
              console.log('[ChatPanel Goals] Function call received - parsed args:', args);
              
              let functionResult: any = { success: false, error: 'User not logged in' };
              
              if (isUserLoggedIn()) {
                console.log('[ChatPanel Goals] User is logged in, calling createGoal with:', {
                  character,
                  title: args.title,
                  daily_task: args.daily_task,
                  commitment_days: args.commitment_days || 5,
                  difficulty_level: args.difficulty_level || 1,
                  blocker: args.blocker,
                  duration_days: args.duration_days || 30
                });

                const newGoal = await createGoal(character, {
                  title: args.title,
                  daily_task: args.daily_task,
                  commitment_days: args.commitment_days || 5,
                  difficulty_level: args.difficulty_level || 1,
                  blocker: args.blocker,
                  duration_days: args.duration_days || 30
                });
                
                console.log('[ChatPanel Goals] createGoal returned:', {
                  result: newGoal,
                  isNull: newGoal === null,
                  hasId: !!newGoal?.id
                });
                
                if (newGoal) {
                  console.log('[ChatPanel Goals] Goal created successfully:', newGoal);
                  // Refresh goal state
                  const state = await getGoalState(character);
                  console.log('[ChatPanel Goals] Goal state refreshed:', {
                    hasGoal: state.hasGoal,
                    goalId: state.goal?.id
                  });
                  setCurrentGoal(state.goal);
                  setGoalContext(state.contextForAI);
                  hasShownGoalInterestRef.current = true;
                  
                  functionResult = { 
                    success: true, 
                    goal: {
                      id: newGoal.id,
                      title: newGoal.title,
                      daily_task: newGoal.daily_task
                    }
                  };
                } else {
                  console.error('[ChatPanel Goals] Goal creation failed - createGoal returned null');
                  functionResult = { success: false, error: 'Failed to create goal' };
                }
              } else {
                console.warn('[ChatPanel Goals] User is not logged in, cannot create goal');
              }

              // Add function result
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: 'create_goal',
                content: JSON.stringify(functionResult)
              });
            } catch (error) {
              console.error('[ChatPanel Goals] Error parsing function arguments:', error);
              console.error('[ChatPanel Goals] Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              });
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: 'create_goal',
                content: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) })
              });
            }
          } else {
            console.log('[ChatPanel Goals] Tool call is not create_goal, skipping:', {
              type: toolCall.type,
              functionName: toolCall.type === 'function' ? toolCall.function?.name : 'N/A'
            });
          }
        }

        // Send function results back to OpenAI for a follow-up response
        console.log('[ChatPanel Goals] Sending function results back to OpenAI:', {
          toolResultsCount: toolResults.length
        });

        const finalMessages = [...followUpMessages, ...toolResults];
        const followUpResponse = await callChatAPI({
          messages: finalMessages,
          model: 'gpt-4o-mini',
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.8,
        });

        const followUpMessage = followUpResponse.choices[0]?.message;
        const finalResponse = followUpMessage?.content || "Goal created successfully!";
        
        console.log('[ChatPanel Goals] Follow-up response received:', {
          hasContent: !!followUpMessage?.content,
          contentLength: followUpMessage?.content?.length || 0,
          content: finalResponse.substring(0, 200)
        });

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: finalResponse, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }]);

        // Save assistant response to Supabase
        if (isUserLoggedIn()) {
          saveMessage(character, 'assistant', finalResponse, seriesId, episodeId);
        }
      } else {
        // No function calls - normal response
        console.log('[ChatPanel Goals] No tool calls in response:', {
          hasToolCalls: !!toolCalls,
          toolCallsLength: toolCalls?.length || 0,
          finishReason: response.choices[0]?.finish_reason,
          assistantResponse: assistantResponse.substring(0, 200)
        });

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: assistantResponse, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }]);
        
        // Save assistant response to Supabase
        if (isUserLoggedIn()) {
          saveMessage(character, 'assistant', assistantResponse, seriesId, episodeId);
        }
      }
      
      // Auto-close chat after closing remark
      if (isChatClosing) {
        setTimeout(() => {
          onClose();
        }, 4000); // Give user time to read the closing message
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      
      // Check if API route is not available (dev mode issue)
      let errorMessage = "Network issue. Try again later.";
      if (error?.isDevModeIssue || error?.message === 'API_ROUTE_NOT_FOUND') {
        errorMessage = "⚠️ API route not available. Please use 'vercel dev' instead of 'npm run dev' to test the chatbot locally. The /api/chat route only works with Vercel CLI or in production.";
      } else if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('network'))) {
        errorMessage = "Unable to connect to the chat service. Please check your internet connection and try again.";
      }
      
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

  // Loading state - Minimal Elegance
  if (isLoadingHistory) {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#4A7C59]/20 border-t-[#4A7C59] rounded-full animate-spin" />
          <p className="text-[#8A8A8A] text-[13px]">Loading...</p>
        </div>
      </div>
    );
  }

  // PATH A: WhatsApp-style UI (Full Screen) - Minimal Cream Theme
  if (isWhatsApp) {
    return (
      <div className="fixed inset-0 z-[5000] flex flex-col bg-[#FAF9F6] animate-fade-in h-full w-full overflow-hidden">
        {/* Subtle background pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ 
            backgroundImage: `url('/chat_bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />

        {/* Header - Minimal Elegance */}
        <div className="relative z-10 flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
          {/* Back Arrow with DP */}
          <button 
            onClick={() => {
              if (onNavigateToMessages) {
                onNavigateToMessages();
              } else {
                handleClose();
              }
            }}
            className="flex items-center gap-2 p-1 hover:bg-black/[0.04] rounded-xl transition-colors active:scale-95 flex-shrink-0"
            style={{ touchAction: 'manipulation' }}
            title="Back to Messages"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-[#8A8A8A]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 shadow-sm">
              {character?.trim() === 'Chirag' ? (
                // Always show "C" with green background for Chirag (content protection)
                <div className="w-full h-full bg-[#4A7C59] flex items-center justify-center text-white font-semibold text-lg">
                  C
                </div>
              ) : !avatarError ? (
                <img 
                  src={avatar} 
                  alt={character}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full bg-[#4A7C59] flex items-center justify-center text-white font-semibold text-lg">
                  {seriesTitle ? seriesTitle.charAt(0).toUpperCase() : character?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </button>
          
          {/* Character Name and Status */}
          <div className="flex flex-col flex-1 min-w-0">
            <h4 className="text-[15px] font-semibold text-[#1A1A1A] leading-tight truncate tracking-tight">
              {character === 'Chirag' ? "Chirag's AI Avatar" : character}
            </h4>
            <p className="text-[12px] text-[#4A7C59] font-medium">{isTyping ? 'typing...' : 'online'}</p>
          </div>
          
          {/* Forward Arrow */}
          <button
            onClick={() => {
              if (onNavigateToEpisode1) {
                onNavigateToEpisode1();
              }
            }}
            className="w-9 h-9 flex items-center justify-center hover:bg-black/[0.04] rounded-xl transition-all active:scale-95 flex-shrink-0"
            title="Go to Chirag - Episode 1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-[#8A8A8A]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          
          {/* Timer (if guided chat) */}
          {isGuidedChat && guidedChatTimeRemaining !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#4A7C59]/10 border border-[#4A7C59]/20">
              <div className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" />
              <span className="text-[12px] font-semibold text-[#4A7C59] tabular-nums">
                {guidedChatTimeRemaining}s
              </span>
            </div>
          )}
        </div>

        {/* Messages Scroll Area */}
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-2.5 flex flex-col hide-scrollbar pb-24">
          <div className="self-center my-3 bg-black/[0.04] text-[#8A8A8A] text-[11px] px-4 py-1.5 rounded-full font-medium">
            Today
          </div>
          
          {/* AI Disclaimer */}
          <div className="self-center mb-2 bg-[#FAF9F6] border border-black/[0.06] text-[#8A8A8A] text-[11px] px-3 py-1.5 rounded-lg font-medium">
            It is an AI assisted chat bot
          </div>

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative px-4 py-2.5 rounded-2xl text-[15px] max-w-[80%] flex flex-col ${
                m.role === 'user' 
                  ? 'bg-[#4A7C59] rounded-tr-sm text-white' 
                  : 'bg-white border border-black/[0.06] rounded-tl-sm text-[#1A1A1A] shadow-sm'
              }`}>
                <span className="leading-relaxed break-words">{m.content}</span>
                <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
                  <span className={`text-[10px] leading-none ${m.role === 'user' ? 'text-white/60' : 'text-[#ACACAC]'}`}>{m.time}</span>
                  {m.role === 'user' && (
                    <svg viewBox="0 0 16 11" width="14" height="10" fill="currentColor" className="text-white/60"><path d="M11.231.329a.963.963 0 0 0-1.362.012L4.583 5.645 2.328 3.39a.962.962 0 0 0-1.36 1.36l2.935 2.935a.963.963 0 0 0 1.362-.012l5.978-5.978a.963.963 0 0 0-.012-1.366zm3.437 0a.963.963 0 0 0-1.362.012l-5.978 5.978a.963.963 0 0 0 1.362 1.362l5.978-5.978a.963.963 0 0 0-.012-1.366z"></path></svg>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-black/[0.06] px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                <div className="w-2 h-2 bg-[#4A7C59] rounded-full dot-bounce-1" />
                <div className="w-2 h-2 bg-[#6B9B7A] rounded-full dot-bounce-2" />
                <div className="w-2 h-2 bg-[#ACACAC] rounded-full dot-bounce-3" />
              </div>
            </div>
          )}
          
          {/* Closing indicator */}
          {isChatClosing && !isTyping && (
            <div className="flex justify-center my-4 animate-fade-in">
              <div className="bg-[#C9A227]/10 border border-[#C9A227]/30 px-4 py-2 rounded-xl text-[13px] text-[#4A4A4A] text-center">
                Chat ending soon... Come back anytime!
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Buttons - Minimal */}
        {isUserLoggedIn() && currentGoal && (
          <div className="relative z-10 bg-white/80 backdrop-blur-xl border-t border-black/[0.06] px-4 pt-2 pb-0 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => handleQuickAction('adjust')}
              className="flex-shrink-0 px-3.5 py-2 rounded-lg text-[12px] font-medium bg-black/[0.04] text-[#8A8A8A] hover:text-[#C9A227] transition-all"
            >
              Adjust
            </button>
            <div className="flex-shrink-0 px-3 py-1.5 text-[12px] font-semibold text-[#C77B58] flex items-center gap-1 bg-[#C77B58]/10 rounded-lg">
              {currentGoal.current_streak} streak
            </div>
          </div>
        )}

        {/* Input Bar - Minimal */}
        <div className="relative z-10 bg-white/80 backdrop-blur-xl border-t border-black/[0.06] px-4 py-3 flex items-center gap-3">
          <div className="flex-1 flex items-center bg-[#FAF9F6] rounded-xl px-4 py-3 border border-black/[0.06] focus-within:border-[#4A7C59] transition-colors">
            <input 
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="Message..."
              className="flex-1 outline-none text-[#1A1A1A] text-[15px] bg-transparent placeholder:text-[#ACACAC]"
            />
          </div>

          <button 
            onClick={handleSend} disabled={!inputValue.trim() || isTyping}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all bg-[#4A7C59] text-white hover:bg-[#3D6549] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-[#ACACAC]"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
          </button>
        </div>

        {/* Goals Modal */}
        {showGoalsModal && currentGoal && (
          <GoalsModal
            goal={currentGoal}
            onClose={() => setShowGoalsModal(false)}
            onPause={async () => {
              const { pauseGoal } = await import('../lib/goals');
              await pauseGoal(currentGoal.id);
              setCurrentGoal(null);
              setShowGoalsModal(false);
              injectMessage("I want to pause my current challenge");
            }}
            onEdit={() => {
              setShowGoalsModal(false);
              injectMessage("I want to change my challenge");
            }}
          />
        )}
        <style>{`
          @keyframes dotBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          .dot-bounce-1 { animation: dotBounce 1s ease-in-out infinite; }
          .dot-bounce-2 { animation: dotBounce 1s ease-in-out infinite 0.15s; }
          .dot-bounce-3 { animation: dotBounce 1s ease-in-out infinite 0.3s; }
        `}</style>
      </div>
    );
  }

  // PATH B: Floating chat UI - Minimal Cream Theme
  return (
    <div className="fixed inset-0 z-[5000] flex items-end justify-center p-4 md:p-8 animate-fade-in pointer-events-none">
      <div 
        className="w-full max-w-lg border border-black/[0.06] rounded-2xl overflow-hidden flex flex-col shadow-xl pointer-events-auto h-[80vh] max-h-[750px] mb-20 md:mb-0 transition-all duration-500 transform translate-y-0 bg-[#FAF9F6] relative"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Subtle background pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
          style={{ 
            backgroundImage: `url('/chat_bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />

        <div className="relative z-10 px-5 py-4 flex justify-between items-center border-b border-black/[0.06] bg-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center hover:bg-black/[0.04] rounded-xl transition-all active:scale-95 flex-shrink-0"
              style={{ touchAction: 'manipulation' }}
              title="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-[#8A8A8A]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0 shadow-sm">
              {character?.trim() === 'Chirag' ? (
                // Always show "C" with green background for Chirag (content protection)
                <div className="w-full h-full bg-[#4A7C59] flex items-center justify-center text-white font-semibold text-lg">
                  C
                </div>
              ) : !avatarError ? (
                <img 
                  src={avatar} 
                  alt={character}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full bg-[#4A7C59] flex items-center justify-center text-white font-semibold text-lg">
                  {seriesTitle ? seriesTitle.charAt(0).toUpperCase() : character?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-[15px] font-semibold leading-tight text-[#1A1A1A] tracking-tight">
                {character === 'Chirag' ? "Chirag's AI Avatar" : character}
              </h4>
              <p className="text-[11px] text-[#8A8A8A]">AI Coach</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {nextSessionButton?.enabled && onGuidedChatComplete ? (
              <button
                onClick={onGuidedChatComplete}
                className="w-9 h-9 flex items-center justify-center hover:bg-black/[0.04] rounded-xl transition-all active:scale-95"
                title={nextSessionButton.label || "Next Session"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-[#8A8A8A]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center hover:bg-black/[0.04] rounded-xl transition-all active:scale-95"
                title="Forward"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-[#8A8A8A]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto p-5 space-y-3 hide-scrollbar">
          {/* AI Disclaimer */}
          <div className="self-center mb-2 bg-[#FAF9F6] border border-black/[0.06] text-[#8A8A8A] text-[11px] px-3 py-1.5 rounded-lg font-medium">
            It is an AI assisted chat bot
          </div>
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[15px] ${
                m.role === 'user' 
                  ? 'bg-[#4A7C59] text-white rounded-tr-sm' 
                  : 'bg-white border border-black/[0.06] text-[#1A1A1A] rounded-tl-sm shadow-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
               <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-black/[0.06] flex gap-1.5 items-center shadow-sm">
                  <div className="w-2 h-2 bg-[#4A7C59] rounded-full dot-bounce-1" />
                  <div className="w-2 h-2 bg-[#6B9B7A] rounded-full dot-bounce-2" />
                  <div className="w-2 h-2 bg-[#ACACAC] rounded-full dot-bounce-3" />
               </div>
            </div>
          )}
          
          {/* Closing indicator */}
          {isChatClosing && !isTyping && (
            <div className="flex justify-center my-4 animate-fade-in">
              <div className="bg-[#C9A227]/10 border border-[#C9A227]/30 px-4 py-2 rounded-xl text-[13px] text-[#4A4A4A] text-center">
                Chat ending soon... Come back anytime!
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Buttons - Minimal */}
        {isUserLoggedIn() && currentGoal && (
          <div className="relative z-10 px-5 pb-2 pt-2 flex items-center gap-2 overflow-x-auto hide-scrollbar bg-white/90 backdrop-blur-sm border-t border-black/[0.06]">
            <button
              onClick={() => handleQuickAction('adjust')}
              className="flex-shrink-0 px-3.5 py-2 rounded-lg text-[12px] font-medium bg-black/[0.04] text-[#8A8A8A] hover:text-[#C9A227] transition-all"
            >
              Adjust
            </button>
            <div className="flex-shrink-0 px-3 py-1.5 text-[12px] font-semibold text-[#C77B58] flex items-center gap-1 bg-[#C77B58]/10 rounded-lg">
              {currentGoal.current_streak} streak
            </div>
          </div>
        )}

        <div className="relative z-10 p-5 pt-2 pb-6 bg-white/90 backdrop-blur-sm">
          <div className="relative group flex items-center gap-3">
            <input 
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={`Reply to ${character}...`}
              className="flex-1 bg-[#FAF9F6] border border-black/[0.06] rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:border-[#4A7C59] transition-all text-[#1A1A1A] placeholder:text-[#ACACAC]"
            />
            <button 
              onClick={handleSend} disabled={!inputValue.trim() || isTyping}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all disabled:opacity-40 bg-[#4A7C59] hover:bg-[#3D6549] disabled:bg-[#ACACAC]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
            </button>
          </div>
        </div>

        {/* Goals Modal */}
        {showGoalsModal && currentGoal && (
          <GoalsModal
            goal={currentGoal}
            onClose={() => setShowGoalsModal(false)}
            onPause={async () => {
              const { pauseGoal } = await import('../lib/goals');
              await pauseGoal(currentGoal.id);
              setCurrentGoal(null);
              setShowGoalsModal(false);
              injectMessage("I want to pause my current challenge");
            }}
            onEdit={() => {
              setShowGoalsModal(false);
              injectMessage("I want to change my challenge");
            }}
          />
        )}
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .dot-bounce-1 { animation: dotBounce 1s ease-in-out infinite; }
        .dot-bounce-2 { animation: dotBounce 1s ease-in-out infinite 0.15s; }
        .dot-bounce-3 { animation: dotBounce 1s ease-in-out infinite 0.3s; }
      `}</style>
    </div>
  );
};

export default ChatPanel;

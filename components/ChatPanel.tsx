
import { GoogleGenAI } from "@google/genai";
import React, { useState, useEffect, useRef } from 'react';

interface ChatPanelProps {
  character: string;
  episodeLabel: string;
  instantGreeting: string;
  initialHook: string;
  avatar: string;
  onClose: () => void;
  onMessagesUpdate?: (messages: any[]) => void;
  existingMessages?: { role: 'user' | 'assistant'; content: string }[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  character, 
  episodeLabel, 
  instantGreeting, 
  initialHook, 
  avatar, 
  onClose,
  onMessagesUpdate,
  existingMessages
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(
    existingMessages || [{ role: 'assistant', content: instantGreeting }]
  );
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [imgError, setImgError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const conversationHistory = useRef<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
  const systemPrompt = useRef<string>('');

  const getAccentColor = () => {
    if (character === 'Priyank') return '#3b82f6';
    if (character === 'Arzoo') return '#ec4899';
    if (character === 'Debu') return '#a855f7';
    if (character === 'Anish') return '#22d3ee';
    if (character === 'Chirag') return '#10b981';
    return '#64748b';
  };

  const accentColor = getAccentColor();
  
  const getUserRoleName = () => {
    if (character === 'Priyank') return 'Arzoo';
    if (character === 'Arzoo') return 'Priyank';
    if (character === 'Anish') return 'Co-founder';
    if (character === 'Debu') return 'Assistant';
    if (character === 'Chirag') return 'Cricket Pro';
    return 'User';
  };
  
  const userRoleName = getUserRoleName();
  const placeholderText = character === 'Debu' ? "Ask Debu anything..." : `Reply to ${character}...`;

  useEffect(() => {
    conversationHistory.current = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (character === 'Debu') {
      systemPrompt.current = `You are Debu, a senior Indian filmmaker and mentor. Wise, clear, authoritative. Guide with surgical precision. END WITH ONE FOLLOW UP QUESTION. MAX 60 WORDS. NO DEVANAGARI.`;
    } else if (character === 'Anish') {
      let taskGuide = '';
      if (episodeLabel.includes('Phase 1')) {
        taskGuide = "Guide them on readiness: validating the problem, and bootstrapping vs fundraising.";
      } else if (episodeLabel.includes('Phase 2')) {
        taskGuide = "Guide them on roles: identifying core roles and finding a co-founder with fit.";
      } else if (episodeLabel.includes('Phase 3')) {
        taskGuide = "Guide them on differentiation: identifying a niche and 'moat' against giants.";
      } else if (episodeLabel.includes('Phase 4')) {
        taskGuide = "Guide them on evaluation: defining next steps for the next 7-14 days.";
      } else if (episodeLabel.includes('Phase 5')) {
        taskGuide = "Guide them on pivots: deciding to pivot or stay patient, building a lean team.";
      }

      systemPrompt.current = `You are Anish, a 20-year-old startup founder building 'Insayy'. Energetic, slightly stressed hustler. Natural Hinglish (Latin). 
      MISSION: ${taskGuide}
      Speak like a founder friend. MAX 35 WORDS. NO DEVANAGARI. SCENE: ${initialHook}.`;
    } else if (character === 'Chirag') {
      systemPrompt.current = `You are Chirag Saini (Fit Monk), an elite Cricket Athlete Coach. Disciplined, technical, and motivational. Give cricket fitness and training tips. Natural Hinglish. MAX 40 WORDS. NO DEVANAGARI. SCENE: ${initialHook}.`;
    } else {
      systemPrompt.current = `You are ${character}, a lead character in the drama "${episodeLabel}". Speak in natural Hinglish (Latin script). Quick WhatsApp style. MAX 25 WORDS. NO DEVANAGARI. SCENE: ${initialHook}.`;
    }
  }, [character, episodeLabel, initialHook, userRoleName]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    
    // EXCLUSIVELY obtain key from process.env.API_KEY. Fallback to GEMINI_API_KEY for dev safety.
    const apiKey = process.env.API_KEY || (process.env as any).GEMINI_API_KEY;
    
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Critical: Set 'API_KEY' in Vercel settings to fix this." }]);
      return;
    }

    const userText = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setIsTyping(true);

    const tryGenerate = async (model: string) => {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: [
          ...conversationHistory.current,
          { role: 'user', parts: [{ text: userText }] }
        ],
        config: {
          systemInstruction: systemPrompt.current,
          temperature: 0.8,
          maxOutputTokens: 500,
        },
      });
      return response.text;
    };

    try {
      // Logic: Coaches/Mentors try Pro first, Fallback to Flash. Drama always uses Flash.
      const primaryModel = (character === 'Debu' || character === 'Anish' || character === 'Chirag') 
        ? 'gemini-3-pro-preview' 
        : 'gemini-3-flash-preview';
      
      try {
        const text = await tryGenerate(primaryModel);
        setMessages(prev => [...prev, { role: 'assistant', content: text || "..." }]);
      } catch (err) {
        console.warn("Primary model failed or restricted. Falling back to Flash...", err);
        // If pro fails, flash is much more reliable globally
        const fallbackText = await tryGenerate('gemini-3-flash-preview');
        setMessages(prev => [...prev, { role: 'assistant', content: fallbackText || "..." }]);
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Network jitter. Send your message again, bro." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center p-4 md:p-8 animate-fade-in pointer-events-none">
      <div 
        className="w-full max-w-lg border border-white/40 rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.4)] pointer-events-auto h-[80vh] max-h-[750px] mb-20 md:mb-0 transition-all duration-500 transform translate-y-0 bg-white/95 backdrop-blur-3xl"
        style={{ boxShadow: `0 30px 100px -20px rgba(0,0,0,0.3), 0 0 40px -10px ${accentColor}30` }}
      >
        <div className="px-8 py-6 flex justify-between items-center border-b border-slate-100 bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full p-0.5 border-2 shadow-xl flex items-center justify-center text-lg font-black bg-white" style={{ borderColor: accentColor }}>
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-50">
                {!imgError ? <img src={avatar} alt={character} className="w-full h-full object-cover" onError={() => setImgError(true)} /> : <span>{character[0]}</span>}
              </div>
              <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse z-10" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-400 leading-none mb-1">Inscene Live</p>
              <h4 className="text-xl font-black italic tracking-tighter uppercase leading-none text-slate-900">{character}</h4>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 bg-slate-50 rounded-full transition-all active:scale-90 border border-slate-100">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 hide-scrollbar bg-transparent">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[85%] px-5 py-3.5 rounded-3xl text-[14px] shadow-sm ${m.role === 'user' ? 'bg-slate-900 border border-slate-800 text-white rounded-tr-none font-medium' : 'bg-slate-100 border border-slate-200 text-slate-800 font-semibold rounded-tl-none'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
               <div className="bg-slate-100 px-5 py-3.5 rounded-3xl rounded-tl-none border border-slate-200 flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
               </div>
            </div>
          )}
        </div>

        <div className="p-8 pt-0 pb-10">
          <div className="relative group">
            <input 
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={placeholderText}
              className="w-full bg-slate-100 border border-slate-200 rounded-[2rem] px-8 py-5 text-sm font-medium focus:outline-none focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 pr-16 shadow-inner"
            />
            <button 
              onClick={handleSend} disabled={!inputValue.trim() || isTyping}
              className="absolute right-2 top-2 bottom-2 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all disabled:opacity-30"
              style={{ backgroundColor: accentColor }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
            </button>
          </div>
        </div>
      </div>
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default ChatPanel;

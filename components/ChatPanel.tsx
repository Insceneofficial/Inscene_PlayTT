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
  isWhatsApp?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  character, 
  episodeLabel, 
  instantGreeting, 
  initialHook, 
  avatar, 
  onClose,
  onMessagesUpdate,
  existingMessages,
  isWhatsApp = false
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; time: string }[]>(
    existingMessages?.map(m => ({ ...m, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })) || 
    [{ role: 'assistant', content: instantGreeting, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]
  );
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const conversationHistory = useRef<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
  const systemPrompt = useRef<string>('');

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
    // Dynamic System Instruction based on character
    if (character === 'Debu') {
      systemPrompt.current = `You are Debu, a senior Indian filmmaker. Wise, brief. WhatsApp style. MAX 30 WORDS. NO DEVANAGARI.`;
    } else if (character === 'Anish') {
      systemPrompt.current = `You are Anish, a startup founder. Hustler vibe, Hinglish. WhatsApp style. MAX 25 WORDS. NO DEVANAGARI.`;
    } else {
      systemPrompt.current = `You are ${character} from the series ${episodeLabel}. Natural Hinglish, brief WhatsApp style responses. MAX 20 WORDS. NO DEVANAGARI.`;
    }
  }, [character, episodeLabel]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    
    const apiKey = process.env.API_KEY;
    const userText = inputValue.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userText, time: now }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...conversationHistory.current,
          { role: 'user', parts: [{ text: userText }] }
        ],
        config: {
          systemInstruction: systemPrompt.current,
          temperature: 0.8,
        },
      });

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.text || "...", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Network issue. Try again later.", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // PATH A: WhatsApp UI (Full Screen)
  if (isWhatsApp) {
    return (
      <div className="fixed inset-0 z-[5000] flex flex-col bg-[#efeae2] animate-fade-in h-full w-full overflow-hidden">
        {/* Wallpaper Layer */}
        <div 
          className="absolute inset-0 opacity-[0.08] pointer-events-none" 
          style={{ 
            backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
            backgroundSize: '400px'
          }}
        />

        {/* WhatsApp Header */}
        <div className="relative z-10 flex items-center gap-2 px-3 py-2.5 bg-[#f0f2f5] border-b border-gray-300 shadow-sm">
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors active:scale-90 flex items-center">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-[#54656f]"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
            <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 ml-1">
              <img src={avatar} alt={character} className="w-full h-full object-cover" />
            </div>
          </button>
          <div className="flex flex-col flex-1" onClick={onClose}>
            <h4 className="text-[16px] font-semibold text-[#111b21] leading-tight truncate">{character}</h4>
            <p className="text-[12px] text-[#667781]">online</p>
          </div>
          <div className="flex items-center gap-4 mr-1 text-[#54656f]">
             <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path></svg>
             <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.43-3.9-6.63-6.83l1.88-1.55c.45-.34.48-.89.27-1.36-1.12-2.28-1.3-4.7-1.3-4.7 0-.55-.45-1-1-1H3.03C2.45 0 2 1.25 2 1.25c0 10.2 8.5 18.7 18.7 18.7h.06c.55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"></path></svg>
             <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 7zm0 10a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 17zm0-5a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 12z"></path></svg>
          </div>
        </div>

        {/* WhatsApp Messages Scroll */}
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-2 flex flex-col hide-scrollbar pb-24">
          <div className="self-center my-3 bg-white text-[#54656f] text-[12px] px-3 py-1 rounded-lg shadow-sm font-medium uppercase">
            Today
          </div>

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative px-2.5 py-1.5 rounded-lg shadow-sm text-[14.5px] max-w-[85%] flex flex-col ${
                m.role === 'user' ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'
              }`}>
                <span className="text-[#111b21] leading-relaxed break-words">{m.content}</span>
                <div className="flex items-center justify-end gap-1 -mt-0.5 ml-8">
                  <span className="text-[10px] text-[#667781] leading-none uppercase">{m.time}</span>
                  {m.role === 'user' && (
                    <svg viewBox="0 0 16 11" width="16" height="11" fill="#53bdeb"><path d="M11.231.329a.963.963 0 0 0-1.362.012L4.583 5.645 2.328 3.39a.962.962 0 0 0-1.36 1.36l2.935 2.935a.963.963 0 0 0 1.362-.012l5.978-5.978a.963.963 0 0 0-.012-1.366zm3.437 0a.963.963 0 0 0-1.362.012l-5.978 5.978a.963.963 0 0 0 1.362 1.362l5.978-5.978a.963.963 0 0 0-.012-1.366z" fill="#53bdeb"></path></svg>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-2 rounded-lg rounded-tl-none shadow-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-bounce delay-75" />
                <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-bounce delay-150" />
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp Input Bar */}
        <div className="relative z-10 bg-[#f0f2f5] px-2 py-2 flex items-center gap-2">
          <button className="p-1 text-[#54656f]">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>
          </button>
          
          <div className="flex-1 flex items-center bg-white rounded-full px-4 py-2 gap-3 shadow-sm">
            <input 
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="Message"
              className="flex-1 outline-none text-[#111b21] text-[16px] bg-transparent"
            />
            <button className="text-[#54656f]">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6V17.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-1.5z"></path></svg>
            </button>
          </div>

          <button 
            onClick={handleSend} disabled={isTyping}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              inputValue.trim() ? 'bg-[#00a884] text-white' : 'text-[#54656f]'
            }`}
          >
            {inputValue.trim() ? (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>
            )}
          </button>
        </div>
      </div>
    );
  }

  // PATH B: Original floating chat UI (Preserved)
  return (
    <div className="fixed inset-0 z-[5000] flex items-end justify-center p-4 md:p-8 animate-fade-in pointer-events-none">
      <div 
        className="w-full max-w-lg border border-white/40 rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.4)] pointer-events-auto h-[80vh] max-h-[750px] mb-20 md:mb-0 transition-all duration-500 transform translate-y-0 bg-white/95 backdrop-blur-3xl"
      >
        <div className="px-8 py-6 flex justify-between items-center border-b border-slate-100 bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full p-0.5 border-2 shadow-xl flex items-center justify-center text-lg font-black bg-white" style={{ borderColor: '#3b82f6' }}>
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-50">
                <img src={avatar} alt={character} className="w-full h-full object-cover" />
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
              type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={`Reply to ${character}...`}
              className="w-full bg-slate-100 border border-slate-200 rounded-[2rem] px-8 py-5 text-sm font-medium focus:outline-none focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 pr-16 shadow-inner"
            />
            <button 
              onClick={handleSend} disabled={!inputValue.trim() || isTyping}
              className="absolute right-2 top-2 bottom-2 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all disabled:opacity-30 bg-blue-500"
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

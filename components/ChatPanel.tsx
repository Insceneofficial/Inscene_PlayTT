
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

  return (
    <div className="fixed inset-0 z-[5000] flex flex-col bg-[#efeae2] animate-fade-in font-sans h-full w-full">
      {/* WhatsApp Doodle Wallpaper Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none" 
        style={{ 
          backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
          backgroundSize: '400px'
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-3 py-2 bg-[#f0f2f5] border-b border-gray-300 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors active:scale-90">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-[#54656f]"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
            <img src={avatar} alt={character} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-[16px] font-semibold text-[#111b21] leading-tight">{character}</h4>
            <p className="text-[12px] text-[#667781]">online</p>
          </div>
        </div>
        <div className="flex items-center gap-5 mr-2 text-[#54656f]">
          <button className="hover:bg-gray-200 p-2 rounded-full transition-colors">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path></svg>
          </button>
          <button className="hover:bg-gray-200 p-2 rounded-full transition-colors">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.43-3.9-6.63-6.83l1.88-1.55c.45-.34.48-.89.27-1.36-1.12-2.28-1.3-4.7-1.3-4.7 0-.55-.45-1-1-1H3.03C2.45 0 2 1.25 2 1.25c0 10.2 8.5 18.7 18.7 18.7h.06c.55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"></path></svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-2 flex flex-col hide-scrollbar">
        {/* Date Divider */}
        <div className="self-center my-4 bg-white text-[#54656f] text-[12px] px-3 py-1.5 rounded-lg shadow-sm font-medium uppercase tracking-wide">
          Today
        </div>

        {messages.map((m, i) => (
          <div 
            key={i} 
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
          >
            <div className={`relative px-3 py-1.5 rounded-xl shadow-sm text-[14.2px] leading-relaxed break-words max-w-[85%] ${
              m.role === 'user' 
                ? 'bg-[#dcf8c6] text-[#111b21] rounded-tr-none' 
                : 'bg-white text-[#111b21] rounded-tl-none'
            }`}>
              {m.content}
              <div className="flex items-center justify-end gap-1 mt-1">
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
             <div className="bg-white px-4 py-2 rounded-xl rounded-tl-none shadow-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-pulse delay-75" />
                <div className="w-1.5 h-1.5 bg-[#667781] rounded-full animate-pulse delay-150" />
             </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="relative z-10 bg-[#f0f2f5] px-3 py-2 flex items-center gap-2">
        <button className="p-2 text-[#54656f] hover:bg-gray-200 rounded-full transition-colors">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>
        </button>
        
        <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-1.5 gap-3 border border-gray-200">
          <button className="text-[#54656f]">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5s.67 1.5 1.5 1.5zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"></path></svg>
          </button>
          <input 
            type="text" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            placeholder="Type a message"
            className="flex-1 outline-none text-[#111b21] text-[15px] bg-transparent"
          />
          <button className="text-[#54656f]">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6V17.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-1.5z"></path></svg>
          </button>
        </div>

        <button 
          onClick={handleSend}
          disabled={isTyping}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
            inputValue.trim() ? 'bg-[#00a884] text-white shadow-md' : 'text-[#54656f]'
          }`}
        >
          {inputValue.trim() ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>
          )}
        </button>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default ChatPanel;

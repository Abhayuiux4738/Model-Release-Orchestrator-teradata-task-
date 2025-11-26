import React, { useEffect, useRef, useState } from 'react';
import { Bot, AlertTriangle, CheckCircle, Brain, ShieldAlert, Sparkles, Lightbulb, Copy, Check, User } from 'lucide-react';
import { AgentMessage } from '../types';

interface TerraPanelProps {
  messages: AgentMessage[];
}

export const TerraPanel: React.FC<TerraPanelProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight">Terra</h3>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Active</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
            <Sparkles size={12} className="text-purple-500" />
            <span className="text-[10px] font-bold text-slate-600">Gemini 2.5</span>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/50 scroll-smooth"
        role="log" 
        aria-live="polite"
        aria-label="Chat history"
      >
        {messages.length === 0 && (
          <div className="text-center mt-20 text-slate-400 text-sm flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
               <Brain className="opacity-50 text-slate-400" size={32} />
            </div>
            <p className="font-medium text-slate-500">Waiting for session start...</p>
            <p className="text-xs text-slate-400 mt-1">Terra is ready to assist you.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'User';
          
          return (
            <div key={msg.id} className={`animate-fade-in-up group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end space-x-2 max-w-[90%] ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm border mb-1
                  ${isUser 
                    ? 'bg-indigo-600 text-white border-indigo-700' 
                    : msg.type === 'alert' ? 'bg-red-50 text-red-500 border-red-100' 
                    : msg.type === 'recommendation' ? 'bg-purple-50 text-purple-500 border-purple-100' 
                    : msg.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' 
                    : 'bg-blue-50 text-blue-500 border-blue-100'
                  }`}>
                  {isUser ? <User size={14} /> 
                   : msg.type === 'alert' ? <AlertTriangle size={14} /> 
                   : msg.type === 'recommendation' ? <Lightbulb size={14} /> 
                   : msg.type === 'success' ? <CheckCircle size={14} /> 
                   : <Bot size={14} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className={`p-3.5 rounded-2xl text-sm shadow-sm border relative backdrop-blur-sm transition-colors
                    ${isUser
                      ? 'bg-indigo-600 border-indigo-700 text-white rounded-br-none'
                      : msg.type === 'alert' ? 'bg-red-50 border-red-200 text-red-900 rounded-tl-none' 
                      : msg.type === 'recommendation' ? 'bg-purple-50 border-purple-200 text-purple-900 rounded-tl-none' 
                      : msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-900 rounded-tl-none' 
                      : 'bg-white border-slate-200 text-slate-700 rounded-tl-none'
                    }`}>
                    
                    {/* Copy Button (Only for agent messages) */}
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className={`absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                          ${msg.type === 'alert' ? 'hover:bg-red-100 text-red-400' 
                            : msg.type === 'recommendation' ? 'hover:bg-purple-100 text-purple-400' 
                            : msg.type === 'success' ? 'hover:bg-green-100 text-green-400' 
                            : 'hover:bg-slate-100 text-slate-400'}`}
                        aria-label="Copy message text"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    )}

                    {msg.type === 'recommendation' && !isUser && (
                       <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Sparkles size={12} /> AI Insight
                       </div>
                    )}

                    <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.text}</p>

                    {msg.metadata && (
                      <div className="mt-3 pt-2 border-t border-dashed border-slate-300/50 flex flex-wrap gap-2">
                        {msg.metadata.confidence && (
                           <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/50 text-slate-600 border border-slate-200 uppercase tracking-wide">
                             Conf: {msg.metadata.confidence}%
                           </span>
                        )}
                        {msg.metadata.risk && (
                           <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide
                             ${msg.metadata.risk === 'High' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-yellow-50 text-yellow-600 border-yellow-200'}`}>
                             <ShieldAlert size={10} className="mr-1" /> Risk: {msg.metadata.risk}
                           </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] text-slate-400 mt-1 block font-medium ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
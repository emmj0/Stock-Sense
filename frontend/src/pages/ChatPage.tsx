import { useState, useEffect, useRef } from 'react';
import { sendChatMessage, fetchChatSessions, fetchChatSession, deleteChatSession } from '../api';
import { useAuth } from '../providers/AuthProvider';
import { Plus, Trash2, MessageSquare, History, X, ArrowUp, Bot, Sparkles } from 'lucide-react';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface ChatSessionItem { _id: string; title: string; updatedAt: string; }

export default function ChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try { setSessions(await fetchChatSessions()); } catch {}
    finally { setSessionsLoading(false); }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const session = await fetchChatSession(sessionId);
      setActiveSessionId(session._id);
      setMessages(session.messages || []);
      setHistoryOpen(false);
    } catch {}
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s._id !== sessionId));
      if (activeSessionId === sessionId) startNewChat();
    } catch {}
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = '24px';
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await sendChatMessage(msg, activeSessionId || undefined);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      if (!activeSessionId && res.sessionId) { setActiveSessionId(res.sessionId); loadSessions(); }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: err?.response?.data?.message || 'Failed to get response.' }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => {
      const t = line.trim();
      if (!t) return <div key={i} className="h-2" />;
      const num = t.match(/^(?:(\d+)\.\s+|\((\d+)\)\s+)(.+)/);
      if (num) return <div key={i} className="flex gap-2 py-0.5"><span className="text-brand-500 font-semibold text-xs mt-0.5 min-w-[18px]">{num[1] || num[2]}.</span><span>{num[3]}</span></div>;
      if (t.startsWith('- ') || t.startsWith('• ')) return <div key={i} className="flex gap-2 py-0.5 pl-1"><span className="text-brand-400 mt-1">•</span><span>{t.slice(2)}</span></div>;
      if ((t === t.toUpperCase() && t.length > 3 && t.length < 40) || (t.endsWith(':') && t.length < 50)) return <div key={i} className="font-semibold text-slate-900 pt-2 pb-0.5 text-[13px]">{t}</div>;
      if (t.match(/^.{2,8}:\s*Rs\./) || /^(Available Cash|Net Worth|Total Invested|Current Value|Total P&L):/i.test(t)) return <div key={i} className="font-mono text-xs py-0.5 bg-brand-50 rounded px-2 my-0.5 border border-brand-100">{t}</div>;
      return <span key={i}>{t}{i < content.split('\n').length - 1 && <br />}</span>;
    });
  };

  const suggestions = [
    "What's in my portfolio?",
    "What's my balance?",
    "Show me top gainers today",
    "What stocks can I buy with 5000 Rs?",
    "What is a dividend?",
    "Show me stock predictions",
  ];

  const Avatar = ({ role }: { role: 'user' | 'assistant' }) => {
    if (role === 'assistant') {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-orange-600 flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/30">
          <Bot size={16} className="text-white" />
        </div>
      );
    }
    return user?.avatar ? (
      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-xl object-cover shrink-0 ring-1 ring-slate-200" />
    ) : (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
        {user?.name?.charAt(0).toUpperCase() || 'U'}
      </div>
    );
  };

  const autoGrow = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget; t.style.height = '24px'; t.style.height = Math.min(t.scrollHeight, 140) + 'px';
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/60 to-white">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-100 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          
          
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={startNewChat} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-lg hover:bg-brand-100 transition-colors">
            <Plus size={14} /> <span className="hidden sm:inline">New</span>
          </button>
          <button onClick={() => { setHistoryOpen(true); loadSessions(); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <History size={14} /> <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-dark">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-4 py-8">
            <div className="w-full max-w-xl mx-auto flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-orange-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-brand-500/30">
                <Sparkles size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1 font-display text-center">
                Hi {user?.name?.split(' ')[0] || 'there'}! How can I help?
              </h2>
              <p className="text-sm text-slate-400 text-center mb-8 max-w-sm">
                Ask about stock prices, your portfolio and cash balance, AI predictions, or anything PSX-related.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {suggestions.map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:border-brand-200 hover:bg-brand-50/40 hover:text-slate-900 hover:shadow-soft transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <Avatar role={msg.role} />
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand-500 text-white rounded-tr-md shadow-sm shadow-brand-500/20'
                    : 'bg-white text-slate-800 rounded-tl-md border border-slate-200/80 shadow-soft'
                }`}>
                  <div className="whitespace-pre-wrap break-words">{formatMessage(msg.content)}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-2.5">
                <Avatar role="assistant" />
                <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3.5 border border-slate-200/80 shadow-soft">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar (always visible) */}
      <div className="shrink-0 bg-white/80 backdrop-blur-md border-t border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-white rounded-2xl border border-slate-200 shadow-soft px-4 py-2.5 transition-all focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={autoGrow}
              placeholder={messages.length ? 'Ask a follow-up…' : 'Ask anything about PSX…'}
              rows={1}
              className="flex-1 bg-transparent resize-none text-sm text-slate-900 placeholder-slate-400 focus:outline-none max-h-36"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">StockSense can be wrong — not financial advice. Verify before investing.</p>
        </div>
      </div>

      {/* History drawer */}
      {historyOpen && (
        <>
          <div className="fixed inset-0 bg-ink-950/40 backdrop-blur-sm z-50" onClick={() => setHistoryOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History size={18} className="text-brand-500" />
                <h2 className="text-base font-bold text-slate-900">Chat History</h2>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-dark">
              {sessionsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare size={28} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No conversations yet</p>
                </div>
              ) : (
                sessions.map(session => (
                  <button
                    key={session._id}
                    onClick={() => loadSession(session._id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all group flex items-center justify-between gap-2 ${
                      activeSessionId === session._id
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare size={15} className="shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{session.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(session.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span
                      onClick={e => handleDeleteSession(e, session._id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all shrink-0"
                    >
                      <Trash2 size={14} />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

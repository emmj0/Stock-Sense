import { useState, useEffect, useRef } from 'react';
import { sendChatMessage, fetchChatSessions, fetchChatSession, deleteChatSession } from '../api';
import { useAuth } from '../providers/AuthProvider';
import { HiOutlinePaperAirplane, HiOutlinePlus, HiOutlineTrash, HiOutlineChatAlt2, HiOutlineMenuAlt2, HiOutlineX } from 'react-icons/hi';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ChatSessionItem {
  _id: string;
  title: string;
  updatedAt: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await fetchChatSessions();
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const session = await fetchChatSession(sessionId);
      setActiveSessionId(session._id);
      setMessages(session.messages || []);
      setSidebarOpen(false);
    } catch {
      // ignore
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      if (activeSessionId === sessionId) {
        startNewChat();
      }
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await sendChatMessage(msg, activeSessionId || undefined);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);

      if (!activeSessionId && res.sessionId) {
        setActiveSessionId(res.sessionId);
        loadSessions();
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Failed to get response. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  const suggestedQuestions = [
    "What's in my portfolio?",
    "Show me top gainers today",
    "What stocks can I buy with 5000 Rs?",
    "What is a dividend?",
    "Show me stock predictions",
    "What are my preferences?",
  ];

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-50 md:z-0 h-full w-72 bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm shadow-lg shadow-blue-600/20"
          >
            <HiOutlinePlus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessionsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No conversations yet</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session._id}
                onClick={() => loadSession(session._id)}
                className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all group flex items-center justify-between gap-2 ${
                  activeSessionId === session._id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <HiOutlineChatAlt2 className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{session.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, session._id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* User info */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <HiOutlineMenuAlt2 className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <HiOutlineChatAlt2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">StockSense AI</h1>
              <p className="text-xs text-gray-500">Your PSX investment assistant</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-6 shadow-xl shadow-blue-600/20">
                <HiOutlineChatAlt2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Hi {user?.name?.split(' ')[0]}! How can I help?
              </h2>
              <p className="text-sm text-gray-500 text-center mb-8">
                Ask me about stock prices, your portfolio, predictions, sectors, or anything PSX-related.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="text-left px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{formatMessage(msg.content)}</div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about stocks, portfolio, predictions..."
                rows={1}
                className="flex-1 bg-transparent resize-none text-sm text-gray-900 placeholder-gray-400 focus:outline-none max-h-32"
                style={{ minHeight: '24px' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = '24px';
                  t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20 flex-shrink-0"
              >
                <HiOutlinePaperAirplane className="w-4 h-4 rotate-90" />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              StockSense AI can make mistakes. Not financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

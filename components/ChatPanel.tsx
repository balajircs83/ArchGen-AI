import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare, Bot, User } from 'lucide-react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isTyping: boolean;
  hasArchitecture: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isTyping,
  hasArchitecture
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [width, setWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.max(280, Math.min(window.innerWidth * 0.8, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const message = input;
    setInput('');
    await onSendMessage(message);
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-surface border-r border-line shadow-2xl z-[60] transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      style={{
        width: window.innerWidth < 768 ? '100%' : `${width}px`,
        transition: isResizing ? 'none' : 'transform 0.3s ease-in-out'
      }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent transition-colors z-[60] hidden md:block"
      />
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-line bg-surface2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-accent-soft rounded-lg">
            <MessageSquare className="w-5 h-5 text-fg" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-fg">Architecture Q&A</h2>
            <p className="text-xs text-muted">Ask about the design</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-surface2 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-muted" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasArchitecture ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted px-6">
            <Bot className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Generate an architecture first to start asking questions.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted px-6 space-y-6">
            <div className="p-4 bg-surface2 rounded-full">
              <Bot className="w-8 h-8 text-fg opacity-80" />
            </div>
            <div>
              <p className="text-sm font-medium text-fg mb-2">How can I help you?</p>
              <p className="text-xs text-muted">Ask about data flow, component choices, or scalability.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full">
              <button onClick={() => onSendMessage("Explain the data flow")} className="text-xs bg-surface2 hover:bg-line border border-line py-2 px-3 rounded-lg transition-colors text-left">
                "Explain the data flow"
              </button>
              <button onClick={() => onSendMessage("What technologies should I use?")} className="text-xs bg-surface2 hover:bg-line border border-line py-2 px-3 rounded-lg transition-colors text-left">
                "What technologies should I use?"
              </button>
              <button onClick={() => onSendMessage("Add a Redis cache")} className="text-xs bg-surface2 hover:bg-line border border-line py-2 px-3 rounded-lg transition-colors text-left">
                "Add a Redis cache"
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-fg" />
                </div>
              )}

              <div
                className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-fg text-app rounded-br-none'
                  : 'bg-surface2 text-fg border border-line rounded-bl-none'
                  }`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-surface2 prose-pre:border prose-pre:border-line">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-fg" />
                </div>
              )}
            </div>
          ))
        )}

        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-4 h-4 text-fg" />
            </div>
            <div className="bg-surface2 border border-line p-3 rounded-2xl rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-line bg-surface2">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping || !hasArchitecture}
            placeholder={hasArchitecture ? "Ask a question..." : "Generate architecture first"}
            className="w-full bg-surface2 text-fg placeholder-muted border border-line rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping || !hasArchitecture}
            className="absolute right-2 top-2 p-1.5 bg-fg text-app disabled:opacity-40 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
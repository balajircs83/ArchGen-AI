import React, { useState, useCallback, useEffect } from 'react';
import { Sparkles, Send, Layout, Info as InfoIcon, Loader2, History, LogOut, User as UserIcon, MessageSquare } from 'lucide-react';
import { Node } from 'reactflow';
import ArchitectureDiagram from './components/ArchitectureDiagram';
import InfoPanel from './components/InfoPanel';
import HistoryPanel from './components/HistoryPanel';
import ChatPanel from './components/ChatPanel';
import AuthScreen from './components/AuthScreen';
import { generateArchitecture, askArchitectureQuestion } from './services/geminiService';
import { authService } from './services/authService';
import { storageService } from './services/storageService';
import { supabase } from './services/supabaseClient';
import { GeneratedArchitecture, ArchitectureNodeData, User, SavedArchitecture, ChatMessage } from './types';

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // App State
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GeneratedArchitecture | null>(null);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const [selectedNode, setSelectedNode] = useState<Node<ArchitectureNodeData> | null>(null);
  
  // UI Panels State
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedArchitecture[]>([]);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatTyping, setIsChatTyping] = useState(false);

  // Load History Function
  const loadHistory = useCallback(async (userId: string) => {
    try {
      const userHistory = await storageService.getUserArchitectures(userId);
      setHistory(userHistory);
    } catch (error) {
      console.error("Failed to load history", error);
    }
  }, []);

  // Initialize Supabase Auth Listener
  useEffect(() => {
    const initializeAuth = async () => {
      // Check initial session
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        loadHistory(currentUser.id);
      }
      setIsAuthLoading(false);
    };

    initializeAuth();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const mappedUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata.full_name || 'User'
        };
        setUser(mappedUser);
        loadHistory(mappedUser.id);
      } else {
        setUser(null);
        setHistory([]);
        setData(null);
        setCurrentId(undefined);
      }
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadHistory]);


  const handleLogin = (loggedInUser: User) => {
    // Handled by Auth Listener automatically, but we can set state immediately for faster UI
    setUser(loggedInUser);
    loadHistory(loggedInUser.id);
  };

  const handleLogout = async () => {
    await authService.logout();
    // State reset handled by auth listener
    setIsHistoryOpen(false);
    setIsInfoPanelOpen(false);
    setIsChatOpen(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !user) return;

    setIsLoading(true);
    setError(null);
    setData(null);
    setCurrentId(undefined);
    setSelectedNode(null);
    setChatMessages([]); // Reset chat for new architecture

    try {
      // 1. Generate via AI
      const result = await generateArchitecture(prompt);
      
      // 2. Save to Supabase
      const savedRecord = await storageService.saveArchitecture(user.id, result, prompt);
      
      // 3. Update UI
      setData(savedRecord);
      setCurrentId(savedRecord.id);
      setIsInfoPanelOpen(true); // Open explanation by default on new generation
      
      // 4. Refresh History
      await loadHistory(user.id);
    } catch (err) {
      setError("Failed to generate architecture. Please try again with a more specific prompt.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (item: SavedArchitecture) => {
    setData(item);
    setCurrentId(item.id);
    setPrompt(item.prompt);
    setSelectedNode(null);
    setChatMessages([]); // Clear chat when switching history
    setIsHistoryOpen(false);
    setIsInfoPanelOpen(true); // Auto-open info when loading history item to see details
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        await storageService.deleteArchitecture(id);
        if (user) await loadHistory(user.id);
        
        if (currentId === id) {
          setData(null);
          setCurrentId(undefined);
          setChatMessages([]);
        }
    } catch (err) {
        console.error("Failed to delete", err);
    }
  };

  const handleNodeClick = useCallback((node: Node<ArchitectureNodeData>) => {
    setSelectedNode(node);
    setIsInfoPanelOpen(true);
  }, []);

  const closeInfoPanel = () => {
    setIsInfoPanelOpen(false);
    setTimeout(() => setSelectedNode(null), 300);
  };

  const toggleHistory = () => {
    if (isChatOpen) setIsChatOpen(false);
    setIsHistoryOpen(!isHistoryOpen);
  };

  const toggleChat = () => {
    if (isHistoryOpen) setIsHistoryOpen(false);
    setIsChatOpen(!isChatOpen);
  };

  const handleSendMessage = async (content: string) => {
    if (!data) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setIsChatTyping(true);

    try {
      // Get AI response
      const responseText = await askArchitectureQuestion(data, content, chatMessages);
      
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: responseText,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error("Chat Error:", err);
      // Optional: Add error message to chat
    } finally {
      setIsChatTyping(false);
    }
  };

  // Render Authentication Screen if not logged in
  if (isAuthLoading) {
    return (
      <div className="w-screen h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="relative w-screen h-screen flex flex-col bg-gray-900 overflow-hidden">
      
      {/* Header / Navbar */}
      <header className="absolute top-0 left-0 right-0 z-40 p-4 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-between items-start">
          <div className="pointer-events-auto flex items-center gap-3">
             {/* Logo Section */}
            <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-2xl p-2 px-4 shadow-xl flex items-center gap-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                    <Layout className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-white leading-tight">ArchGen AI</h1>
                    <p className="text-[10px] text-gray-400 font-medium">SYSTEM ARCHITECT</p>
                </div>
            </div>

            {/* History Toggle */}
            <button
                onClick={toggleHistory}
                className={`p-3 rounded-xl border transition-all shadow-lg flex items-center gap-2 group ${
                    isHistoryOpen 
                    ? 'bg-blue-600 border-blue-500 text-white' 
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                title="View History"
            >
                <History className="w-5 h-5" />
                <span className="text-sm font-medium hidden md:inline">History</span>
            </button>

            {/* AI Q&A Toggle */}
            <button
                onClick={toggleChat}
                className={`p-3 rounded-xl border transition-all shadow-lg flex items-center gap-2 group ${
                    isChatOpen 
                    ? 'bg-purple-600 border-purple-500 text-white' 
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                title="Ask AI"
            >
                <MessageSquare className="w-5 h-5" />
                <span className="text-sm font-medium hidden md:inline">Ask AI</span>
            </button>
          </div>

          <div className="pointer-events-auto flex gap-3">
             {/* User Profile / Logout */}
             <div className="flex items-center gap-3 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-2xl p-1.5 pl-4 shadow-xl">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-300 hidden md:inline">{user.name}</span>
                </div>
                <button 
                    onClick={handleLogout}
                    className="p-2 hover:bg-red-500/20 hover:text-red-400 text-gray-400 rounded-xl transition-colors"
                    title="Sign Out"
                >
                    <LogOut className="w-4 h-4" />
                </button>
             </div>

             {/* Info Panel Toggle (Only visible if data exists) */}
             {data && (
                <button
                onClick={() => { setSelectedNode(null); setIsInfoPanelOpen(true); }}
                className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 transition-all shadow-lg group"
                title="View Explanation"
                >
                <InfoIcon className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
                </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 w-full h-full relative">
        {data ? (
          <ArchitectureDiagram data={data} onNodeClick={handleNodeClick} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 select-none">
            {!isLoading && (
              <>
                <div className="w-24 h-24 bg-gray-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-gray-700 rotate-3 transform hover:rotate-6 transition-transform duration-500 group">
                    <Sparkles className="w-10 h-10 text-blue-500 group-hover:scale-110 transition-transform" />
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4 animate-fadeIn">
                  Design Systems in Seconds
                </h2>
                <p className="text-gray-400 max-w-lg text-lg mb-8 animate-fadeIn delay-100">
                  Describe your application, and our AI will engineer a complete, interactive system architecture diagram for you.
                </p>
                <div className="flex gap-3 text-sm text-gray-500 animate-fadeIn delay-200">
                    <span className="px-3 py-1 bg-gray-800 rounded-full border border-gray-700">Microservices</span>
                    <span className="px-3 py-1 bg-gray-800 rounded-full border border-gray-700">Event-Driven</span>
                    <span className="px-3 py-1 bg-gray-800 rounded-full border border-gray-700">Scalable</span>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h3 className="text-xl font-semibold text-white">Architecting Solution...</h3>
          <p className="text-gray-400 mt-2">Analyzing requirements and designing components</p>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="absolute bottom-8 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 text-red-200 rounded-lg text-sm text-center backdrop-blur-md animate-fadeIn">
              {error}
            </div>
          )}
          
          <form onSubmit={handleGenerate} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-500"></div>
            <div className="relative flex items-center bg-gray-900 rounded-2xl p-1.5 shadow-2xl">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A scalable e-commerce platform with real-time inventory and AI recommendations..."
                className="w-full bg-transparent text-white placeholder-gray-500 px-4 py-3 outline-none text-lg"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </form>
          
          <p className="text-center text-gray-500 text-xs mt-3 font-medium">
            Powered by Gemini 2.5 Flash • Generates fully interactive diagrams
          </p>
        </div>
      </div>

      {/* Sidebars */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
        currentId={currentId}
      />

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isTyping={isChatTyping}
        hasArchitecture={!!data}
      />
      
      <InfoPanel
        isOpen={isInfoPanelOpen}
        onClose={closeInfoPanel}
        selectedNode={selectedNode}
        explanation={data?.explanation || null}
        title={data?.title || ''}
      />
    </div>
  );
}

export default App;
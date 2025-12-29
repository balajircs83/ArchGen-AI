import React, { useState, useCallback, useEffect } from 'react';
import { Sparkles, Send, Home, Info as InfoIcon, Loader2, History, LogOut, User as UserIcon, MessageSquare, Download, ChevronDown, Image as ImageIcon, FileImage, FileType, FileVideo, Server, Globe, Shield } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import gifshot from 'gifshot';
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

  // Export State
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

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
  const handleGenerateBase = async (e: React.FormEvent, directPrompt?: string) => {
    e.preventDefault();
    const activePrompt = directPrompt || prompt;
    if (!activePrompt.trim() || !user) return;

    setIsLoading(true);
    setError(null);
    setData(null);
    setCurrentId(undefined);
    setSelectedNode(null);
    setChatMessages([]);

    try {
      const result = await generateArchitecture(activePrompt);
      setData(result);
      setIsInfoPanelOpen(true);
      setPrompt('');
    } catch (err) {
      setError("Failed to generate architecture. Please try again with a more specific prompt.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
      handleGenerateBase(fakeEvent, examplePrompt);
    }, 0);
  };

  const handleGoHome = () => {
    setData(null);
    setCurrentId(undefined);
    setPrompt('');
    setSelectedNode(null);
    setChatMessages([]);
    setIsInfoPanelOpen(false);
    setIsHistoryOpen(false);
    setIsChatOpen(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!user || !data || currentId) return;

    setIsLoading(true);
    try {
      const savedRecord = await storageService.saveArchitecture(user.id, data, prompt);
      setData(savedRecord);
      setCurrentId(savedRecord.id);
      await loadHistory(user.id);
    } catch (err) {
      setError("Failed to save architecture. Please try again.");
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

  const exportAsImage = async (format: 'png' | 'jpeg') => {
    const element = document.querySelector('.react-flow__renderer') as HTMLElement;
    if (!element) return;

    // Temporarily hide controls and minimap for clean export
    const controls = document.querySelector('.react-flow__controls') as HTMLElement;
    const minimap = document.querySelector('.react-flow__minimap') as HTMLElement;
    if (controls) controls.style.display = 'none';
    if (minimap) minimap.style.display = 'none';

    try {
      const dataUrl = format === 'png'
        ? await toPng(element, { backgroundColor: '#111827', quality: 1.0 })
        : await toJpeg(element, { backgroundColor: '#111827', quality: 1.0 });

      const link = document.createElement('a');
      link.download = `${data?.title || 'architecture'}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      if (controls) controls.style.display = 'flex';
      if (minimap) minimap.style.display = 'block';
      setIsExportOpen(false);
    }
  };

  const exportAsPDF = async () => {
    const element = document.querySelector('.react-flow__renderer') as HTMLElement;
    if (!element) return;

    const controls = document.querySelector('.react-flow__controls') as HTMLElement;
    const minimap = document.querySelector('.react-flow__minimap') as HTMLElement;
    if (controls) controls.style.display = 'none';
    if (minimap) minimap.style.display = 'none';

    try {
      const dataUrl = await toPng(element, { backgroundColor: '#111827', quality: 1.0 });
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [element.offsetWidth, element.offsetHeight]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, element.offsetWidth, element.offsetHeight);
      pdf.save(`${data?.title || 'architecture'}.pdf`);
    } catch (err) {
      console.error('PDF Export failed', err);
    } finally {
      if (controls) controls.style.display = 'flex';
      if (minimap) minimap.style.display = 'block';
      setIsExportOpen(false);
    }
  };

  const exportAsGIF = async () => {
    const element = document.querySelector('.react-flow__renderer') as HTMLElement;
    if (!element) return;

    setIsRecording(true);
    setRecordingProgress(0);
    setIsExportOpen(false);

    const controls = document.querySelector('.react-flow__controls') as HTMLElement;
    const minimap = document.querySelector('.react-flow__minimap') as HTMLElement;
    if (controls) controls.style.display = 'none';
    if (minimap) minimap.style.display = 'none';

    try {
      const frames: string[] = [];
      const frameCount = 15;
      const interval = 80;

      for (let i = 0; i < frameCount; i++) {
        // Force flow animation state
        const edges = element.querySelectorAll('.react-flow__edge-path');
        edges.forEach((edge: any) => {
          edge.style.strokeDashoffset = (20 - (i * 2)).toString();
          edge.style.strokeDasharray = '8';
        });

        const frame = await toPng(element, {
          backgroundColor: '#111827',
          quality: 1.0,
          pixelRatio: 1
        });
        frames.push(frame);
        setRecordingProgress(Math.round(((i + 1) / frameCount) * 100));
        await new Promise(r => setTimeout(r, interval));
      }

      (gifshot as any).createGIF({
        images: frames,
        gifWidth: element.offsetWidth,
        gifHeight: element.offsetHeight,
        interval: 0.08,
        numFrames: frameCount,
        frameDuration: 0.8,
        sampleInterval: 10,
      }, (obj: any) => {
        if (!obj.error) {
          const link = document.createElement('a');
          link.download = `${data?.title || 'architecture'}.gif`;
          link.href = obj.image;
          link.click();
        }
        setIsRecording(false);
        if (controls) controls.style.display = 'flex';
        if (minimap) minimap.style.display = 'block';
      });
    } catch (err) {
      console.error('GIF Export failed', err);
      setIsRecording(false);
      if (controls) controls.style.display = 'flex';
      if (minimap) minimap.style.display = 'block';
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
            <button
              onClick={handleGoHome}
              className="bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-2xl p-2 px-4 shadow-xl flex items-center gap-2 pointer-events-auto hover:bg-gray-800 transition-all cursor-pointer"
            >
              <div className="p-2 bg-blue-600 rounded-lg">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h1 className="font-bold text-white leading-tight">ArchGen AI</h1>
                <p className="text-[10px] text-gray-400 font-medium">SYSTEM ARCHITECT</p>
              </div>
            </button>

            {/* History Toggle */}
            <button
              onClick={toggleHistory}
              className={`p-3 rounded-xl border transition-all shadow-lg flex items-center gap-2 group ${isHistoryOpen
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
              className={`p-3 rounded-xl border transition-all shadow-lg flex items-center gap-2 group ${isChatOpen
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
              <div className="flex gap-2">
                {!currentId && (
                  <button
                    onClick={handleSave}
                    className="p-3 bg-green-600 hover:bg-green-500 text-white rounded-xl border border-green-500 transition-all shadow-lg group flex items-center gap-2"
                    title="Save Architecture"
                    disabled={isLoading}
                  >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm font-medium hidden md:inline">Save</span>
                  </button>
                )}
                <button
                  onClick={() => { setSelectedNode(null); setIsInfoPanelOpen(true); }}
                  className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 transition-all shadow-lg group"
                  title="View Explanation"
                >
                  <InfoIcon className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
                </button>
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full animate-fadeIn delay-200">
                  <button
                    onClick={() => handleExampleClick("A scalable e-commerce platform with real-time inventory and AI recommendations")}
                    className="p-6 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700/50 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-95 group"
                  >
                    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/40 transition-colors">
                      <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-white font-bold mb-2">E-Commerce Flow</h3>
                    <p className="text-sm text-gray-400">High-traffic web app with inventory sync</p>
                  </button>

                  <button
                    onClick={() => handleExampleClick("Microservices architecture for a banking app with event-driven transactions")}
                    className="p-6 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700/50 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-95 group"
                  >
                    <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-500/40 transition-colors">
                      <Server className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white font-bold mb-2">FinTech Core</h3>
                    <p className="text-sm text-gray-400">Event-driven banking with microservices</p>
                  </button>

                  <button
                    onClick={() => handleExampleClick("Secure IoT data pipeline using serverless functions and real-time streaming")}
                    className="p-6 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700/50 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-95 group"
                  >
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-500/40 transition-colors">
                      <Shield className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-white font-bold mb-2">IoT Data Pipeline</h3>
                    <p className="text-sm text-gray-400">Secure, serverless streaming for IoT devies</p>
                  </button>
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

          <form onSubmit={(e) => handleGenerateBase(e)} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-500"></div>
            <div className="relative flex items-center bg-gray-900 rounded-2xl p-1.5 shadow-2xl gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A scalable e-commerce platform with real-time inventory and AI recommendations..."
                className="w-full bg-transparent text-white placeholder-gray-500 px-4 py-3 outline-none text-lg"
                disabled={isLoading}
              />

              <div className="flex items-center gap-2 pr-1">
                {data && !isLoading && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsExportOpen(!isExportOpen)}
                      className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 transition-all flex items-center gap-2 group/export"
                      title="Export Diagram"
                    >
                      <Download className="w-5 h-5 text-blue-400 group-hover/export:scale-110 transition-transform" />
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isExportOpen && (
                      <div className="absolute bottom-full right-0 mb-3 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
                        <button
                          type="button"
                          onClick={() => exportAsImage('png')}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Export as PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => exportAsImage('jpeg')}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          <FileImage className="w-4 h-4" />
                          Export as JPEG
                        </button>
                        <button
                          type="button"
                          onClick={exportAsPDF}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          <FileType className="w-4 h-4" />
                          Export as PDF
                        </button>
                        <button
                          type="button"
                          onClick={exportAsGIF}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-blue-600 hover:text-white transition-colors border-t border-gray-700"
                        >
                          <FileVideo className="w-4 h-4 text-purple-400" />
                          <div className="flex flex-col items-start">
                            <span>Export as GIF</span>
                            <span className="text-[10px] opacity-60">Animated flow</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Recording Overlay */}
      {isRecording && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-md">
          <div className="bg-gray-800 p-8 rounded-3xl border border-gray-700 shadow-2xl flex flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {recordingProgress}%
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Capturing Animation</h3>
              <p className="text-sm text-gray-400">Recording data flow frames...</p>
            </div>
          </div>
        </div>
      )}

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
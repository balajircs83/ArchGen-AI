import React, { useState, useCallback, useEffect } from 'react';
import { Sparkles, Send, Info as InfoIcon, Loader2, LogOut, MessageSquare, Download, ChevronDown, Image as ImageIcon, FileImage, FileType, FileVideo, Sun, Moon, Plus, Save, Trash2, Layout, LayoutDashboard, Menu, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import gifshot from 'gifshot';
import { Node } from 'reactflow';
import ArchitectureDiagram from './components/ArchitectureDiagram';
import InfoPanel from './components/InfoPanel';
import ChatPanel from './components/ChatPanel';
import AuthScreen from './components/AuthScreen';
import UseCaseExam from './components/UseCaseExam';
import { generateArchitecture, askArchitectureQuestion } from './services/groqService';
import { authService } from './services/authService';
import { storageService } from './services/storageService';
import { useTheme, surfaceColor } from './utils/theme';
import { GeneratedArchitecture, ArchitectureNodeData, User, SavedArchitecture, ChatMessage } from './types';

function App() {
  const [theme, toggleTheme] = useTheme();
  const exportBg = surfaceColor(theme);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('archgen-sidebar') === 'collapsed');
  const toggleCollapsed = () => {
    localStorage.setItem('archgen-sidebar', collapsed ? 'open' : 'collapsed');
    setCollapsed(!collapsed);
  };
  const [view, setView] = useState<'dashboard' | 'usecase'>('dashboard');

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

  useEffect(() => {
    return authService.onChange((u) => {
      if (u) {
        setUser(u);
        loadHistory(u.id);
      } else {
        setUser(null);
        setHistory([]);
        setData(null);
        setCurrentId(undefined);
      }
      setIsAuthLoading(false);
    });
  }, [loadHistory]);

  const handleLogin = (loggedInUser: User) => {
    // Handled by Auth Listener automatically, but we can set state immediately for faster UI
    setUser(loggedInUser);
    loadHistory(loggedInUser.id);
  };

  const handleLogout = async () => {
    await authService.logout();
    // State reset handled by auth listener
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
    setView('dashboard');
    setData(null);
    setCurrentId(undefined);
    setPrompt('');
    setSelectedNode(null);
    setChatMessages([]);
    setIsInfoPanelOpen(false);
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
    setView('dashboard');
    setData(item);
    setCurrentId(item.id);
    setPrompt(item.prompt);
    setSelectedNode(null);
    setChatMessages([]); // Clear chat when switching history
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

  const toggleChat = () => setIsChatOpen(!isChatOpen);

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
      const result = await askArchitectureQuestion(data, content, chatMessages);

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: result.message,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, aiMsg]);

      // Apply architecture updates if requested
      if (result.updatedArchitecture) {
        setData(result.updatedArchitecture);
        setCurrentId(undefined); // Reset ID as this is now a modified unsaved version
      }

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
        ? await toPng(element, { backgroundColor: exportBg, quality: 1.0 })
        : await toJpeg(element, { backgroundColor: exportBg, quality: 1.0 });

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
      const dataUrl = await toPng(element, { backgroundColor: exportBg, quality: 1.0 });
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
          backgroundColor: exportBg,
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

  if (isAuthLoading) {
    return (
      <div className="w-screen h-screen bg-app flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const dots = ['bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500'];
  const examples = [
    { title: 'E-Commerce Flow', desc: 'High-traffic web app with inventory sync', tag: 'Web', dot: 'bg-blue-500', prompt: 'A scalable e-commerce platform with real-time inventory and AI recommendations' },
    { title: 'FinTech Core', desc: 'Event-driven banking with microservices', tag: 'Finance', dot: 'bg-violet-500', prompt: 'Microservices architecture for a banking app with event-driven transactions' },
    { title: 'IoT Data Pipeline', desc: 'Secure, serverless streaming for IoT devices', tag: 'IoT', dot: 'bg-emerald-500', prompt: 'Secure IoT data pipeline using serverless functions and real-time streaming' },
  ];
  const iconBtn = 'w-8 h-8 flex items-center justify-center rounded-lg border border-line bg-surface text-muted hover:text-fg transition-colors';
  const ghostBtn = 'h-8 px-3 flex items-center gap-1.5 rounded-lg border border-line bg-surface text-sm font-medium hover:bg-surface2 transition-colors disabled:opacity-50';
  const card = 'rounded-xl border border-line bg-surface';
  const lastSaved = history[0] ? new Date(history[0].timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'nothing saved yet';

  return (
    <div className="w-screen h-screen flex bg-app text-fg overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar (collapse only applies on desktop; mobile uses the drawer) */}
      <aside className={`fixed md:relative z-50 h-full w-[220px] ${collapsed ? 'md:w-[60px]' : ''} shrink-0 flex flex-col bg-surface border-r border-line transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Collapse handle sits on the splitter between sidebar and content */}
        <button onClick={toggleCollapsed} title={collapsed ? 'Expand menu' : 'Collapse menu'} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="hidden md:flex absolute -right-3 top-[60px] z-10 w-6 h-6 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-fg hover:border-muted shadow-sm">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
        <div className="p-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-6 h-6 rounded-md bg-accent text-accent-fg flex items-center justify-center"><Layout className="w-3.5 h-3.5" /></div>
            <span className={`font-semibold ${collapsed ? 'md:hidden' : ''}`}>ArchGen AI</span>
          </div>
        </div>
        <nav className="px-3 space-y-1">
          <button onClick={() => { handleGoHome(); setIsSidebarOpen(false); }}
            title={collapsed ? 'Dashboard' : undefined}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium border ${collapsed ? 'md:justify-center' : ''} ${view === 'dashboard' && !data ? 'bg-accent-soft border-accent/60' : 'border-transparent hover:bg-surface2'}`}>
            <LayoutDashboard className="w-4 h-4 shrink-0" /><span className={`${collapsed ? 'md:hidden' : ''}`}>Dashboard</span>
          </button>
          <button onClick={() => { toggleChat(); setIsSidebarOpen(false); }}
            title={collapsed ? 'Ask AI' : undefined}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium border ${collapsed ? 'md:justify-center' : ''} ${isChatOpen ? 'bg-accent-soft border-accent/60' : 'border-transparent hover:bg-surface2'}`}>
            <MessageSquare className="w-4 h-4 shrink-0" /><span className={`${collapsed ? 'md:hidden' : ''}`}>Ask AI</span>
          </button>
          <button onClick={() => { setView('usecase'); setIsSidebarOpen(false); }}
            title={collapsed ? 'Use Cases' : undefined}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium border ${collapsed ? 'md:justify-center' : ''} ${view === 'usecase' ? 'bg-accent-soft border-accent/60' : 'border-transparent hover:bg-surface2'}`}>
            <GraduationCap className="w-4 h-4 shrink-0" /><span className={`${collapsed ? 'md:hidden' : ''}`}>Use Cases</span>
          </button>
        </nav>

        <div className={`mt-5 px-3 flex-1 min-h-0 flex flex-col ${collapsed ? 'md:hidden' : ''}`}>
          <div className="flex items-center justify-between px-2.5 mb-1.5">
            <span className="text-[11px] text-muted">Saved designs</span>
            {history.length > 0 && <span className="text-[10px] px-1.5 rounded-full bg-accent-soft text-fg border border-accent/50">{history.length}</span>}
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {history.length === 0 && <p className="px-2.5 py-2 text-xs text-muted">Generated designs you save appear here.</p>}
            {history.map((item, i) => (
              <div key={item.id} onClick={() => { handleSelectHistory(item); setIsSidebarOpen(false); }}
                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-sm ${currentId === item.id ? 'bg-accent-soft' : 'hover:bg-surface2'}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[i % dots.length]}`} />
                <span className="truncate flex-1" title={item.prompt}>{item.title}</span>
                <button onClick={(e) => handleDeleteHistory(item.id, e)} title="Delete" className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {collapsed && <div className="hidden md:block flex-1" />}
        <div className={`p-3 border-t border-line flex items-center gap-2.5 ${collapsed ? 'md:justify-center' : ''}`} title={collapsed ? `${user.name} · ${user.email}` : undefined}>
          <div className="w-8 h-8 shrink-0 rounded-full bg-accent text-accent-fg flex items-center justify-center text-sm font-semibold">{user.name.charAt(0).toUpperCase()}</div>
          <div className={`min-w-0 flex-1 leading-tight ${collapsed ? 'md:hidden' : ''}`}>
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-muted truncate">{user.email}</div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-accent-soft border border-accent/50 ${collapsed ? 'md:hidden' : ''}`}>Synced</span>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 shrink-0 bg-surface border-b border-line flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm">
            <button className="md:hidden mr-1" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu"><Menu className="w-5 h-5" /></button>
            <LayoutDashboard className="w-4 h-4 text-muted" />
            <span className="font-medium">{view === 'usecase' ? 'Use Cases' : data ? data.title : 'Dashboard'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className={iconBtn} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={handleLogout} className={iconBtn} title="Sign out"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>

        <main className="flex-1 min-h-0 flex flex-col p-4 md:p-5 gap-4">
          {view === 'usecase' && (
            <div>
              <h1 className="text-xl font-bold">Use Cases</h1>
              <p className="text-xs text-muted mt-0.5">AI-generated, enterprise scenario exams for architect, developer and admin certifications</p>
            </div>
          )}
          {/* Kept mounted so an in-progress exam survives switching views. */}
          <div className={view === 'usecase' ? 'contents' : 'hidden'}>
            <UseCaseExam theme={theme} userId={user.id} />
          </div>

          {view === 'dashboard' && (<>
          {/* Page header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{data ? data.title : 'Dashboard'}</h1>
              <p className="text-xs text-muted mt-0.5">
                {data ? `${data.nodes.length} components · ${data.edges.length} connections${currentId ? '' : ' · unsaved'}` : 'Describe a system and get an interactive architecture diagram'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {data && (
                <>
                  <button onClick={handleGoHome} className={ghostBtn}><Plus className="w-4 h-4" /> New</button>
                  <button onClick={() => { setSelectedNode(null); setIsInfoPanelOpen(true); }} className={ghostBtn}><InfoIcon className="w-4 h-4" /> Details</button>
                  <div className="relative">
                    <button onClick={() => setIsExportOpen(!isExportOpen)} className={ghostBtn}>
                      <Download className="w-4 h-4" /> Export <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isExportOpen && (
                      <div className={`absolute right-0 top-full mt-2 w-48 ${card} shadow-xl overflow-hidden z-30`}>
                        {([
                          [ImageIcon, 'Export as PNG', () => exportAsImage('png')],
                          [FileImage, 'Export as JPEG', () => exportAsImage('jpeg')],
                          [FileType, 'Export as PDF', exportAsPDF],
                          [FileVideo, 'Export as GIF', exportAsGIF],
                        ] as const).map(([Icon, label, fn]) => (
                          <button key={label} onClick={fn} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface2 transition-colors">
                            <Icon className="w-4 h-4 text-muted" /> {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!currentId && (
                    <button onClick={handleSave} disabled={isLoading} className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-fg text-app text-sm font-semibold disabled:opacity-50">
                      <Save className="w-4 h-4" /> Save
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {data ? (
            <div className={`${card} flex-1 min-h-0 overflow-hidden`}>
              <ArchitectureDiagram data={data} onNodeClick={handleNodeClick} theme={theme} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              {/* Stat / template cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-accent bg-accent-soft p-4">
                  <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> Saved designs</span></div>
                  <div className="text-2xl font-bold mt-3">{history.length}</div>
                  <div className="text-[11px] text-muted mt-1">last saved {lastSaved}</div>
                </div>
                {examples.map((ex) => (
                  <button key={ex.title} onClick={() => handleExampleClick(ex.prompt)} disabled={isLoading}
                    className={`${card} p-4 text-left hover:border-muted transition-colors`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${ex.dot}`} />{ex.title}</span>
                      <span className="px-1.5 rounded bg-accent-soft border border-accent/50 text-[10px]">{ex.tag}</span>
                    </div>
                    <div className="text-sm font-medium mt-3 leading-snug">{ex.desc}</div>
                    <div className="text-[11px] text-muted mt-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Click to generate</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Saved architectures table */}
                <div className={`${card} xl:col-span-2 overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-line">
                    <div className="font-semibold">Your architectures</div>
                    <div className="text-[11px] text-muted">{history.length} saved</div>
                  </div>
                  {history.length === 0 ? (
                    <div className="p-10 text-center text-sm text-muted">Nothing saved yet. Generate a design below and hit Save.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-muted text-left">
                        <tr><th className="px-4 py-2 font-medium">Design</th><th className="px-2 font-medium text-right">Components</th><th className="px-2 font-medium text-right">Connections</th><th className="px-2 font-medium text-right">Created</th><th className="px-4" /></tr>
                      </thead>
                      <tbody>
                        {history.map((item, i) => (
                          <tr key={item.id} className="border-t border-line hover:bg-surface2">
                            <td className="px-4 py-3"><span className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${dots[i % dots.length]}`} /><span className="truncate max-w-[260px]" title={item.prompt}>{item.title}</span></span></td>
                            <td className="px-2 text-right tabular-nums">{item.nodes.length}</td>
                            <td className="px-2 text-right tabular-nums">{item.edges.length}</td>
                            <td className="px-2 text-right text-muted">{new Date(item.timestamp).toLocaleDateString()}</td>
                            <td className="px-4 text-right whitespace-nowrap">
                              <button onClick={() => handleSelectHistory(item)} className="h-7 px-3 rounded-md border border-line bg-surface hover:bg-surface2 text-xs">View</button>
                              <button onClick={(e) => handleDeleteHistory(item.id, e)} className="ml-1 h-7 px-2 rounded-md text-muted hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Tips */}
                <div className={card}>
                  <div className="px-4 py-3 border-b border-line">
                    <div className="font-semibold">Tips</div>
                    <div className="text-[11px] text-muted">Get more from ArchGen</div>
                  </div>
                  {[
                    ['Be specific', 'Mention scale, cloud, and key features for a sharper diagram.'],
                    ['Click any node', 'See its details and technologies in the side panel.'],
                    ['Ask AI to edit', 'Try "Add a Redis cache" in Ask AI to change the design.'],
                    ['Export anywhere', 'Download as PNG, JPEG, PDF or an animated GIF.'],
                  ].map(([t, d]) => (
                    <div key={t} className="px-4 py-3 border-t border-line first:border-t-0">
                      <div className="text-sm font-medium">{t}</div>
                      <div className="text-[11px] text-muted mt-0.5">{d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prompt bar */}
          <div className="shrink-0">
            {error && <div className="mb-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-500 text-sm text-center">{error}</div>}
            <form onSubmit={(e) => handleGenerateBase(e)} className={`${card} flex items-center gap-2 p-1.5 focus-within:border-muted`}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a system, e.g. a scalable e-commerce platform with real-time inventory…"
                className="flex-1 min-w-0 bg-transparent placeholder:text-muted px-3 py-2 outline-none"
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || !prompt.trim()} className="h-9 px-4 flex items-center gap-2 rounded-lg bg-fg text-app text-sm font-semibold disabled:opacity-40">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Generate
              </button>
            </form>
          </div>
          </>)}
        </main>
      </div>

      {/* Loading / recording overlays */}
      {(isLoading || isRecording) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app/70 backdrop-blur-sm">
          <div className={`${card} p-8 shadow-2xl flex flex-col items-center gap-3 text-center`}>
            <Loader2 className="w-8 h-8 animate-spin" />
            <h3 className="font-semibold">{isRecording ? `Capturing animation… ${recordingProgress}%` : 'Architecting solution…'}</h3>
            <p className="text-sm text-muted">{isRecording ? 'Recording data flow frames' : 'Analyzing requirements and designing components'}</p>
          </div>
        </div>
      )}

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

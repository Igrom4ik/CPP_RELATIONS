
import React, { useState, useRef, useEffect, useMemo } from 'react';
import GraphVisualization from './components/GraphVisualization';
import ResizableSplit from './components/ResizableSplit';
import { parseProjectFiles } from './services/cppParser';
import { analyzeInteraction, configureAI, sendChatMessage } from './services/geminiService';
import { localAnalyzeInteraction } from './services/localAnalysis';
import { loadGraphData, saveGraphData, clearGraphData } from './services/storage';
import { GraphData, FileNode, InteractionAnalysis, Tab, AISettings, SymbolDefinition, ChatMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

declare const Prism: any;

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = async () => {
    await clearGraphData();
    localStorage.removeItem('cpp_relations_settings');
    localStorage.removeItem('cpp_relations_ai_config');
    // Clear legacy keys if any
    localStorage.removeItem('cpp_relations_data');
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0b0c0e] text-white p-4 text-center font-sans">
            <div className="bg-[#1f1f1f] p-8 rounded-lg border border-red-900/50 shadow-2xl max-w-md">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h1 className="text-xl font-bold text-gray-100 mb-2">Application Error</h1>
                <p className="text-gray-400 text-sm mb-6">Something went wrong. This might be due to corrupted data or a browser compatibility issue.</p>
                <div className="bg-[#111] p-3 rounded text-left mb-6 overflow-auto max-h-32">
                    <code className="text-xs text-red-400 font-mono">{this.state.error?.message}</code>
                </div>
                <button onClick={this.handleReset} className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium transition-colors">
                    Reset Project Data & Reload
                </button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface TreeNode {
  name: string;
  path: string; 
  type: 'folder' | 'file';
  node?: FileNode; 
  children?: { [key: string]: TreeNode };
}

const buildFileTree = (nodes: FileNode[]): TreeNode => {
  const root: TreeNode = { name: 'root', path: '', type: 'folder', children: {} };
  nodes.forEach(node => {
    const safePath = node.id.replace(/\\/g, '/');
    const parts = safePath.split('/');
    let current = root;
    parts.forEach((part, index) => {
      if (!current.children) current.children = {};
      if (index === parts.length - 1) {
        current.children[part] = { name: part, path: safePath, type: 'file', node: node };
      } else {
        if (!current.children[part]) current.children[part] = { name: part, path: parts.slice(0, index + 1).join('/'), type: 'folder', children: {} };
        current = current.children[part];
      }
    });
  });
  return root;
};

// --- COMPONENTS ---
const CodeViewer: React.FC<{ code: string; fileName: string; highlightLines?: { start: number, color: string } }> = React.memo(({ code, fileName, highlightLines }) => {
    const codeRef = useRef<HTMLElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const ext = fileName.split('.').pop()?.toLowerCase();
    const lang = (ext === 'h' || ext === 'hpp') ? 'cpp' : (ext || 'cpp');

    useEffect(() => { if (codeRef.current && typeof Prism !== 'undefined') Prism.highlightElement(codeRef.current); }, [code]);
    useEffect(() => {
        if (highlightLines && containerRef.current) {
             const scrollEl = containerRef.current;
             const topPos = (highlightLines.start - 1) * 20 + 16;
             scrollEl.scrollTo({ top: topPos - (scrollEl.clientHeight / 2), behavior: 'smooth' });
        }
    }, [highlightLines]);

    const lines = useMemo(() => code.split('\n'), [code]);

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] font-mono text-sm relative group">
            <div className="flex-1 overflow-auto custom-scrollbar relative" ref={containerRef}>
                <div className="flex min-h-full">
                    <div className="bg-[#252526] border-r border-[#3e3e42] text-right pr-3 pl-2 py-4 select-none text-[#858585] w-12 flex-shrink-0 z-10 text-[13px] leading-[20px]">
                        {lines.map((_, i) => <div key={i} className="h-[20px]">{i + 1}</div>)}
                    </div>
                    <div className="flex-1 bg-[#1e1e1e] relative">
                         {highlightLines && (
                            <div className="absolute w-full pointer-events-none z-0"
                                style={{ top: `${(highlightLines.start - 1) * 20 + 16}px`, height: '20px', backgroundColor: highlightLines.color === 'blue' ? 'rgba(38, 79, 120, 0.5)' : 'rgba(78, 60, 13, 0.5)', borderLeft: `2px solid ${highlightLines.color === 'blue' ? '#3b82f6' : '#f59e0b'}`, width: '100%' }}
                            />
                         )}
                         <pre className="!m-0 !p-4 !bg-transparent z-10 relative !overflow-visible">
                            <code ref={codeRef} className={`language-${lang}`}>{code}</code>
                         </pre>
                    </div>
                </div>
            </div>
        </div>
    );
});

const FileTreeItem: React.FC<{ node: TreeNode; depth: number; onFileClick: (node: FileNode) => void; selectedPath: string | null }> = ({ node, depth, onFileClick, selectedPath }) => {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const handleToggle = (e: React.MouseEvent) => { e.stopPropagation(); setIsOpen(!isOpen); };
  const handleFileClick = (e: React.MouseEvent) => { e.stopPropagation(); if (node.node) onFileClick(node.node); };
  const isSelected = node.type === 'file' && node.path === selectedPath;

  if (node.type === 'file') {
      let colorClass = 'bg-blue-500';
      if (node.node?.type === 'header') colorClass = 'bg-orange-500';
      if (node.node?.type === 'cmake') colorClass = 'bg-green-500';
      if (node.node?.type === 'json') colorClass = 'bg-yellow-500';

    return (
      <div onClick={handleFileClick} className={`flex items-center gap-2 py-1.5 cursor-pointer transition-colors text-sm hover:bg-white/5 border-l-2 ${isSelected ? 'bg-blue-900/20 text-blue-300 border-blue-500' : 'text-gray-400 border-transparent hover:border-gray-600'}`} style={{ paddingLeft: `${depth * 16 + 12}px` }}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colorClass}`}></span>
        <span className="truncate">{node.name}</span>
      </div>
    );
  }
  return (
    <div>
      <div onClick={handleToggle} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white/5 text-gray-300 text-sm font-medium select-none" style={{ paddingLeft: `${depth * 16 + 12}px` }}>
        <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</div>
        <svg className="w-4 h-4 text-yellow-600/80" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
        <span className="truncate">{node.name}</span>
      </div>
      <div className={`${isOpen ? 'block' : 'hidden'}`}>
          {node.children && Object.values(node.children).sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name))).map(child => <FileTreeItem key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} selectedPath={selectedPath} />)}
      </div>
    </div>
  );
};

const AIChatPanel: React.FC<{ nodes: FileNode[]; onFileClick: (node: FileNode) => void; onClose: () => void }> = ({ nodes, onFileClick, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isSending) return;
        const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: input, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsSending(true);

        // --- CONTEXT GENERATION ---
        let context = "Project File Structure:\n";
        nodes.forEach(n => context += `- ${n.id} [${n.type}]\n`);
        
        const mentionedFiles = nodes.filter(n => input.includes(n.name) || input.includes(n.id));
        if (mentionedFiles.length > 0) {
            context += "\nContent of Referenced Files:\n";
            mentionedFiles.forEach(f => {
                context += `\n--- START OF FILE: ${f.id} ---\n${f.content}\n--- END OF FILE ---\n`;
            });
        }

        const aiResponse = await sendChatMessage([...messages, userMsg], context);
        const aiMsg: ChatMessage = { id: uuidv4(), role: 'assistant', content: aiResponse, timestamp: Date.now() };
        setMessages(prev => [...prev, aiMsg]);
        setIsSending(false);
    };

    const renderMessageContent = (content: string) => {
        if (!nodes || nodes.length === 0) return content;
        const validNodes = nodes.filter(n => n.name.length > 2);
        if (validNodes.length === 0) return content;
        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b(${validNodes.map(n => escapeRegExp(n.name)).join('|')})\\b`, 'g');
        const parts = content.split(pattern);

        return parts.map((part, i) => {
            const node = validNodes.find(n => n.name === part);
            if (node) {
                return (
                    <button 
                        key={i} 
                        onClick={() => onFileClick(node)} 
                        className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-medium inline-flex items-center gap-0.5 align-baseline bg-blue-500/10 px-1 rounded mx-0.5"
                        title={`Open ${node.id}`}
                    >
                        <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {part}
                    </button>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#111214] border-l border-[#333]">
            <div className="p-3 bg-[#1f1f1f] text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#333] flex justify-between items-center">
                <span>AI Assistant</span>
                <button onClick={onClose} className="hover:text-white text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && <p className="text-gray-600 text-xs text-center mt-4">Ask anything about your C++ project.<br/>Mention a filename to let AI read it.</p>}
                {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] rounded-lg p-2.5 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#2d2d2d] text-gray-200'}`}>
                            {renderMessageContent(m.content)}
                        </div>
                    </div>
                ))}
                {isSending && <div className="text-gray-500 text-xs animate-pulse">AI is typing...</div>}
            </div>
            <div className="p-2 border-t border-[#333] flex gap-2">
                <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 bg-[#1f1f1f] border border-[#333] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500" placeholder="Ask AI..." />
                <button onClick={handleSend} disabled={isSending} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50">Send</button>
            </div>
        </div>
    );
};

const AIChatPanelMemo = React.memo(AIChatPanel);

const AISettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (s: AISettings) => void }> = ({ isOpen, onClose, onSave }) => {
    const [provider, setProvider] = useState<'gemini' | 'custom'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('http://localhost:1234/v1');
    const [modelName, setModelName] = useState('local-model');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#1f1f1f] border border-gray-700 rounded-lg p-6 w-[450px] shadow-2xl">
                <h3 className="text-lg font-semibold text-white mb-4">AI Configuration</h3>
                <div className="flex gap-4 mb-4 border-b border-gray-700 pb-2">
                    <button onClick={() => setProvider('gemini')} className={`pb-1 text-sm ${provider === 'gemini' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>Google Gemini</button>
                    <button onClick={() => setProvider('custom')} className={`pb-1 text-sm ${provider === 'custom' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>Custom / LM Studio</button>
                </div>
                <div className="space-y-4">
                    {provider === 'gemini' ? (
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Gemini API Key</label>
                            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none" placeholder="Use process.env or enter here" />
                        </div>
                    ) : (
                        <>
                            <div><label className="block text-xs text-gray-500 mb-1">Base URL</label><input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">Model Name</label><input type="text" value={modelName} onChange={e => setModelName(e.target.value)} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none" /></div>
                            <div><label className="block text-xs text-gray-500 mb-1">API Key</label><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-[#111] border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none" /></div>
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={() => { onSave({ provider, apiKey: apiKey || (process.env.API_KEY || ''), baseUrl, modelName }); onClose(); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded">Save Configuration</button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'main-graph', title: 'Graph Overview', type: 'graph', active: true }]);
  const [activeTabId, setActiveTabId] = useState<string>('main-graph');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Default useAI to true so link analysis works if key is present, since we removed the toggle.
  const [useAI, setUseAI] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Visual Preferences
  const [linkStyle, setLinkStyle] = useState<'bezier' | 'orthogonal'>('bezier');
  const [animateLinks, setAnimateLinks] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence Load
  useEffect(() => {
    const load = async () => {
        try {
            const savedData = await loadGraphData();
            if (savedData && savedData.nodes.length > 0) setData(savedData);
        } catch (e) { console.error("Data load error:", e); }
    };
    load();
    try {
        const savedSettings = localStorage.getItem('cpp_relations_settings');
        if (savedSettings) {
            const s = JSON.parse(savedSettings);
            if (s.linkStyle) setLinkStyle(s.linkStyle);
            if (s.animateLinks !== undefined) setAnimateLinks(s.animateLinks);
            if (s.useAI !== undefined) setUseAI(s.useAI);
        }
    } catch (e) { console.error(e); }
    try {
        const savedAISettings = localStorage.getItem('cpp_relations_ai_config');
        if (savedAISettings) configureAI(JSON.parse(savedAISettings));
    } catch (e) { console.error(e); }
  }, []);

  // Persistence Save
  useEffect(() => {
     if (data.nodes.length > 0) saveGraphData(data).catch(console.error);
  }, [data]);
  
  useEffect(() => {
     localStorage.setItem('cpp_relations_settings', JSON.stringify({ linkStyle, animateLinks, useAI }));
  }, [linkStyle, animateLinks, useAI]);
  
  const fileTree = useMemo(() => buildFileTree(data.nodes), [data.nodes]);

  const activeGraphData = useMemo(() => {
    if (!selectedNodeId) return { nodes: [], links: [] };
    const relevantNodeIds = new Set<string>([selectedNodeId]);
    data.links.forEach(link => {
      if (link.source === selectedNodeId) relevantNodeIds.add(link.target);
      if (link.target === selectedNodeId) relevantNodeIds.add(link.source);
    });
    return {
      nodes: data.nodes.filter(n => relevantNodeIds.has(n.id)),
      links: data.links.filter(l => relevantNodeIds.has(l.source) && relevantNodeIds.has(l.target))
    };
  }, [data, selectedNodeId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setLoading(true);
      try {
        const graphData = await parseProjectFiles(event.target.files);
        setData(graphData);
        setSelectedNodeId(null);
      } catch (err) { console.error(err); alert("Error reading files"); } finally { setLoading(false); }
    }
  };

  const addTab = (tab: Omit<Tab, 'active'>) => {
      const newTabs = tabs.map(t => ({...t, active: false}));
      const existing = newTabs.find(t => t.id === tab.id);
      if (existing) {
          existing.active = true;
          if (tab.data) existing.data = { ...existing.data, ...tab.data };
          setTabs(newTabs);
          setActiveTabId(existing.id);
      } else {
          const newTab = { ...tab, active: true };
          setTabs([...newTabs, newTab]);
          setActiveTabId(newTab.id);
      }
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (tabs.length === 1) return; 
      const newTabs = tabs.filter(t => t.id !== id);
      if (id === activeTabId) {
          newTabs[newTabs.length - 1].active = true;
          setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      setTabs(newTabs);
  };

  const switchTab = (id: string) => {
      setTabs(tabs.map(t => ({ ...t, active: t.id === id })));
      setActiveTabId(id);
  };

  const handleFileSelect = (node: FileNode) => {
    setSelectedNodeId(node.id);
    const graphTab = tabs.find(t => t.type === 'graph');
    if (graphTab) switchTab(graphTab.id); else addTab({ id: 'main-graph', title: 'Graph', type: 'graph' });
  };

  const handleNodeDoubleClick = (node: FileNode) => {
      addTab({ id: `file-${node.id}`, title: node.name, type: 'code', data: { content: node.content, path: node.id } });
  };

  const handleSymbolClick = (node: FileNode, symbol: SymbolDefinition) => {
      addTab({ id: `file-${node.id}`, title: node.name, type: 'code', data: { content: node.content, path: node.id, highlight: { start: symbol.line, color: 'blue' } } });
  };

  const handleLinkClick = async (source: FileNode, target: FileNode) => {
    setLoading(true);
    try {
        let result: InteractionAnalysis;
        if (useAI) {
             try { result = await analyzeInteraction(source.name, source.content, target.name, target.content); } 
             catch (e) { console.warn("AI failed, falling back to local"); result = localAnalyzeInteraction(source.name, source.content, target.name, target.content); }
        } else {
            result = localAnalyzeInteraction(source.name, source.content, target.name, target.content);
        }
        addTab({ id: `link-${source.id}-${target.id}`, title: `${source.name} -> ${target.name}`, type: 'analysis', data: result });
    } catch (error) { console.error(error); alert("Analysis failed"); } finally { setLoading(false); }
  };

  const openInCLion = (path: string, line?: number) => {
      const root = localStorage.getItem("clion_root") || "/Users/username/Project";
      const fullPath = `${root.replace(/\/$/, '')}/${path}`;
      window.location.assign(`idea://open?file=${fullPath}${line ? `&line=${line}` : ''}`);
  };

  const handleSaveAIConfig = (s: AISettings) => {
      configureAI(s);
      localStorage.setItem('cpp_relations_ai_config', JSON.stringify(s));
  };

  // --- RENDER HELPERS ---
  const renderMainContent = () => (
      <div className="flex flex-col h-full bg-[#0b0c0e] relative w-full">
          <div className="h-10 bg-[#111214] flex items-end px-2 gap-1 border-b border-[#1f2125] pt-1 flex-shrink-0 pr-12">
              {tabs.map(tab => (
                  <div key={tab.id} onClick={() => switchTab(tab.id)} className={`group relative flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-t-2 transition-all select-none min-w-[120px] max-w-[200px] rounded-t-sm ${tab.active ? 'bg-[#1e1e1e] text-white border-blue-500' : 'bg-transparent text-gray-500 border-transparent hover:bg-[#1e1e1e]/50 hover:text-gray-300'}`}>
                      <span className="truncate flex-1">{tab.title}</span>
                      <button onClick={(e) => closeTab(e, tab.id)} className={`opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-white/10 p-0.5 rounded transition-opacity ${tabs.length === 1 ? 'hidden' : ''}`}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
              ))}
          </div>
          <div className="absolute top-2 right-2 z-30">
                <button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-1.5 rounded transition-colors ${isChatOpen ? 'text-purple-400 bg-purple-900/30' : 'text-gray-500 hover:text-white'}`} title="Toggle AI Chat">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </button>
          </div>
          <div className="flex-1 relative overflow-hidden h-full">
               {tabs.find(t => t.active)?.type === 'graph' && (
                    <div className="relative w-full h-full">
                        <div className="absolute top-4 right-4 z-20 flex gap-2 bg-[#1f2125] p-1.5 rounded-lg border border-[#333] shadow-lg">
                            <button onClick={() => setLinkStyle('bezier')} className={`p-1.5 rounded transition-colors ${linkStyle === 'bezier' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v2a2 2 0 01-2 2h-4a2 2 0 00-2 2v10" /></svg></button>
                            <button onClick={() => setLinkStyle('orthogonal')} className={`p-1.5 rounded transition-colors ${linkStyle === 'orthogonal' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16h6v4h4v-4h6M12 4v8" /></svg></button>
                            <div className="w-px bg-[#333] mx-1"></div>
                            <button onClick={() => setAnimateLinks(!animateLinks)} className={`p-1.5 rounded transition-colors ${animateLinks ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
                        </div>
                        {selectedNodeId && <button onClick={() => setSelectedNodeId(null)} className="absolute top-4 left-4 z-10 bg-[#2d2d2d] border border-gray-600 text-white px-3 py-1.5 rounded-md shadow-lg text-xs hover:bg-[#3d3d3d] flex items-center gap-2"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> Clear Selection</button>}
                        {selectedNodeId ? <GraphVisualization data={activeGraphData} onNodeClick={handleNodeDoubleClick} onLinkClick={handleLinkClick} onSymbolClick={handleSymbolClick} searchTerm={searchTerm} linkStyle={linkStyle} animateLinks={animateLinks} /> : <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4"><div className="w-16 h-16 rounded-xl bg-[#1f2125] flex items-center justify-center border border-[#333]"><svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg></div><div className="text-center"><h3 className="text-lg font-medium text-gray-400">No File Selected</h3><p className="text-xs text-gray-600 mt-1 max-w-[250px]">Select a file from the sidebar.</p></div></div>}
                    </div>
               )}
               {tabs.find(t => t.active)?.type === 'code' && (
                  <div className="flex flex-col h-full">
                      <div className="bg-[#252526] p-2 border-b border-black flex justify-between items-center flex-shrink-0">
                          <span className="text-sm text-gray-400 font-mono">{tabs.find(t => t.active)?.data.path}</span>
                          <div className="flex gap-2"><button onClick={() => { const root = prompt("Enter local project root path for CLion:", localStorage.getItem("clion_root") || ""); if (root) localStorage.setItem("clion_root", root); }} className="text-xs text-gray-500 hover:text-white underline">Set Root</button><button onClick={() => openInCLion(tabs.find(t => t.active)?.data.path, tabs.find(t => t.active)?.data.highlight?.start)} className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] px-3 py-1 rounded text-xs text-white transition-colors border border-gray-700">Open in CLion</button></div>
                      </div>
                      <CodeViewer code={tabs.find(t => t.active)?.data.content || ''} fileName={tabs.find(t => t.active)?.title || ''} highlightLines={tabs.find(t => t.active)?.data.highlight} />
                  </div>
               )}
               {tabs.find(t => t.active)?.type === 'analysis' && (
                   <div className="flex flex-col h-full bg-[#1e1e1e]">
                       <div className="bg-[#252526] p-4 border-b border-black shadow-md z-10 flex-shrink-0">
                           <div className="flex items-center gap-2 mb-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tabs.find(t => t.active)?.data.isAiGenerated ? 'bg-purple-900 text-purple-200' : 'bg-green-900 text-green-200'}`}>{tabs.find(t => t.active)?.data.isAiGenerated ? 'AI Analysis' : 'Local Parser'}</span><h2 className="text-white font-medium">{tabs.find(t => t.active)?.data.summary}</h2></div>
                       </div>
                       
                       {/* SPLIT VIEW FOR ANALYSIS */}
                       <div className="flex-1 min-h-0">
                           <ResizableSplit direction="horizontal" initialSize="50%" minSize={100} gutterSize={2}>
                               {/* Source Panel */}
                               <div className="flex flex-col h-full min-w-0">
                                   <div className="bg-[#1e1e1e] p-2 text-blue-400 text-xs font-bold border-b border-[#333] flex justify-between flex-shrink-0"><span>SOURCE</span><button onClick={() => openInCLion(tabs.find(t => t.active)?.data.callerSnippet.file, tabs.find(t => t.active)?.data.callerSnippet.startLine)} className="hover:underline">Open in IDE</button></div>
                                   <div className="flex-1 min-h-0 overflow-hidden relative"><CodeViewer code={tabs.find(t => t.active)?.data.callerSnippet.code} fileName="cpp" highlightLines={{ start: 1, color: 'blue' }} /><div className="absolute bottom-0 left-0 right-0 bg-[#252526]/90 backdrop-blur p-2 text-xs text-gray-400 border-t border-black">{tabs.find(t => t.active)?.data.callerSnippet.explanation}</div></div>
                               </div>
                               
                               {/* Target Panel */}
                               <div className="flex flex-col h-full min-w-0">
                                   <div className="bg-[#1e1e1e] p-2 text-orange-400 text-xs font-bold border-b border-[#333] flex justify-between flex-shrink-0"><span>TARGET</span><button onClick={() => openInCLion(tabs.find(t => t.active)?.data.calleeSnippet.file, tabs.find(t => t.active)?.data.calleeSnippet.startLine)} className="hover:underline">Open in IDE</button></div>
                                   <div className="flex-1 min-h-0 overflow-hidden relative"><CodeViewer code={tabs.find(t => t.active)?.data.calleeSnippet.code} fileName="cpp" highlightLines={{ start: 1, color: 'orange' }} /><div className="absolute bottom-0 left-0 right-0 bg-[#252526]/90 backdrop-blur p-2 text-xs text-gray-400 border-t border-black">{tabs.find(t => t.active)?.data.calleeSnippet.explanation}</div></div>
                               </div>
                           </ResizableSplit>
                       </div>
                   </div>
               )}
               {loading && (<div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"><div className="bg-[#1e1e1e] border border-gray-700 p-8 rounded-lg shadow-2xl flex flex-col items-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div><span className="text-gray-200 text-sm font-medium tracking-wide">Processing...</span></div></div>)}
          </div>
      </div>
  );

  return (
    <div className="flex h-screen w-screen bg-[#0b0c0e] text-gray-300 font-sans overflow-hidden">
      <AISettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} onSave={handleSaveAIConfig} />
      
      {/* OUTER SPLIT: Sidebar vs (Main + Chat) */}
      <ResizableSplit direction="horizontal" initialSize={300} minSize={200} maxSize={500}>
          {/* LEFT SIDEBAR */}
          <div className="flex flex-col h-full bg-[#111214]/95 backdrop-blur-md">
              <div className="h-14 flex items-center px-4 border-b border-[#1f2125] justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                     <img src="https://placehold.co/100x30/transparent/white?text=CPP+LOGO" alt="CPP Relations" className="h-8 object-contain" />
                  </div>
                  <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white" title="Settings">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-4 border-b border-[#1f2125] space-y-3 flex-shrink-0">
                     <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded shadow transition-all flex justify-center items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Load Source Folder
                     </button>
                     <input type="file" ref={fileInputRef} className="hidden" {...({ webkitdirectory: "", directory: "", multiple: "" } as any)} onChange={handleFileUpload} />
                     <div className="relative">
                        <input type="text" placeholder="Search file..." className="w-full bg-[#1f1f1f] text-gray-300 text-xs px-2 py-1.5 rounded border border-[#333] focus:border-blue-500 outline-none pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <svg className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                      {Object.values(fileTree.children || {}).sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name))).map(child => <FileTreeItem key={child.path} node={child} depth={0} onFileClick={handleFileSelect} selectedPath={selectedNodeId} />)}
                  </div>
              </div>
          </div>

          {/* RIGHT AREA: Main Content OR (Main + Chat) */}
          {isChatOpen ? (
              <ResizableSplit direction="horizontal" initialSize="70%" minSize={400} gutterSize={4}>
                  {renderMainContent()}
                  <AIChatPanelMemo nodes={data.nodes} onFileClick={handleNodeDoubleClick} onClose={() => setIsChatOpen(false)} />
              </ResizableSplit>
          ) : (
              renderMainContent()
          )}
      </ResizableSplit>
    </div>
  );
};

const AppWithBoundary = () => (
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);

export default AppWithBoundary;

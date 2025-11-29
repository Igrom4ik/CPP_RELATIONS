import React, { useState, useMemo } from 'react';
import GraphVisualization from './components/GraphVisualization';
import ResizableSplit from './components/ResizableSplit';
import { Sidebar } from './components/Sidebar';
import { AIChatPanelMemo } from './components/AIChatPanel';
import { SettingsModal } from './components/SettingsModal';
import { CodeViewer } from './components/CodeViewer';
import { Button } from './components/ui/Button';
import { Icons } from './components/ui/Icons';
import { useProject } from './hooks/useProject';
import { AISettings } from './types';
import { configureAI } from './services/geminiService';

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error("Uncaught error:", error, errorInfo); }
  handleReset = () => { localStorage.clear(); window.location.reload(); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0b0c0e] text-white p-4 text-center">
            <div className="bg-[#1f1f1f] p-8 rounded-xl border border-red-900/50 shadow-2xl max-w-md">
                <h1 className="text-xl font-bold text-gray-100 mb-2">Critical Error</h1>
                <code className="block bg-black/30 p-2 rounded text-red-400 text-xs mb-4 font-mono">{this.state.error?.message}</code>
                <Button variant="danger" onClick={this.handleReset} className="w-full">Reset & Reload</Button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const { 
    data, loading, tabs, activeTabId, selectedNodeId, isChatOpen, setIsChatOpen, useAI, setUseAI,
    handleLoadFiles, closeTab, switchTab, onNodeDoubleClick, onSymbolClick, onLinkClick, onFileSelect, setSelectedNodeId 
  } = useProject();

  const [showSettings, setShowSettings] = useState(false);
  const [linkStyle, setLinkStyle] = useState<'bezier' | 'orthogonal'>('bezier');
  const [animateLinks, setAnimateLinks] = useState(false);

  // Active Graph Data (Filtered by Selection)
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

  const handleSaveAIConfig = (s: AISettings) => {
      configureAI(s);
      localStorage.setItem('cpp_relations_ai_config', JSON.stringify(s));
  };

  const openInCLion = (path: string, line?: number) => {
      const root = localStorage.getItem("clion_root") || "/Users/username/Project";
      const fullPath = `${root.replace(/\/$/, '')}/${path}`;
      window.location.assign(`idea://open?file=${fullPath}${line ? `&line=${line}` : ''}`);
  };

  const renderTabContent = (tab: any) => {
      if (tab.type === 'graph') {
          return (
            <div className="relative w-full h-full">
                {/* Floating Graph Controls */}
                <div className="absolute top-4 right-4 z-20 flex gap-1 bg-[#1f2125]/90 backdrop-blur-sm p-1.5 rounded-lg border border-[#333] shadow-xl">
                    <button onClick={() => setLinkStyle('bezier')} className={`p-1.5 rounded transition-all ${linkStyle === 'bezier' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`} title="Bezier Curves"><Icons.Graph className="w-4 h-4" /></button>
                    <button onClick={() => setLinkStyle('orthogonal')} className={`p-1.5 rounded transition-all ${linkStyle === 'orthogonal' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`} title="Circuit Style"><Icons.Code className="w-4 h-4" /></button>
                    <div className="w-px bg-[#444] mx-1 my-0.5"></div>
                    <button onClick={() => setAnimateLinks(!animateLinks)} className={`p-1.5 rounded transition-all ${animateLinks ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`} title="Toggle Flow Animation"><Icons.Play className="w-4 h-4" /></button>
                </div>
                {selectedNodeId && (
                    <div className="absolute top-4 left-4 z-20">
                        <Button variant="secondary" size="sm" onClick={() => setSelectedNodeId(null)} className="shadow-xl border-gray-600">
                            <Icons.Close className="w-3 h-3 mr-2" /> Clear Focus
                        </Button>
                    </div>
                )}
                {selectedNodeId ? (
                    <GraphVisualization data={activeGraphData} onNodeClick={onNodeDoubleClick} onLinkClick={onLinkClick} onSymbolClick={onSymbolClick} searchTerm="" linkStyle={linkStyle} animateLinks={animateLinks} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 select-none">
                        <div className="w-20 h-20 rounded-2xl bg-[#1a1b1e] flex items-center justify-center border border-[#2c2e33] shadow-inner">
                            <Icons.File className="w-10 h-10 text-gray-700" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-medium text-gray-400">Ready to Explore</h3>
                            <p className="text-xs text-gray-600 mt-1">Select a file from the sidebar to visualize dependencies.</p>
                        </div>
                    </div>
                )}
            </div>
          );
      }
      
      if (tab.type === 'code') {
          return (
              <div className="flex flex-col h-full bg-[#1e1e1e]">
                  <div className="bg-[#252526] h-10 px-4 border-b border-[#1f2125] flex justify-between items-center flex-shrink-0">
                      <span className="text-xs text-gray-400 font-mono flex items-center gap-2"><Icons.File className="w-3 h-3" /> {tab.data.path}</span>
                      <div className="flex gap-2">
                          <button onClick={() => { const root = prompt("Enter local project root for CLion:", localStorage.getItem("clion_root") || ""); if (root) localStorage.setItem("clion_root", root); }} className="text-[10px] text-gray-500 hover:text-white underline">Set Root</button>
                          <Button variant="secondary" size="sm" className="h-6 text-xs px-2" onClick={() => openInCLion(tab.data.path, tab.data.highlight?.start)}>Open in IDE</Button>
                      </div>
                  </div>
                  <CodeViewer code={tab.data.content || ''} fileName={tab.title || ''} highlightLines={tab.data.highlight} />
              </div>
          );
      }

      if (tab.type === 'analysis') {
          return (
               <div className="flex flex-col h-full bg-[#1e1e1e]">
                   <div className="bg-[#252526] px-4 py-3 border-b border-[#1f2125] shadow-sm z-10 flex-shrink-0">
                       <div className="flex items-center gap-3">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tab.data.isAiGenerated ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`}>
                               {tab.data.isAiGenerated ? 'AI Analysis' : 'Local Parser'}
                           </span>
                           <h2 className="text-gray-200 font-medium text-sm">{tab.data.summary}</h2>
                       </div>
                   </div>
                   <div className="flex-1 min-h-0">
                       <ResizableSplit direction="horizontal" initialSize="50%" minSize={100} gutterSize={4}>
                           <div className="flex flex-col h-full min-w-0 border-r border-[#1f2125]">
                               <div className="bg-[#1e1e1e] p-2 text-blue-400 text-xs font-bold border-b border-[#333] flex justify-between"><span>SOURCE</span></div>
                               <div className="flex-1 min-h-0 overflow-hidden relative">
                                   <CodeViewer code={tab.data.callerSnippet.code} fileName="cpp" highlightLines={{ start: 1, color: 'blue' }} />
                                   <div className="absolute bottom-0 left-0 right-0 bg-[#252526]/95 backdrop-blur p-3 text-xs text-gray-400 border-t border-[#333]">{tab.data.callerSnippet.explanation}</div>
                               </div>
                           </div>
                           <div className="flex flex-col h-full min-w-0">
                               <div className="bg-[#1e1e1e] p-2 text-orange-400 text-xs font-bold border-b border-[#333] flex justify-between"><span>TARGET</span></div>
                               <div className="flex-1 min-h-0 overflow-hidden relative">
                                   <CodeViewer code={tab.data.calleeSnippet.code} fileName="cpp" highlightLines={{ start: 1, color: 'orange' }} />
                                   <div className="absolute bottom-0 left-0 right-0 bg-[#252526]/95 backdrop-blur p-3 text-xs text-gray-400 border-t border-[#333]">{tab.data.calleeSnippet.explanation}</div>
                               </div>
                           </div>
                       </ResizableSplit>
                   </div>
               </div>
          );
      }
      return null;
  };

  return (
    <div className="flex h-screen w-screen bg-[#0b0c0e] text-gray-300 font-sans overflow-hidden">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} onSave={handleSaveAIConfig} />
      
      <ResizableSplit direction="horizontal" initialSize={280} minSize={220} maxSize={450} gutterSize={2}>
          <Sidebar 
            nodes={data.nodes} 
            selectedNodeId={selectedNodeId} 
            onFileSelect={onFileSelect} 
            onLoadFiles={handleLoadFiles} 
            onShowSettings={() => setShowSettings(true)}
            loading={loading}
          />

          <div className="flex flex-col h-full bg-[#0b0c0e] min-w-0 relative">
              {/* Tab Bar */}
              <div className="h-10 bg-[#111214] flex items-end px-2 gap-1 border-b border-[#1f2125] pt-1 flex-shrink-0 pr-12 select-none">
                  {tabs.map(tab => (
                      <div key={tab.id} onClick={() => switchTab(tab.id)} 
                           className={`group relative flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-t-2 transition-all min-w-[120px] max-w-[200px] rounded-t-md ${tab.active ? 'bg-[#1e1e1e] text-gray-100 border-blue-500 font-medium' : 'bg-transparent text-gray-500 border-transparent hover:bg-[#1e1e1e]/50 hover:text-gray-300'}`}>
                          <span className={`w-2 h-2 rounded-full ${tab.type === 'graph' ? 'bg-purple-500' : (tab.type === 'analysis' ? 'bg-green-500' : 'bg-blue-500')} opacity-70`}></span>
                          <span className="truncate flex-1">{tab.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className={`opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-white/10 p-0.5 rounded transition-opacity ${tabs.length === 1 ? 'hidden' : ''}`}><Icons.Close className="w-3 h-3" /></button>
                      </div>
                  ))}
              </div>
              
              {/* Top Right Chat Toggle */}
              <div className="absolute top-2 right-2 z-40">
                    <button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-1.5 rounded-md transition-colors border ${isChatOpen ? 'text-purple-300 bg-purple-900/40 border-purple-500/50' : 'text-gray-500 border-transparent hover:bg-[#2c2e33] hover:text-gray-300'}`} title="Toggle AI Assistant">
                        <Icons.Chat className="w-5 h-5" />
                    </button>
              </div>

              {/* Main Workspace Area */}
              <div className="flex-1 relative overflow-hidden h-full">
                  {isChatOpen ? (
                      <ResizableSplit direction="horizontal" initialSize="70%" minSize={400} gutterSize={2}>
                          {renderTabContent(tabs.find(t => t.active))}
                          <AIChatPanelMemo nodes={data.nodes} onFileClick={onNodeDoubleClick} onClose={() => setIsChatOpen(false)} />
                      </ResizableSplit>
                  ) : (
                      renderTabContent(tabs.find(t => t.active))
                  )}
                  
                  {loading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
                          <div className="bg-[#1e1e1e] border border-gray-700/50 p-6 rounded-xl shadow-2xl flex flex-col items-center">
                              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                              <span className="text-gray-200 text-sm font-medium tracking-wide">Processing Project...</span>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </ResizableSplit>
    </div>
  );
};

const AppWithBoundary = () => <ErrorBoundary><App /></ErrorBoundary>;
export default AppWithBoundary;
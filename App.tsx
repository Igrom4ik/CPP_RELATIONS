import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import GraphVisualization from './components/GraphVisualization';
import { Sidebar } from './components/Sidebar';
import { AIChatPanelMemo } from './components/AIChatPanel';
import { SettingsModal } from './components/SettingsModal';
import { CodeViewer } from './components/CodeViewer';
import { Button } from './components/ui/Button';
import { Icons } from './components/ui/Icons';
import { MenuBar } from './components/layout/MenuBar';
import { StatusBar } from './components/layout/StatusBar';
import { CommandPalette } from './components/ui/CommandPalette';
import { ContextMenu } from './components/ui/ContextMenu';
import { Tooltip } from './components/ui/Tooltip';
import { LiquidProgressBar } from './components/ui/LiquidProgressBar';
import { useProject } from './hooks/useProject';
import { useContextMenu, ContextMenuItem } from './hooks/useContextMenu';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { AISettings, VisualSettings } from './types';
import { configureAI } from './services/geminiService';
import CleanUniverse from './components/CleanUniverse-SizeBased';

// Простая оболочка вместо полноценного ErrorBoundary (чтобы избежать TS проблем сейчас)
// TODO: вернуть полнофункциональный ErrorBoundary при необходимости
const ErrorBoundary: React.FC = ({ children }) => <>{children}</>;

const App: React.FC = () => {
  // Hook API (включая setGraphData)
  const {
    data,
    loading,
    loadingProgress,
    tabs,
    activeTabId,
    selectedNodeId,
    isChatOpen,
    setIsChatOpen,
    useAI,
    setUseAI,
    handleLoadFiles,
    closeTab,
    switchTab,
    onNodeDoubleClick,
    onSymbolClick,
    onLinkClick,
    onFileSelect,
    setSelectedNodeId,
    setGraphData,
    showClusterLabels,
    setShowClusterLabels,
    clusterLabelSensitivity,
    setClusterLabelSensitivity,
  } = useProject() as any;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [linkStyle, setLinkStyle] = useState<'bezier' | 'orthogonal'>('bezier');
  const [animateLinks, setAnimateLinks] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'error'>('idle');

  const defaultVisual: VisualSettings = {
    showArrowheads: true,
    palette: {
      source: '#3b82f6',
      header: '#f97316',
      cmake: '#22c55e',
      json: '#eab308',
      glsl: '#a855f7',
      other: '#3b82f6',
    },
    flow: { speed: 1, size: 3 },
  };

  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => {
    try {
      const raw = localStorage.getItem('cpp_relations_visual_settings_v1');
      return raw ? (JSON.parse(raw) as VisualSettings) : defaultVisual;
    } catch {
      return defaultVisual;
    }
  });

  const contextMenu = useContextMenu();

  useKeyboardShortcuts([
    { key: 'o', ctrl: true, callback: () => fileInputRef.current?.click(), description: 'Load Project' },
    { key: 'k', ctrl: true, callback: () => setShowCommandPalette(true), description: 'Command Palette' },
    { key: 'b', ctrl: true, callback: () => setSidebarVisible(!sidebarVisible), description: 'Toggle Sidebar' },
    { key: 'j', ctrl: true, callback: () => setIsChatOpen(!isChatOpen), description: 'Toggle Chat' },
    { key: ',', ctrl: true, callback: () => setShowSettings(true), description: 'Settings' },
    { key: 'm', ctrl: true, callback: () => setAnimateLinks(!animateLinks), description: 'Toggle Animation' },
  ]);

  const commandActions = useMemo(
    () => [
      { id: 'load-project', label: 'Load Project', icon: <Icons.FolderOpen className="w-4 h-4" />, category: 'File', shortcut: 'Ctrl+O', onSelect: () => fileInputRef.current?.click() },
      { id: 'export-graph', label: 'Export Graph', icon: <Icons.Download className="w-4 h-4" />, category: 'File', shortcut: 'Ctrl+E', onSelect: () => alert('Export feature coming soon!') },
      { id: 'toggle-sidebar', label: 'Toggle Sidebar', icon: <Icons.FolderOpen className="w-4 h-4" />, category: 'View', shortcut: 'Ctrl+B', onSelect: () => setSidebarVisible(!sidebarVisible) },
      { id: 'toggle-chat', label: 'Toggle AI Chat', icon: <Icons.Chat className="w-4 h-4" />, category: 'View', shortcut: 'Ctrl+J', onSelect: () => setIsChatOpen(!isChatOpen) },
      { id: 'clear-focus', label: 'Clear Graph Focus', icon: <Icons.Close className="w-4 h-4" />, category: 'Graph', onSelect: () => setSelectedNodeId(null) },
      { id: 'bezier-links', label: 'Use Bezier Links', icon: <Icons.Graph className="w-4 h-4" />, category: 'Graph', onSelect: () => setLinkStyle('bezier') },
      { id: 'orthogonal-links', label: 'Use Orthogonal Links', icon: <Icons.Code className="w-4 h-4" />, category: 'Graph', onSelect: () => setLinkStyle('orthogonal') },
      { id: 'toggle-animation', label: 'Toggle Link Animation', icon: <Icons.Play className="w-4 h-4" />, category: 'Graph', shortcut: 'Ctrl+M', onSelect: () => setAnimateLinks(!animateLinks) },
      { id: 'settings', label: 'AI Configuration', icon: <Icons.Settings className="w-4 h-4" />, category: 'Settings', shortcut: 'Ctrl+,', onSelect: () => setShowSettings(true) },
    ],
    [sidebarVisible, isChatOpen, animateLinks]
  );

  const activeGraphData = useMemo(() => {
    if (!selectedNodeId) return { nodes: [], links: [] };
    const relevantNodeIds = new Set<string>([selectedNodeId]);
    data.links.forEach((link: any) => {
      if (link.source === selectedNodeId) relevantNodeIds.add(link.target);
      if (link.target === selectedNodeId) relevantNodeIds.add(link.source);
    });
    return {
      nodes: data.nodes.filter((n: any) => relevantNodeIds.has(n.id)),
      links: data.links.filter((l: any) => relevantNodeIds.has(l.source) && relevantNodeIds.has(l.target)),
    };
  }, [data, selectedNodeId]);

  // 3D backup + helpers
  const graphBackupRef = useRef<any | null>(null);
  const toggle3D = () => {
    if (!is3DMode) {
      try {
        graphBackupRef.current = JSON.parse(JSON.stringify(data));
      } catch {
        graphBackupRef.current = { nodes: [...data.nodes], links: [...data.links] };
      }
      setIs3DMode(true);
      return;
    }
    setIs3DMode(false);
    if (graphBackupRef.current && typeof setGraphData === 'function') {
      try {
        setGraphData(graphBackupRef.current);
      } catch (e) {
        // ignore
      }
    }
    graphBackupRef.current = null;
  };

  const graphFor3D = useMemo(() => {
    const source = selectedNodeId
      ? {
          nodes: data.nodes.filter((n: any) => n && n.id && n.name),
          links: data.links.filter((l: any) => l && l.source && l.target),
        }
      : data;
    try {
      return JSON.parse(JSON.stringify(source || { nodes: [], links: [] }));
    } catch {
      return { nodes: (source.nodes || []).map((n: any) => ({ ...n })), links: (source.links || []).map((l: any) => ({ ...l })) };
    }
  }, [data, selectedNodeId]);

  const handleSaveAIConfig = (s: AISettings) => {
    configureAI(s);
    localStorage.setItem('cpp_relations_ai_config', JSON.stringify(s));
  };

  const handleSaveVisual = (v: VisualSettings) => {
    setVisualSettings(v);
    try {
      localStorage.setItem('cpp_relations_visual_settings_v1', JSON.stringify(v));
    } catch {}
  };

  const openInCLion = (path: string, line?: number) => {
    const root = localStorage.getItem('clion_root') || '/Users/username/Project';
    const fullPath = `${root.replace(/\/$/, '')}/${path}`;
    window.location.assign(`idea://open?file=${fullPath}${line ? `&line=${line}` : ''}`);
  };

  const renderTabContent = (tab: any) => {
    if (tab.type === 'graph') {
      return (
        <div className="relative w-full h-full bg-zinc-950">
          <div className="absolute top-4 right-4 z-20 flex gap-1 bg-zinc-900/90 backdrop-blur-sm p-1.5 rounded-lg border border-zinc-700 shadow-xl">
            <button onClick={() => setLinkStyle('bezier')} className={`p-1.5 rounded transition-all ${linkStyle === 'bezier' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`} title="Bezier Curves">
              <Icons.Graph className="w-4 h-4" />
            </button>
            <button onClick={() => setLinkStyle('orthogonal')} className={`p-1.5 rounded transition-all ${linkStyle === 'orthogonal' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`} title="Circuit Style">
              <Icons.Code className="w-4 h-4" />
            </button>
            <div className="w-px bg-zinc-700 mx-1 my-0.5" />
            <button onClick={() => setAnimateLinks(!animateLinks)} className={`p-1.5 rounded transition-all ${animateLinks ? 'bg-orange-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`} title="Toggle Flow Animation">
              <Icons.Play className="w-4 h-4" />
            </button>
            <button onClick={toggle3D} className={`p-1.5 rounded transition-all ${is3DMode ? 'bg-green-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`} title="Toggle 3D View">
              3D
            </button>
            <button onClick={() => setShowClusterLabels(!showClusterLabels)} className={`p-1.5 rounded transition-all ${showClusterLabels ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`} title="Toggle Cluster Labels">
              CL
            </button>
            <div className="flex items-center gap-2 px-2">
              <input type="range" min="0.2" max="3" step="0.1" value={clusterLabelSensitivity} onChange={(e) => setClusterLabelSensitivity(Number(e.target.value))} className="w-28" title="Cluster label sensitivity" />
              <span className="text-xs text-zinc-300">{clusterLabelSensitivity.toFixed(1)}x</span>
            </div>
          </div>

          {selectedNodeId && (
            <div className="absolute top-4 left-4 z-20">
              <Button variant="secondary" size="sm" onClick={() => setSelectedNodeId(null)} className="shadow-xl border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
                <Icons.Close className="w-3 h-3 mr-2" /> Clear Focus
              </Button>
            </div>
          )}

          {is3DMode ? (
            <CleanUniverse data={graphFor3D || { nodes: [], links: [] }} onNodeClick={onNodeDoubleClick} />
          ) : selectedNodeId ? (
            <GraphVisualization
              data={activeGraphData}
              onNodeClick={onNodeDoubleClick}
              onLinkClick={onLinkClick}
              onSymbolClick={onSymbolClick}
              searchTerm=""
              linkStyle={linkStyle}
              animateLinks={animateLinks}
              showArrowheads={visualSettings.showArrowheads}
              palette={visualSettings.palette}
              flowSpeed={visualSettings.flow.speed}
              flowSize={visualSettings.flow.size}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4 select-none">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                <Icons.File className="w-10 h-10 text-zinc-700" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-zinc-500">Ready to Explore</h3>
                <p className="text-xs text-zinc-600 mt-1">Select a file from the sidebar to visualize dependencies.</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (tab.type === 'code') {
      return (
        <div className="flex flex-col h-full bg-zinc-950">
          <div className="bg-zinc-900 h-10 px-4 border-b border-zinc-800 flex justify-between items-center flex-shrink-0">
            <span className="text-xs text-zinc-400 font-mono flex items-center gap-2">
              <Icons.File className="w-3 h-3" /> {tab.data.path}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const root = prompt('Enter local project root for CLion:', localStorage.getItem('clion_root') || '');
                  if (root) localStorage.setItem('clion_root', root);
                }}
                className="text-[10px] text-zinc-500 hover:text-white underline"
              >
                Set Root
              </button>
              <Button variant="secondary" size="sm" className="h-6 text-xs px-2" onClick={() => openInCLion(tab.data.path, tab.data.highlight?.start)}>
                Open in IDE
              </Button>
            </div>
          </div>
          <CodeViewer code={tab.data.content || ''} fileName={tab.title || ''} highlightLines={tab.data.highlight} />
        </div>
      );
    }

    if (tab.type === 'analysis') {
      return (
        <div className="flex flex-col h-full bg-zinc-950">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 shadow-sm z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tab.data.isAiGenerated ? 'bg-purple-900/30 text-purple-300 border border-purple-500/20' : 'bg-green-900/30 text-green-300 border border-green-500/20'}`}>
                {tab.data.isAiGenerated ? 'AI Analysis' : 'Local Parser'}
              </span>
              <h2 className="text-zinc-200 font-medium text-sm">{tab.data.summary}</h2>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <PanelGroup direction="horizontal">
              <Panel defaultSize={50} minSize={30}>
                <div className="flex flex-col h-full min-w-0">
                  <div className="bg-zinc-950 p-2 text-blue-400 text-xs font-bold border-b border-zinc-800 flex justify-between"><span>SOURCE</span></div>
                  <div className="flex-1 min-h-0 overflow-hidden relative">
                    <CodeViewer code={tab.data.callerSnippet.code} fileName="cpp" highlightLines={{ start: 1, color: 'blue' }} />
                    <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur p-3 text-xs text-zinc-400 border-t border-zinc-800">{tab.data.callerSnippet.explanation}</div>
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-orange-500 transition-colors duration-200 cursor-col-resize" />
              <Panel defaultSize={50} minSize={30}>
                <div className="flex flex-col h-full min-w-0">
                  <div className="bg-zinc-950 p-2 text-orange-400 text-xs font-bold border-b border-zinc-800 flex justify-between"><span>TARGET</span></div>
                  <div className="flex-1 min-h-0 overflow-hidden relative">
                    <CodeViewer code={tab.data.calleeSnippet.code} fileName="cpp" highlightLines={{ start: 1, color: 'orange' }} />
                    <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur p-3 text-xs text-zinc-400 border-t border-zinc-800">{tab.data.calleeSnippet.explanation}</div>
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleTabContextMenu = (e: React.MouseEvent, tab: any) => {
    const items: ContextMenuItem[] = [
      { label: 'Close', icon: <Icons.Close className="w-4 h-4" />, onClick: () => closeTab(tab.id), shortcut: 'Ctrl+W', disabled: tabs.length === 1 },
      { label: 'Close Others', icon: <Icons.Close className="w-4 h-4" />, onClick: () => tabs.forEach((t: any) => t.id !== tab.id && closeTab(t.id)), disabled: tabs.length === 1 },
      { label: 'Close All', icon: <Icons.Close className="w-4 h-4" />, onClick: () => tabs.slice(1).forEach((t: any) => closeTab(t.id)), danger: true, disabled: tabs.length === 1 },
    ];
    contextMenu.open(e, items);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-300 font-sans overflow-hidden">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} onSaveAI={handleSaveAIConfig} onSaveVisual={handleSaveVisual} initialVisual={visualSettings} />
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} commands={commandActions} />
      <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} items={contextMenu.items} onClose={contextMenu.close} />

      <input type="file" ref={fileInputRef} className="hidden" {...({ webkitdirectory: '', directory: '', multiple: '' } as any)} onChange={(e) => e.target.files && handleLoadFiles(e.target.files)} />

      <MenuBar onLoadFiles={() => fileInputRef.current?.click()} onSaveLayout={() => alert('Save layout feature coming soon!')} onExportGraph={() => alert('Export feature coming soon!')} onToggleSidebar={() => setSidebarVisible(!sidebarVisible)} onToggleChat={() => setIsChatOpen(!isChatOpen)} onShowSettings={() => setShowSettings(true)} onChangeLinkStyle={setLinkStyle} onToggleAnimation={() => setAnimateLinks(!animateLinks)} onOpenCommandPalette={() => setShowCommandPalette(true)} />

      <PanelGroup direction="horizontal" className="flex-1">
        <AnimatePresence mode="wait">
          {sidebarVisible && (
            <Panel defaultSize={20} minSize={15} maxSize={35} className="bg-zinc-900 border-r border-zinc-800">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} className="h-full">
                <Sidebar nodes={data.nodes} selectedNodeId={selectedNodeId} onFileSelect={onFileSelect} onLoadFiles={handleLoadFiles} onShowSettings={() => setShowSettings(true)} loading={loading} />
              </motion.div>
            </Panel>
          )}
        </AnimatePresence>

        {sidebarVisible && <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize" />}

        <Panel minSize={30} className="flex flex-col">
          <div className="flex flex-col h-full bg-zinc-950 min-w-0 relative">
            <div className="h-10 bg-zinc-900 flex items-end px-2 gap-1 border-b border-zinc-800 pt-1 flex-shrink-0 pr-12 select-none">
              {tabs.map((tab: any) => (
                <motion.div key={tab.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }} onClick={() => switchTab(tab.id)} onContextMenu={(e) => handleTabContextMenu(e, tab)} className={`group relative flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-t-2 transition-all min-w-[120px] max-w-[200px] rounded-t-md ${tab.active ? 'bg-zinc-800 text-zinc-100 border-blue-500 font-medium shadow-lg' : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-800/50 hover:text-zinc-300'}`}>
                  <span className={`w-2 h-2 rounded-full ${tab.type === 'graph' ? 'bg-purple-500' : tab.type === 'analysis' ? 'bg-green-500' : 'bg-blue-500'} opacity-70`} />
                  <span className="truncate flex-1">{tab.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className={`opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-white/10 p-0.5 rounded transition-opacity ${tabs.length === 1 ? 'hidden' : ''}`}>
                    <Icons.Close className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="absolute top-2 right-2 z-40">
              <Tooltip content="Toggle AI Assistant (Ctrl+J)">
                <button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-1.5 rounded-md transition-all border ${isChatOpen ? 'text-purple-300 bg-purple-900/40 border-purple-500/50 shadow-lg' : 'text-zinc-500 border-transparent hover:bg-zinc-800 hover:text-zinc-300'}`}>
                  <Icons.Chat className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>

            <div className="flex-1 relative overflow-hidden h-full">{isChatOpen ? (
              <PanelGroup direction="horizontal">
                <Panel defaultSize={65} minSize={40}>{renderTabContent(tabs.find((t: any) => t.active))}</Panel>
                <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-purple-500 transition-colors duration-200 cursor-col-resize" />
                <Panel defaultSize={35} minSize={25} maxSize={50}><motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} className="h-full"> <AIChatPanelMemo nodes={data.nodes} onFileClick={onNodeDoubleClick} onClose={() => setIsChatOpen(false)} /> </motion.div></Panel>
              </PanelGroup>
            ) : (
              renderTabContent(tabs.find((t: any) => t.active))
            )}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center">
                  <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }} className="bg-zinc-900/95 border border-zinc-700/50 p-8 rounded-2xl shadow-2xl flex flex-col items-center backdrop-blur-xl">
                    <motion.img src="/content/images/logo.png" alt="Loading" className="w-16 h-16 mb-6 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" animate={{ scale: [1, 1.1, 1], filter: ['drop-shadow(0 0 20px rgba(59,130,246,0.6))', 'drop-shadow(0 0 30px rgba(59,130,246,0.9))', 'drop-shadow(0 0 20px rgba(59,130,246,0.6))'] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                    <LiquidProgressBar progress={loadingProgress} label="Loading Project" color="#3b82f6" />
                  </motion.div>
                </motion.div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>

      <StatusBar fileCount={data.nodes.length} linkCount={data.links.length} selectedFile={selectedNodeId || undefined} aiStatus={aiStatus} aiProvider={useAI ? 'Gemini' : 'Disabled'} />
    </div>
  );
};

const AppWithBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
export default AppWithBoundary;

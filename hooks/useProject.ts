import { useState, useEffect } from 'react';
import { GraphData, FileNode, Tab, InteractionAnalysis, SymbolDefinition } from '../types';
import { loadGraphData, saveGraphData } from '../services/storage';
import { parseProjectFiles } from '../services/cppParser';
import { configureAI, analyzeInteraction } from '../services/geminiService';
import { localAnalyzeInteraction } from '../services/localAnalysis';

export const useProject = () => {
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [tabs, setTabs] = useState<Tab[]>([{ id: 'main-graph', title: 'Graph Overview', type: 'graph', active: true }]);
    const [activeTabId, setActiveTabId] = useState<string>('main-graph');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [showClusterLabels, setShowClusterLabels] = useState<boolean>(true);
    const [clusterLabelSensitivity, setClusterLabelSensitivity] = useState<number>(1);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            try {
                const savedData = await loadGraphData();
                if (savedData && savedData.nodes.length > 0) setData(savedData);
                
                const savedSettings = localStorage.getItem('cpp_relations_settings');
                if (savedSettings) {
                    const s = JSON.parse(savedSettings);
                    if (s.useAI !== undefined) setUseAI(s.useAI);
                }
                const savedAISettings = localStorage.getItem('cpp_relations_ai_config');
                if (savedAISettings) configureAI(JSON.parse(savedAISettings));
            } catch (e) { console.error("Load error:", e); }
        };
        load();
    }, []);

    // Save Data
    useEffect(() => {
        if (data.nodes.length > 0) saveGraphData(data).catch(console.error);
    }, [data]);

    // Save Settings
    useEffect(() => {
        localStorage.setItem('cpp_relations_settings', JSON.stringify({ useAI }));
    }, [useAI]);

    const handleLoadFiles = async (files: FileList) => {
        setLoading(true);
        setLoadingProgress(0);

        try {
            // Simulate progress for better UX
            const progressInterval = setInterval(() => {
                setLoadingProgress(prev => {
                    if (prev >= 90) return prev;
                    return prev + Math.random() * 15;
                });
            }, 200);

            const graphData = await parseProjectFiles(files);

            clearInterval(progressInterval);
            setLoadingProgress(100);

            // Show 100% briefly before hiding
            setTimeout(() => {
                setData(graphData);
                setSelectedNodeId(null);
                setLoading(false);
                setLoadingProgress(0);
            }, 500);
        } catch (err) {
            console.error(err);
            alert("Error parsing files.");
            setLoading(false);
            setLoadingProgress(0);
        }
    };

    // Tab Management Logic
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

    const closeTab = (id: string) => {
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

    // Interaction Handlers
    const onNodeDoubleClick = (node: FileNode) => {
        addTab({ id: `file-${node.id}`, title: node.name, type: 'code', data: { content: node.content, path: node.id } });
    };

    const onSymbolClick = (node: FileNode, symbol: SymbolDefinition) => {
        addTab({ id: `file-${node.id}`, title: node.name, type: 'code', data: { content: node.content, path: node.id, highlight: { start: symbol.line, color: 'blue' } } });
    };

    const onLinkClick = async (source: FileNode, target: FileNode) => {
        setLoading(true);
        try {
            let result: InteractionAnalysis;
            if (useAI) {
                try { result = await analyzeInteraction(source.name, source.content, target.name, target.content); } 
                catch (e) { console.warn("AI failed, fallback local"); result = localAnalyzeInteraction(source.name, source.content, target.name, target.content); }
            } else {
                result = localAnalyzeInteraction(source.name, source.content, target.name, target.content);
            }
            addTab({ id: `link-${source.id}-${target.id}`, title: `${source.name} -> ${target.name}`, type: 'analysis', data: result });
        } catch (error) { alert("Analysis failed"); } finally { setLoading(false); }
    };

    const onFileSelect = (node: FileNode) => {
        setSelectedNodeId(node.id);
        const graphTab = tabs.find(t => t.type === 'graph');
        if (graphTab) switchTab(graphTab.id); else addTab({ id: 'main-graph', title: 'Graph', type: 'graph' });
    };

    // Позволяет напрямую установить данные графа (используется при восстановлении после 3D режима)
    const setGraphData = (g: GraphData) => {
        setData(g);
    };

    return {
        data, loading, loadingProgress, tabs, activeTabId, selectedNodeId, isChatOpen, setIsChatOpen, useAI, setUseAI,
        handleLoadFiles, addTab, closeTab, switchTab, onNodeDoubleClick, onSymbolClick, onLinkClick, onFileSelect, setSelectedNodeId,
        setGraphData,
        showClusterLabels, setShowClusterLabels,
        clusterLabelSensitivity, setClusterLabelSensitivity
    };
};
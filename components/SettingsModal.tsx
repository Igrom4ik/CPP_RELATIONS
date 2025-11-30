import React, { useEffect, useState } from 'react';
import { AISettings, VisualSettings } from '../types';
import { Button } from './ui/Button';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAI: (s: AISettings) => void;
    onSaveVisual: (v: VisualSettings) => void;
    initialVisual?: VisualSettings;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaveAI, onSaveVisual, initialVisual }) => {
    const [provider, setProvider] = useState<'gemini' | 'custom'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('http://localhost:1234');
    const [modelName, setModelName] = useState('local-model');
    const [corsProxy, setCorsProxy] = useState('');
    const [preset, setPreset] = useState('local');

    // Visual settings state
    const [showArrowheads, setShowArrowheads] = useState<boolean>(true);
    const [palette, setPalette] = useState<VisualSettings['palette']>({
        source: '#3b82f6',
        header: '#f97316',
        cmake: '#22c55e',
        json: '#eab308',
        glsl: '#a855f7',
        other: '#3b82f6'
    });
    const [flowSpeed, setFlowSpeed] = useState<number>(1);
    const [flowSize, setFlowSize] = useState<number>(3);
    // Galaxy settings (default values align with RealGalacticLayout)
    const [galArms, setGalArms] = useState<number>(3);
    const [galBulge, setGalBulge] = useState<number>(40);
    const [galDisk, setGalDisk] = useState<number>(250);
    const [galRotation, setGalRotation] = useState<number>(0.015);
    const [galPitch, setGalPitch] = useState<number>(12);
    const [galCoreDensity, setGalCoreDensity] = useState<number>(0.8);

    const presets: Record<string, { url: string, model: string }> = {
        'local': { url: 'http://localhost:1234', model: 'local-model' },
        'openai': { url: 'https://api.openai.com', model: 'gpt-4o' },
        'perplexity': { url: 'https://api.perplexity.ai', model: 'llama-3.1-sonar-large-128k-online' },
        'mistral': { url: 'https://api.mistral.ai', model: 'mistral-large-latest' },
        'groq': { url: 'https://api.groq.com/openai', model: 'llama3-70b-8192' },
        'anthropic': { url: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20240620' }
    };

    const handlePresetChange = (key: string) => {
        setPreset(key);
        if (presets[key]) {
            setBaseUrl(presets[key].url);
            setModelName(presets[key].model);
        }
    };

    // Initialize visual settings from props/localStorage
    useEffect(() => {
        if (initialVisual) {
            setShowArrowheads(initialVisual.showArrowheads);
            setPalette(initialVisual.palette);
            setFlowSpeed(initialVisual.flow.speed);
            setFlowSize(initialVisual.flow.size);
        } else {
            try {
                const raw = localStorage.getItem('cpp_relations_visual_settings_v1');
                if (raw) {
                    const v = JSON.parse(raw) as VisualSettings;
                    setShowArrowheads(v.showArrowheads ?? true);
                    setPalette(v.palette || palette);
                    setFlowSpeed(v.flow?.speed ?? 1);
                    setFlowSize(v.flow?.size ?? 3);
                }
            } catch {}
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialVisual, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#161719] border border-[#2c2e33] rounded-xl p-6 w-full max-w-2xl shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6">Settings</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* AI Configuration */}
                  <div className="bg-[#0f1012] border border-[#24262b] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-200">AI Configuration</h4>
                      <div className="flex gap-2 p-1 bg-[#111] rounded-lg border border-[#222]">
                        <button onClick={() => setProvider('gemini')} className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${provider === 'gemini' ? 'bg-[#2c2e33] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Gemini</button>
                        <button onClick={() => setProvider('custom')} className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${provider === 'custom' ? 'bg-[#2c2e33] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Custom</button>
                      </div>
                    </div>

                    <div className="space-y-5">
                        {provider === 'gemini' ? (
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Gemini API Key</label>
                                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-[#0b0c0e] border border-[#333] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-colors" placeholder="Use process.env or enter here" />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Provider Preset</label>
                                    <div className="relative">
                                        <select value={preset} onChange={(e) => handlePresetChange(e.target.value)} className="w-full bg-[#0b0c0e] border border-[#333] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none appearance-none">
                                            <option value="local">Local (LM Studio / Ollama)</option>
                                            <option value="openai">OpenAI</option>
                                            <option value="perplexity">Perplexity</option>
                                            <option value="mistral">Mistral AI</option>
                                            <option value="groq">Groq</option>
                                            <option value="anthropic">Anthropic</option>
                                        </select>
                                        <div className="absolute right-3 top-3 pointer-events-none text-gray-500">▼</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Base URL</label>
                                        <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="w-full bg-[#0b0c0e] border border-[#333] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Model Name</label>
                                        <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} className="w-full bg-[#0b0c0e] border border-[#333] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">CORS Proxy <span className="text-gray-600 font-normal">(Optional)</span></label>
                                    <input type="text" value={corsProxy} onChange={e => setCorsProxy(e.target.value)} className="w-full bg-[#0b0c0e] border border-[#333] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" placeholder="e.g. https://corsproxy.io/?" />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">API Key <span className="text-gray-600 font-normal">(Optional for Local)</span></label>
                                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-[#0b0c0e] border border-[#333] rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none" placeholder="Required for Cloud providers" />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button onClick={() => { onSaveAI({ provider, apiKey: apiKey || (process.env.API_KEY || ''), baseUrl, modelName, corsProxy }); }}>Save AI</Button>
                    </div>
                  </div>

                  {/* Visual Settings */}
                  <div className="bg-[#0f1012] border border-[#24262b] rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-200 mb-3">Visual Settings</h4>

                    {/* 1. Splines: Arrowheads */}
                    <div className="mb-4">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                        <input type="checkbox" className="accent-blue-500" checked={showArrowheads} onChange={(e) => setShowArrowheads(e.target.checked)} />
                        Show arrowheads on links
                      </label>
                    </div>

                    {/* 2. Palette */}
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-400 mb-2">Node Colors</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-gray-300">
                        {([
                          ['source','Source'],
                          ['header','Header'],
                          ['cmake','CMake'],
                          ['json','JSON'],
                          ['glsl','GLSL'],
                          ['other','Other']
                        ] as [keyof VisualSettings['palette'], string][]).map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between gap-2 bg-[#0b0c0e] border border-[#333] rounded-md p-2">
                            <span>{label}</span>
                            <input type="color" value={palette[key]} onChange={(e) => setPalette(prev => ({ ...prev, [key]: e.target.value }))} className="w-8 h-8 p-0 bg-transparent border-0" />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 3. Flow animation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Flow Speed</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={0.25} max={2} step={0.05} value={flowSpeed} onChange={(e) => setFlowSpeed(parseFloat(e.target.value))} className="w-full" />
                          <span className="text-xs text-gray-400 w-10 text-right">{flowSpeed.toFixed(2)}×</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Particle Size</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min={1} max={6} step={0.5} value={flowSize} onChange={(e) => setFlowSize(parseFloat(e.target.value))} className="w-full" />
                          <span className="text-xs text-gray-400 w-10 text-right">{flowSize.toFixed(1)}px</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                      <Button onClick={() => {
                        const v: VisualSettings = { showArrowheads, palette, flow: { speed: Math.max(0.1, Math.min(4, flowSpeed)), size: Math.max(1, Math.min(10, flowSize)) } };
                        try { localStorage.setItem('cpp_relations_visual_settings_v1', JSON.stringify(v)); } catch {}
                        onSaveVisual(v);
                        // apply galaxy settings via global bridge (set by main code)
                        try {
                          const gl = (window as any).galacticLayout;
                          if (gl) {
                            gl.setArms(galArms);
                            gl.setBulgeRadius(galBulge);
                            gl.setDiskRadius(galDisk);
                            gl.setRotationSpeed(galRotation);
                            gl.setSpiralPitch(galPitch);
                            gl.setCoreDensity(galCoreDensity);
                          }
                        } catch {}
                      }}>Save Visual</Button>
                    </div>
                  </div>
                  {/* Galaxy Settings */}
                  <div className="bg-[#0f1012] border border-[#24262b] rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-200 mb-3">Galaxy Settings</h4>
                    <div className="grid grid-cols-1 gap-3 text-xs text-gray-300">
                      <label className="flex items-center justify-between gap-2 bg-[#0b0c0e] border border-[#333] rounded-md p-2">
                        <span>Arms</span>
                        <input type="number" min={1} max={8} value={galArms} onChange={(e) => setGalArms(Number(e.target.value))} className="w-20 bg-transparent text-white" />
                      </label>
                      <label className="flex items-center justify-between gap-2 bg-[#0b0c0e] border border-[#333] rounded-md p-2">
                        <span>Bulge Radius</span>
                        <input type="number" min={1} max={200} value={galBulge} onChange={(e) => setGalBulge(Number(e.target.value))} className="w-20 bg-transparent text-white" />
                      </label>
                      <label className="flex items-center justify-between gap-2 bg-[#0b0c0e] border border-[#333] rounded-md p-2">
                        <span>Disk Radius</span>
                        <input type="number" min={50} max={2000} value={galDisk} onChange={(e) => setGalDisk(Number(e.target.value))} className="w-20 bg-transparent text-white" />
                      </label>
                      <label className="flex items-center justify-between gap-2 bg-[#0b0c0e] border border-[#333] rounded-md p-2">
                        <span>Rotation Speed</span>
                        <input type="number" step={0.001} min={0} max={0.1} value={galRotation} onChange={(e) => setGalRotation(Number(e.target.value))} className="w-20 bg-transparent text-white" />
                      </label>
                      <label className="flex items-center justify-between gap-2 bg-[#0b0c0e] border border-[#333] rounded-md p-2">
                        <span>Spiral Pitch</span>
                        <input type="number" min={0} max={90} value={galPitch} onChange={(e) => setGalPitch(Number(e.target.value))} className="w-20 bg-transparent text-white" />
                      </label>
                      <label className="flex items-center justify-between gap-2 bg-[#0b0c0e] border border-[#333] rounded-md p-2">
                        <span>Core Density</span>
                        <input type="range" min={0} max={1} step={0.01} value={galCoreDensity} onChange={(e) => setGalCoreDensity(Number(e.target.value))} className="w-full" />
                      </label>
                    </div>
                  </div>
                 </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
};


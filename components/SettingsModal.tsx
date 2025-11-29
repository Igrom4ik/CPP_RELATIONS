import React, { useState } from 'react';
import { AISettings } from '../types';
import { Button } from './ui/Button';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (s: AISettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const [provider, setProvider] = useState<'gemini' | 'custom'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('http://localhost:1234');
    const [modelName, setModelName] = useState('local-model');
    const [corsProxy, setCorsProxy] = useState('');
    const [preset, setPreset] = useState('local');

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#161719] border border-[#2c2e33] rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6">AI Configuration</h3>
                
                <div className="flex gap-2 mb-6 p-1 bg-[#111] rounded-lg border border-[#222]">
                    <button onClick={() => setProvider('gemini')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${provider === 'gemini' ? 'bg-[#2c2e33] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Google Gemini</button>
                    <button onClick={() => setProvider('custom')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${provider === 'custom' ? 'bg-[#2c2e33] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Custom / Other</button>
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
                <div className="flex justify-end gap-3 mt-8">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => { onSave({ provider, apiKey: apiKey || (process.env.API_KEY || ''), baseUrl, modelName, corsProxy }); onClose(); }}>Save Configuration</Button>
                </div>
            </div>
        </div>
    );
};
import React, { useState, useEffect, useRef } from 'react';
import { FileNode, ChatMessage } from '../types';
import { sendChatMessage } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import { Icons } from './ui/Icons';

interface AIChatPanelProps {
    nodes: FileNode[];
    onFileClick: (node: FileNode) => void;
    onClose: () => void;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ nodes, onFileClick, onClose }) => {
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

        // Optimized Context Generation
        let context = "Project File Structure (Top 200):\n";
        const maxStructureFiles = 200;
        nodes.slice(0, maxStructureFiles).forEach(n => context += `- ${n.id} [${n.type}]\n`);
        if (nodes.length > maxStructureFiles) context += `... and ${nodes.length - maxStructureFiles} more files.\n`;
        
        const mentionedFiles = nodes.filter(n => input.includes(n.name) || input.includes(n.id));
        if (mentionedFiles.length > 0) {
            context += "\nContent of Referenced Files:\n";
            mentionedFiles.forEach(f => {
                const truncatedContent = f.content.slice(0, 2000);
                context += `\n--- START OF FILE: ${f.id} ---\n${truncatedContent}${f.content.length > 2000 ? '\n...[Content Truncated]...' : ''}\n--- END OF FILE ---\n`;
            });
        }

        const aiResponse = await sendChatMessage([...messages, userMsg], context);
        const aiMsg: ChatMessage = { id: uuidv4(), role: 'assistant', content: aiResponse, timestamp: Date.now() };
        setMessages(prev => [...prev, aiMsg]);
        setIsSending(false);
    };

    const renderMessageContent = (content: string) => {
        let processedContent = content;
        if (nodes && nodes.length > 0) {
            const validNodes = nodes.filter(n => n.name.length > 2);
            if (validNodes.length > 0) {
                const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(`\\b(${validNodes.map(n => escapeRegExp(n.name)).join('|')})\\b`, 'g');
                processedContent = content.replace(pattern, '[$1](file://$1)');
            }
        }

        const html = marked.parse(processedContent);

        return (
            <div 
                className="markdown-content text-sm"
                dangerouslySetInnerHTML={{ __html: html as string }}
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const anchor = target.closest('a');
                    if (anchor && anchor.getAttribute('href')?.startsWith('file://')) {
                        e.preventDefault();
                        const fileName = anchor.getAttribute('href')?.replace('file://', '');
                        const node = nodes.find(n => n.name === fileName);
                        if (node) onFileClick(node);
                    }
                }}
            />
        );
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
            <div className="h-10 px-3 bg-zinc-900 text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 flex justify-between items-center flex-shrink-0">
                <span className="flex items-center gap-2"><Icons.Chat className="w-3 h-3" /> AI Assistant</span>
                <button onClick={onClose} className="hover:text-white text-zinc-500 p-1 rounded hover:bg-zinc-800"><Icons.Close className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                        <Icons.Chat className="w-12 h-12 mb-2" />
                        <p className="text-xs text-center">Ask anything about your project.<br/>Mention a filename to verify context.</p>
                    </div>
                )}
                {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[95%] rounded-lg p-3 ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'} shadow-sm`}>
                            {renderMessageContent(m.content)}
                        </div>
                    </div>
                ))}
                {isSending && <div className="text-zinc-500 text-xs animate-pulse pl-2">AI is thinking...</div>}
            </div>
            <div className="p-3 border-t border-zinc-800 bg-zinc-900">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSend()} 
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors placeholder-zinc-600" 
                        placeholder="Type a message..." 
                    />
                    <button onClick={handleSend} disabled={isSending} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AIChatPanelMemo = React.memo(AIChatPanel);
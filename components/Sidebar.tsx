import React, { useState, useRef, useMemo } from 'react';
import { FileNode } from '../types';
import { Button } from './ui/Button';
import { Icons } from './ui/Icons';

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
      <div onClick={handleFileClick} className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors text-sm border-l-2 ${isSelected ? 'bg-blue-500/10 text-blue-400 border-blue-500' : 'text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700'}`} style={{ paddingLeft: `${depth * 12 + 12}px` }}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colorClass}`}></span>
        <span className="truncate">{node.name}</span>
      </div>
    );
  }
  return (
    <div>
      <div onClick={handleToggle} className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-zinc-800 text-zinc-300 text-sm font-medium select-none transition-colors" style={{ paddingLeft: `${depth * 12 + 12}px` }}>
        <div className={`transition-transform duration-200 text-zinc-500 ${isOpen ? 'rotate-90' : ''}`}>
            <Icons.ChevronRight className="w-3 h-3" />
        </div>
        <Icons.FolderOpen className="w-4 h-4 text-yellow-600/80" />
        <span className="truncate">{node.name}</span>
      </div>
      <div className={`${isOpen ? 'block' : 'hidden'}`}>
          {node.children && Object.values(node.children).sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name))).map(child => <FileTreeItem key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} selectedPath={selectedPath} />)}
      </div>
    </div>
  );
};

interface SidebarProps {
    nodes: FileNode[];
    selectedNodeId: string | null;
    onFileSelect: (node: FileNode) => void;
    onLoadFiles: (files: FileList) => Promise<void>;
    onShowSettings: () => void;
    loading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ nodes, selectedNodeId, onFileSelect, onLoadFiles, onShowSettings, loading }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const fileTree = useMemo(() => buildFileTree(nodes), [nodes]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onLoadFiles(e.target.files);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800">
            {/* Header */}
            <div className="h-12 flex items-center px-3 border-b border-zinc-800 justify-between flex-shrink-0 bg-zinc-900">
                <div className="flex items-center gap-2 font-bold text-zinc-200 tracking-tight">
                    <img
                        src="/content/images/logo.png"
                        alt="CPP Relations Logo"
                        className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    />
                    <div className="flex items-center gap-1.5">
                        <span className="text-blue-500">CPP</span>
                        <span className="text-zinc-300">RELATIONS</span>
                    </div>
                </div>
                <button onClick={onShowSettings} className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded hover:bg-zinc-800" title="Settings">
                    <Icons.Settings className="w-4 h-4" />
                </button>
            </div>

            {/* Actions */}
            <div className="p-3 border-b border-zinc-800 space-y-3 flex-shrink-0 bg-zinc-900">
                <Button variant="primary" size="sm" className="w-full justify-center" onClick={() => fileInputRef.current?.click()} isLoading={loading}>
                    Load Source Folder
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" {...({ webkitdirectory: "", directory: "", multiple: "" } as any)} onChange={handleUpload} />
                
                <div className="relative group">
                    <input 
                        type="text" 
                        placeholder="Filter files..." 
                        className="w-full bg-zinc-950 text-zinc-300 text-xs px-2 py-1.5 rounded border border-zinc-700 focus:border-blue-500 outline-none pl-8 transition-colors group-hover:border-zinc-600" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                    <Icons.Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
                </div>
            </div>

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                {Object.values(fileTree.children || {})
                    .sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name)))
                    .map(child => (
                        <FileTreeItem key={child.path} node={child} depth={0} onFileClick={onFileSelect} selectedPath={selectedNodeId} />
                    ))
                }
                {nodes.length === 0 && (
                    <div className="p-8 text-center text-zinc-600 text-xs">
                        No files loaded.
                    </div>
                )}
            </div>
        </div>
    );
};
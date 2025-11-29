import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../ui/Icons';

interface MenuItem {
  label: string;
  items: MenuItemAction[];
}

interface MenuItemAction {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface MenuBarProps {
  onLoadFiles: () => void;
  onSaveLayout: () => void;
  onExportGraph: () => void;
  onToggleSidebar: () => void;
  onToggleChat: () => void;
  onShowSettings: () => void;
  onChangeLinkStyle: (style: 'bezier' | 'orthogonal') => void;
  onToggleAnimation: () => void;
  onOpenCommandPalette: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onLoadFiles,
  onSaveLayout,
  onExportGraph,
  onToggleSidebar,
  onToggleChat,
  onShowSettings,
  onChangeLinkStyle,
  onToggleAnimation,
  onOpenCommandPalette,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const menus: MenuItem[] = [
    {
      label: 'File',
      items: [
        { label: 'Load Project', icon: <Icons.FolderOpen className="w-4 h-4" />, shortcut: 'Ctrl+O', onClick: onLoadFiles },
        { label: 'Save Layout', icon: <Icons.File className="w-4 h-4" />, shortcut: 'Ctrl+S', onClick: onSaveLayout },
        { separator: true, label: '', onClick: () => {} },
        { label: 'Export Graph', icon: <Icons.Graph className="w-4 h-4" />, shortcut: 'Ctrl+E', onClick: onExportGraph },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Toggle Sidebar', icon: <Icons.FolderOpen className="w-4 h-4" />, shortcut: 'Ctrl+B', onClick: onToggleSidebar },
        { label: 'Toggle AI Chat', icon: <Icons.Chat className="w-4 h-4" />, shortcut: 'Ctrl+J', onClick: onToggleChat },
        { separator: true, label: '', onClick: () => {} },
        { label: 'Command Palette', icon: <Icons.Search className="w-4 h-4" />, shortcut: 'Ctrl+K', onClick: onOpenCommandPalette },
      ],
    },
    {
      label: 'Graph',
      items: [
        { label: 'Bezier Links', icon: <Icons.Graph className="w-4 h-4" />, onClick: () => onChangeLinkStyle('bezier') },
        { label: 'Orthogonal Links', icon: <Icons.Code className="w-4 h-4" />, onClick: () => onChangeLinkStyle('orthogonal') },
        { separator: true, label: '', onClick: () => {} },
        { label: 'Toggle Animation', icon: <Icons.Play className="w-4 h-4" />, shortcut: 'Ctrl+M', onClick: onToggleAnimation },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'AI Configuration', icon: <Icons.Settings className="w-4 h-4" />, shortcut: 'Ctrl+,', onClick: onShowSettings },
      ],
    },
  ];

  const handleMenuClick = (label: string) => {
    setActiveMenu(activeMenu === label ? null : label);
  };

  const handleItemClick = (item: MenuItemAction) => {
    if (!item.disabled && !item.separator) {
      item.onClick();
      setActiveMenu(null);
    }
  };

  return (
    <div className="h-8 bg-zinc-900 border-b border-zinc-800 flex items-center px-2 gap-1 select-none relative z-50">
      {/* Logo in Menu Bar */}
      <div className="flex items-center gap-2 mr-2 px-2 border-r border-zinc-800">
        <img
          src="/content/images/logo.png"
          alt="CPP Relations"
          className="w-5 h-5 object-contain drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]"
        />
      </div>

      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onClick={() => handleMenuClick(menu.label)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              activeMenu === menu.label
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {menu.label}
          </button>

          <AnimatePresence>
            {activeMenu === menu.label && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.1 }}
                className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 min-w-[220px] z-[100]"
              >
                {menu.items.map((item, index) => (
                  item.separator ? (
                    <div key={index} className="h-px bg-zinc-800 my-1 mx-2" />
                  ) : (
                    <button
                      key={index}
                      onClick={() => handleItemClick(item)}
                      disabled={item.disabled}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                        item.disabled
                          ? 'text-zinc-600 cursor-not-allowed'
                          : 'text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.shortcut && (
                        <span className="text-xs text-zinc-500 font-mono">{item.shortcut}</span>
                      )}
                    </button>
                  )
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';

interface CommandAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandAction[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleSelect = (action: CommandAction) => {
    action.onSelect();
    onClose();
    setSearch('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={onClose}
          />

          {/* Command Palette */}
          <div className="fixed inset-0 flex items-start justify-center pt-[15vh] z-[9999]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-2xl"
            >
              <Command
                className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
                shouldFilter={true}
              >
                <div className="flex items-center border-b border-zinc-800 px-4">
                  <Icons.Search className="w-5 h-5 text-zinc-500 mr-2" />
                  <Command.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Type a command or search..."
                    className="w-full bg-transparent text-zinc-100 py-4 outline-none placeholder:text-zinc-500"
                  />
                </div>

                <Command.List className="max-h-[400px] overflow-y-auto p-2">
                  <Command.Empty className="py-8 text-center text-zinc-500 text-sm">
                    No results found.
                  </Command.Empty>

                  {Array.from(new Set(commands.map(c => c.category || 'General'))).map(category => (
                    <Command.Group
                      key={category}
                      heading={category}
                      className="text-xs text-zinc-500 font-semibold px-2 py-2"
                    >
                      {commands
                        .filter(c => (c.category || 'General') === category)
                        .map(cmd => (
                          <Command.Item
                            key={cmd.id}
                            value={`${cmd.label} ${cmd.category || ''}`}
                            onSelect={() => handleSelect(cmd)}
                            className="flex items-center justify-between px-3 py-2 rounded cursor-pointer text-zinc-200 hover:bg-zinc-800 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              {cmd.icon && <span className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200">{cmd.icon}</span>}
                              <span className="text-sm">{cmd.label}</span>
                            </div>
                            {cmd.shortcut && (
                              <span className="text-xs text-zinc-500 font-mono bg-zinc-800 px-2 py-1 rounded">
                                {cmd.shortcut}
                              </span>
                            )}
                          </Command.Item>
                        ))}
                    </Command.Group>
                  ))}
                </Command.List>
              </Command>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

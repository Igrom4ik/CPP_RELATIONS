import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ContextMenuPosition, ContextMenuItem } from '../../hooks/useContextMenu';

interface ContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, items, onClose }) => {
  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[9999] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 min-w-[200px]"
          style={{ left: position.x, top: position.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
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
                    : item.danger
                    ? 'text-red-400 hover:bg-red-900/20'
                    : 'text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
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
  );
};

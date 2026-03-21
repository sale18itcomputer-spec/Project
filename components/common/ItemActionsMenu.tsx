'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';

interface ItemActionsMenuProps {
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const ItemActionsMenu: React.FC<ItemActionsMenuProps> = ({ onView, onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAction = (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }} className="p-2 rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand-500">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-card rounded-md shadow-lg border border-border z-[9999] animate-contentFadeIn" style={{ animationDuration: '0.15s' }}>
                    <ul className="py-1">
                        <li>
                            <button onClick={handleAction(onView)} className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                                <Eye className="w-4 h-4" />
                                <span>View</span>
                            </button>
                        </li>
                        <li>
                            <button onClick={handleAction(onEdit)} className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                                <Pencil className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                        </li>
                        <li>
                            <div className="border-t border-border my-1"></div>
                            <button onClick={handleAction(onDelete)} className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors">
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ItemActionsMenu;

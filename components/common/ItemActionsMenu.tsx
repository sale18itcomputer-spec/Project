'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

interface ItemActionsMenuProps {
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    /**
     * When provided, the Edit and Delete options are automatically shown/hidden
     * based on the current user's permissions for this module.
     * Falls back to always-shown when omitted (backward-compatible).
     */
    module?: string;
    /**
     * Override permission check for edit (still overridden by module if both given).
     * Useful for per-row logic (e.g. "only edit your own records").
     */
    canEdit?: boolean;
    /**
     * Override permission check for delete.
     */
    canDelete?: boolean;
}

const ItemActionsMenu: React.FC<ItemActionsMenuProps> = ({
    onView,
    onEdit,
    onDelete,
    module,
    canEdit: canEditProp,
    canDelete: canDeleteProp,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { can } = usePermissions();

    // Resolve edit/delete visibility
    const showEdit =
        canEditProp !== undefined
            ? canEditProp
            : module
            ? can(module, 'edit')
            : true; // no module provided → show (backward-compat)

    const showDelete =
        canDeleteProp !== undefined
            ? canDeleteProp
            : module
            ? can(module, 'delete')
            : true;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
        setIsOpen(false);
    };

    // Nothing to show at all — hide the trigger entirely
    const hasAnyAction = onView || (onEdit && showEdit) || (onDelete && showDelete);
    if (!hasAnyAction) return null;

    return (
        <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-1 w-40 bg-card rounded-md shadow-lg border border-border z-[9999] animate-contentFadeIn"
                    style={{ animationDuration: '0.15s' }}
                >
                    <ul className="py-1">
                        {onView && (
                            <li>
                                <button
                                    onClick={handleAction(onView)}
                                    className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                                >
                                    <Eye className="w-4 h-4" />
                                    <span>View</span>
                                </button>
                            </li>
                        )}

                        {onEdit && showEdit && (
                            <li>
                                <button
                                    onClick={handleAction(onEdit)}
                                    className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                            </li>
                        )}

                        {onDelete && showDelete && (
                            <>
                                <li>
                                    <div className="border-t border-border my-1" />
                                </li>
                                <li>
                                    <button
                                        onClick={handleAction(onDelete)}
                                        className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete</span>
                                    </button>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ItemActionsMenu;

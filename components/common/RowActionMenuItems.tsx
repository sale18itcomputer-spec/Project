'use client';

import React from 'react';
import { Info, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';

interface RowActionMenuItemsProps {
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    /** Dashboard-specific items rendered between Edit and Delete. */
    children?: React.ReactNode;
}

/**
 * Standard body for a DataTable row context menu: View / Edit / [extras] /
 * Delete. Omit a handler to hide its item, e.g. when the action is not
 * permitted for the current user or not supported by the dashboard.
 */
export default function RowActionMenuItems({ onView, onEdit, onDelete, children }: RowActionMenuItemsProps) {
    return (
        <>
            {onView && (
                <DropdownMenuItem onClick={onView}>
                    <Info className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
            )}
            {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
            )}
            {children}
            {onDelete && (
                <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </>
            )}
        </>
    );
}

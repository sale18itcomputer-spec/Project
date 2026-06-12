'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { DropdownMenuContent } from '../ui/dropdown-menu';

interface RowContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

/**
 * Renders a Radix DropdownMenu anchored to an arbitrary screen point instead
 * of a visible trigger element — used for Discord-style right-click menus on
 * table rows. The caller owns the open state and (x, y) coordinates, typically
 * captured from a row's `onContextMenu` event.
 */
export default function RowContextMenu({ open, x, y, onOpenChange, children }: RowContextMenuProps) {
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuPrimitive.Trigger asChild>
        <span
          aria-hidden="true"
          style={{ position: 'fixed', left: x, top: y, width: 1, height: 1 }}
          className="pointer-events-none"
        />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuContent align="start" sideOffset={2} onCloseAutoFocus={(e) => e.preventDefault()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenuPrimitive.Root>
  );
}

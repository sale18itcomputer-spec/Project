'use client';

/**
 * PermissionGate & FieldGate — Declarative permission guards for UI elements.
 *
 * PermissionGate: renders children only if the user has the required action on a module.
 * FieldGate:      renders children only if the user has visibility of a sensitive field.
 *
 * Usage:
 *   <PermissionGate module="companies" action="delete">
 *     <Button>Delete</Button>
 *   </PermissionGate>
 *
 *   <FieldGate field="showDealerPrice">
 *     <TableHead>Dealer Price</TableHead>
 *   </FieldGate>
 *
 *   // With fallback:
 *   <PermissionGate module="users" action="create" fallback={<Tooltip>No access</Tooltip>}>
 *     <Button>Add User</Button>
 *   </PermissionGate>
 */

import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionAction, DataVisibility } from '../../types';

// ─── PermissionGate ───────────────────────────────────────────────────────────

interface PermissionGateProps {
  /** The module key (e.g. "companies", "purchase_orders") */
  module: string;
  /** The CRUD/special action required */
  action: PermissionAction;
  /** Content to render when access is granted */
  children: React.ReactNode;
  /** Optional content to render when access is denied (defaults to null) */
  fallback?: React.ReactNode;
}

export function PermissionGate({
  module,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { can, isLoading } = usePermissions();

  // Don't render guarded content while auth is resolving
  if (isLoading) return null;
  if (!can(module, action)) return <>{fallback}</>;
  return <>{children}</>;
}

// ─── FieldGate ────────────────────────────────────────────────────────────────

interface FieldGateProps {
  /** The DataVisibility flag key */
  field: keyof DataVisibility;
  /** Content to render when the field is visible */
  children: React.ReactNode;
  /** Optional content to render when the field is hidden (defaults to null) */
  fallback?: React.ReactNode;
}

export function FieldGate({
  field,
  children,
  fallback = null,
}: FieldGateProps) {
  const { showField, isLoading } = usePermissions();

  if (isLoading) return null;
  if (!showField(field)) return <>{fallback}</>;
  return <>{children}</>;
}

// ─── useModuleAccess convenience hook ────────────────────────────────────────
// Useful when a component needs multiple action checks for the same module
// without calling can() individually each time.

export function useModuleAccess(module: string) {
  const { can } = usePermissions();
  return {
    canView:    can(module, 'view'),
    canCreate:  can(module, 'create'),
    canEdit:    can(module, 'edit'),
    canDelete:  can(module, 'delete'),
    canExport:  can(module, 'export'),
    canSend:    can(module, 'send'),
    canApprove: can(module, 'approve'),
    canUse:     can(module, 'use'),
  };
}

'use client';

/**
 * usePermissions — React hook for consuming the permission system.
 *
 * Usage:
 *   const { can, canView, showField } = usePermissions();
 *
 *   can('companies', 'delete')      → boolean
 *   canView('purchase_orders')      → boolean (shorthand for can(m, 'view'))
 *   showField('showDealerPrice')    → boolean
 */

import { useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  resolvePermissions,
  checkPermission,
  checkFieldVisibility,
} from '../utils/permissions';
import { PermissionAction, DataVisibility, UserPermissions } from '../types';

export interface UsePermissionsReturn {
  /** Check if the current user has a specific action on a module */
  can: (module: string, action: PermissionAction) => boolean;
  /** Shorthand — check if the user can VIEW a module */
  canView: (module: string) => boolean;
  /** Check if a sensitive data field should be visible */
  showField: (field: keyof DataVisibility) => boolean;
  /** The fully-resolved permission object (for the permissions editor UI) */
  resolvedPermissions: UserPermissions;
  /** True while auth is still loading (guards should not render yet) */
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { currentUser, isAuthLoading } = useAuth();

  const resolvedPermissions = useMemo(
    () => resolvePermissions(currentUser),
    [currentUser],
  );

  const can = useCallback(
    (module: string, action: PermissionAction): boolean => {
      if (isAuthLoading) return false;
      return checkPermission(resolvedPermissions, module, action);
    },
    [resolvedPermissions, isAuthLoading],
  );

  const canView = useCallback(
    (module: string): boolean => {
      if (isAuthLoading) return false;
      // Tools use 'use' instead of 'view'
      return (
        checkPermission(resolvedPermissions, module, 'view') ||
        checkPermission(resolvedPermissions, module, 'use')
      );
    },
    [resolvedPermissions, isAuthLoading],
  );

  const showField = useCallback(
    (field: keyof DataVisibility): boolean => {
      if (isAuthLoading) return false;
      return checkFieldVisibility(resolvedPermissions, field);
    },
    [resolvedPermissions, isAuthLoading],
  );

  return {
    can,
    canView,
    showField,
    resolvedPermissions,
    isLoading: isAuthLoading,
  };
}

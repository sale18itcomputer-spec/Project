/**
 * permissions.ts — Central permission engine for LPT System
 *
 * Architecture:
 *  • PERMISSION_MODULES  — static registry of every module + its allowed actions
 *  • ROLE_PRESETS        — full default permission objects for each of the 5 roles
 *  • resolvePermissions  — merges user.permissions (if set) with role preset fallback
 *  • buildAllowedPaths   — returns the route strings a user may visit
 *  • getDefaultRoute     — first accessible route (used for post-login redirect)
 */

import { User, UserPermissions, PermissionAction, DataVisibility } from '../types';

// ─── Module Registry ──────────────────────────────────────────────────────────

export interface ModuleDefinition {
  label: string;
  section: 'Overview' | 'Sales' | 'Products' | 'Procurement' | 'Activity' | 'Tools' | 'Admin';
  actions: PermissionAction[];
  route: string[];
}

export const PERMISSION_MODULES: Record<string, ModuleDefinition> = {
  // Overview
  dashboard: {
    label: 'Dashboard',
    section: 'Overview',
    actions: ['view'],
    route: ['/dashboard', '/'],
  },
  companies: {
    label: 'Companies',
    section: 'Overview',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/companies'],
  },
  contacts: {
    label: 'Contacts',
    section: 'Overview',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/contacts'],
  },
  contact_logs: {
    label: 'Contact Logs',
    section: 'Overview',
    actions: ['view', 'create', 'delete'],
    route: ['/contact-logs'],
  },

  // Sales
  quotations: {
    label: 'Quotations',
    section: 'Sales',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'send'],
    route: ['/quotations'],
  },
  sale_orders: {
    label: 'Sale Orders',
    section: 'Sales',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/sale-orders'],
  },
  invoices: {
    label: 'Invoices',
    section: 'Sales',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/invoices'],
  },
  delivery_orders: {
    label: 'Delivery Orders',
    section: 'Sales',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/delivery-orders'],
  },
  receipts: {
    label: 'Receipts',
    section: 'Sales',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/receipts'],
  },
  collection: {
    label: 'Collection',
    section: 'Sales',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/collection'],
  },
  weekly_report: {
    label: 'Weekly Report',
    section: 'Sales',
    actions: ['view', 'export'],
    route: ['/weekly-report'],
  },
  invoice_do: {
    label: 'Invoice + DO',
    section: 'Sales',
    actions: ['view'],
    route: ['/invoice-do'],
  },

  // Products
  pricelist: {
    label: 'B2C Pricelist',
    section: 'Products',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/pricelist'],
  },
  b2b_pricelist: {
    label: 'B2B Pricelist',
    section: 'Products',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/b2b-pricelist'],
  },
  vendor_pricelist: {
    label: 'Vendor Pricelist',
    section: 'Products',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/vendor-pricelist'],
  },
  vendors: {
    label: 'Vendor Master',
    section: 'Products',
    actions: ['view', 'create', 'edit', 'delete'],
    route: ['/vendors'],
  },

  // Procurement
  purchase_orders: {
    label: 'Purchase Orders',
    section: 'Procurement',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
    route: ['/purchase-orders'],
  },
  inventory: {
    label: 'Inventory',
    section: 'Procurement',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/inventory'],
  },

  // Activity
  pipelines: {
    label: 'Pipelines',
    section: 'Activity',
    actions: ['view', 'create', 'edit', 'delete'],
    route: ['/projects'],
  },
  site_surveys: {
    label: 'Site Surveys',
    section: 'Activity',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    route: ['/site-surveys'],
  },
  meetings: {
    label: 'Meetings',
    section: 'Activity',
    actions: ['view', 'create', 'edit', 'delete'],
    route: ['/meetings'],
  },

  // Tools
  pricing_calculator: {
    label: 'Pricing Calculator',
    section: 'Tools',
    actions: ['use'],
    route: ['/pricing-calculator'],
  },
  pdf_editor: {
    label: 'PDF Editor',
    section: 'Tools',
    actions: ['use'],
    route: ['/pdf-layout-editor'],
  },

  // Admin
  users: {
    label: 'User Management',
    section: 'Admin',
    actions: ['view', 'create', 'edit', 'delete'],
    route: ['/users'],
  },
};

// Ordered list of section names for UI rendering
export const SECTION_ORDER = [
  'Overview',
  'Sales',
  'Products',
  'Procurement',
  'Activity',
  'Tools',
  'Admin',
] as const;

// ─── Role Presets ─────────────────────────────────────────────────────────────

/**
 * Full default permission sets for each built-in role.
 * When a user has no custom permissions (user.permissions === null),
 * the resolver falls back to this object.
 */
export const ROLE_PRESETS: Record<string, UserPermissions> = {
  Admin: {
    modules: {
      dashboard:          { view: true },
      companies:          { view: true, create: true, edit: true, delete: true, export: true },
      contacts:           { view: true, create: true, edit: true, delete: true, export: true },
      contact_logs:       { view: true, create: true, delete: true },
      quotations:         { view: true, create: true, edit: true, delete: true, export: true, send: true },
      sale_orders:        { view: true, create: true, edit: true, delete: true, export: true },
      invoices:           { view: true, create: true, edit: true, delete: true, export: true },
      delivery_orders:    { view: true, create: true, edit: true, delete: true, export: true },
      receipts:           { view: true, create: true, edit: true, delete: true, export: true },
      collection:         { view: true, create: true, edit: true, delete: true, export: true },
      weekly_report:      { view: true, export: true },
      invoice_do:         { view: true },
      pricelist:          { view: true, create: true, edit: true, delete: true, export: true },
      b2b_pricelist:      { view: true, create: true, edit: true, delete: true, export: true },
      vendor_pricelist:   { view: true, create: true, edit: true, delete: true, export: true },
      vendors:            { view: true, create: true, edit: true, delete: true },
      purchase_orders:    { view: true, create: true, edit: true, delete: true, export: true, approve: true },
      inventory:          { view: true, create: true, edit: true, delete: true, export: true },
      pipelines:          { view: true, create: true, edit: true, delete: true },
      site_surveys:       { view: true, create: true, edit: true, delete: true, export: true },
      meetings:           { view: true, create: true, edit: true, delete: true },
      pricing_calculator: { use: true },
      pdf_editor:         { use: true },
      users:              { view: true, create: true, edit: true, delete: true },
    },
    dataVisibility: {
      showDealerPrice:   true,
      showVendorPricing: true,
      showPurchaseCosts: true,
      showRevenueData:   true,
    },
  },

  Manager: {
    modules: {
      dashboard:          { view: true },
      companies:          { view: true, create: true, edit: true, delete: true, export: true },
      contacts:           { view: true, create: true, edit: true, delete: true, export: true },
      contact_logs:       { view: true, create: true, delete: true },
      quotations:         { view: true, create: true, edit: true, delete: true, export: true, send: true },
      sale_orders:        { view: true, create: true, edit: true, delete: true, export: true },
      invoices:           { view: true, create: true, edit: true, delete: true, export: true },
      delivery_orders:    { view: true, create: true, edit: true, delete: true, export: true },
      receipts:           { view: true, create: true, edit: true, delete: true, export: true },
      collection:         { view: true, create: true, edit: true, delete: true, export: true },
      weekly_report:      { view: true, export: true },
      invoice_do:         { view: true },
      pricelist:          { view: true, create: true, edit: true, delete: true, export: true },
      b2b_pricelist:      { view: true, create: true, edit: true, delete: true, export: true },
      vendor_pricelist:   { view: true, create: true, edit: true, delete: true, export: true },
      vendors:            { view: true, create: true, edit: true, delete: true },
      purchase_orders:    { view: false, create: false, edit: false, delete: false, export: false, approve: false },
      inventory:          { view: false, create: false, edit: false, delete: false, export: false },
      pipelines:          { view: true, create: true, edit: true, delete: true },
      site_surveys:       { view: true, create: true, edit: true, delete: true, export: true },
      meetings:           { view: true, create: true, edit: true, delete: true },
      pricing_calculator: { use: true },
      pdf_editor:         { use: true },
      users:              { view: false, create: false, edit: false, delete: false },
    },
    dataVisibility: {
      showDealerPrice:   true,
      showVendorPricing: true,
      showPurchaseCosts: true,
      showRevenueData:   true,
    },
  },

  Sales: {
    modules: {
      dashboard:          { view: true },
      companies:          { view: true, create: true, edit: true, delete: false, export: true },
      contacts:           { view: true, create: true, edit: true, delete: false, export: true },
      contact_logs:       { view: true, create: true, delete: false },
      quotations:         { view: true, create: true, edit: true, delete: true, export: true, send: true },
      sale_orders:        { view: true, create: true, edit: true, delete: false, export: true },
      invoices:           { view: true, create: false, edit: false, delete: false, export: true },
      delivery_orders:    { view: true, create: false, edit: false, delete: false, export: true },
      receipts:           { view: true, create: false, edit: false, delete: false, export: false },
      collection:         { view: true, create: false, edit: false, delete: false, export: false },
      weekly_report:      { view: true, export: true },
      invoice_do:         { view: true },
      pricelist:          { view: true, create: false, edit: false, delete: false, export: true },
      b2b_pricelist:      { view: true, create: false, edit: false, delete: false, export: true },
      vendor_pricelist:   { view: true, create: false, edit: false, delete: false, export: false },
      vendors:            { view: false, create: false, edit: false, delete: false },
      purchase_orders:    { view: false, create: false, edit: false, delete: false, export: false, approve: false },
      inventory:          { view: false, create: false, edit: false, delete: false, export: false },
      pipelines:          { view: true, create: true, edit: true, delete: false },
      site_surveys:       { view: true, create: true, edit: true, delete: false, export: true },
      meetings:           { view: true, create: true, edit: true, delete: false },
      pricing_calculator: { use: true },
      pdf_editor:         { use: false },
      users:              { view: false, create: false, edit: false, delete: false },
    },
    dataVisibility: {
      showDealerPrice:   true,
      showVendorPricing: false,
      showPurchaseCosts: false,
      showRevenueData:   true,
    },
  },

  Finance: {
    modules: {
      dashboard:          { view: false },
      companies:          { view: false, create: false, edit: false, delete: false, export: false },
      contacts:           { view: false, create: false, edit: false, delete: false, export: false },
      contact_logs:       { view: false, create: false, delete: false },
      quotations:         { view: false, create: false, edit: false, delete: false, export: false, send: false },
      sale_orders:        { view: false, create: false, edit: false, delete: false, export: false },
      invoices:           { view: true, create: true, edit: true, delete: true, export: true },
      delivery_orders:    { view: true, create: true, edit: true, delete: true, export: true },
      receipts:           { view: true, create: true, edit: true, delete: true, export: true },
      collection:         { view: true, create: true, edit: true, delete: true, export: true },
      weekly_report:      { view: false, export: false },
      invoice_do:         { view: true },
      pricelist:          { view: false, create: false, edit: false, delete: false, export: false },
      b2b_pricelist:      { view: false, create: false, edit: false, delete: false, export: false },
      vendor_pricelist:   { view: false, create: false, edit: false, delete: false, export: false },
      vendors:            { view: false, create: false, edit: false, delete: false },
      purchase_orders:    { view: false, create: false, edit: false, delete: false, export: false, approve: false },
      inventory:          { view: false, create: false, edit: false, delete: false, export: false },
      pipelines:          { view: false, create: false, edit: false, delete: false },
      site_surveys:       { view: false, create: false, edit: false, delete: false, export: false },
      meetings:           { view: false, create: false, edit: false, delete: false },
      pricing_calculator: { use: false },
      pdf_editor:         { use: false },
      users:              { view: false, create: false, edit: false, delete: false },
    },
    dataVisibility: {
      showDealerPrice:   true,
      showVendorPricing: true,
      showPurchaseCosts: true,
      showRevenueData:   true,
    },
  },

  User: {
    modules: {
      dashboard:          { view: true },
      companies:          { view: true, create: false, edit: false, delete: false, export: false },
      contacts:           { view: true, create: false, edit: false, delete: false, export: false },
      contact_logs:       { view: true, create: false, delete: false },
      quotations:         { view: true, create: false, edit: false, delete: false, export: false, send: false },
      sale_orders:        { view: true, create: false, edit: false, delete: false, export: false },
      invoices:           { view: true, create: false, edit: false, delete: false, export: false },
      delivery_orders:    { view: true, create: false, edit: false, delete: false, export: false },
      receipts:           { view: true, create: false, edit: false, delete: false, export: false },
      collection:         { view: true, create: false, edit: false, delete: false, export: false },
      weekly_report:      { view: false, export: false },
      invoice_do:         { view: true },
      pricelist:          { view: true, create: false, edit: false, delete: false, export: false },
      b2b_pricelist:      { view: true, create: false, edit: false, delete: false, export: false },
      vendor_pricelist:   { view: false, create: false, edit: false, delete: false, export: false },
      vendors:            { view: false, create: false, edit: false, delete: false },
      purchase_orders:    { view: false, create: false, edit: false, delete: false, export: false, approve: false },
      inventory:          { view: false, create: false, edit: false, delete: false, export: false },
      pipelines:          { view: true, create: false, edit: false, delete: false },
      site_surveys:       { view: true, create: false, edit: false, delete: false, export: false },
      meetings:           { view: true, create: false, edit: false, delete: false },
      pricing_calculator: { use: false },
      pdf_editor:         { use: false },
      users:              { view: false, create: false, edit: false, delete: false },
    },
    dataVisibility: {
      showDealerPrice:   false,
      showVendorPricing: false,
      showPurchaseCosts: false,
      showRevenueData:   false,
    },
  },
};

// ─── Permission Resolver ──────────────────────────────────────────────────────

/**
 * Returns the effective permissions for a user.
 * If user.permissions is set, that object is used directly (full snapshot stored at save time).
 * Otherwise falls back to the role preset.
 */
export function resolvePermissions(user: User | null): UserPermissions {
  if (!user) return ROLE_PRESETS['User'];
  if (user.permissions) return user.permissions;
  return ROLE_PRESETS[user.Role] ?? ROLE_PRESETS['User'];
}

/**
 * Check a single module/action pair given a resolved permission object.
 */
export function checkPermission(
  permissions: UserPermissions,
  module: string,
  action: PermissionAction,
): boolean {
  return permissions.modules[module]?.[action] === true;
}

/**
 * Check a field visibility flag. Defaults to true (show) if not explicitly set.
 */
export function checkFieldVisibility(
  permissions: UserPermissions,
  field: keyof DataVisibility,
): boolean {
  const val = permissions.dataVisibility?.[field];
  return val !== false; // undefined → show; false → hide
}

// ─── Route Helpers ────────────────────────────────────────────────────────────

/**
 * Returns the flat list of route strings the user is allowed to visit,
 * based on their resolved permissions (view = true on the module).
 */
export function buildAllowedPaths(user: User | null): string[] {
  const perms = resolvePermissions(user);
  const paths: string[] = [];

  for (const [moduleKey, def] of Object.entries(PERMISSION_MODULES)) {
    if (perms.modules[moduleKey]?.view === true || perms.modules[moduleKey]?.use === true) {
      paths.push(...def.route);
    }
  }

  return paths;
}

/**
 * Returns the best landing route for a user after login / on access-denied redirect.
 * Tries in priority order: dashboard → invoices → companies → first accessible route.
 */
export function getDefaultRoute(user: User | null): string {
  const perms = resolvePermissions(user);

  const priority = ['dashboard', 'invoices', 'companies', 'quotations', 'pipelines'];
  for (const mod of priority) {
    if (perms.modules[mod]?.view === true) {
      return PERMISSION_MODULES[mod].route[0];
    }
  }

  // Last resort — find literally any viewable route
  for (const [moduleKey, def] of Object.entries(PERMISSION_MODULES)) {
    const mp = perms.modules[moduleKey];
    if (mp?.view === true || mp?.use === true) {
      return def.route[0];
    }
  }

  return '/login';
}

/**
 * Given a role name, returns the full preset — used by the permissions editor
 * to populate checkboxes when the admin changes the role dropdown.
 */
export function getPresetForRole(role: string): UserPermissions {
  return ROLE_PRESETS[role] ?? ROLE_PRESETS['User'];
}

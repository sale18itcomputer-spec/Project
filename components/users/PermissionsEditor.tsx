'use client';

/**
 * PermissionsEditor — Checklist UI for editing a user's fine-grained permissions.
 *
 * Used inside the tabbed user create/edit modal.
 * Renders every module grouped by section with toggleable action pills,
 * plus a Data Visibility section at the bottom.
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Info, Eye, EyeOff, ShoppingCart, Package, BookOpen, CheckCircle2, CornerDownRight, Undo2 } from 'lucide-react';
import {
  PERMISSION_MODULES,
  SECTION_ORDER,
  getPresetForRole,
} from '../../utils/permissions';
import {
  UserPermissions,
  ModulePermissions,
  PermissionAction,
  DataVisibility,
} from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PermissionsEditorProps {
  permissions: UserPermissions;
  role: string;
  onChange: (updated: UserPermissions) => void;
}

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_META: Record<PermissionAction, { label: string; short: string }> = {
  view:    { label: 'View',    short: 'V' },
  create:  { label: 'Create',  short: 'C' },
  edit:    { label: 'Edit',    short: 'E' },
  delete:  { label: 'Delete',  short: 'D' },
  export:  { label: 'Export',  short: 'X' },
  send:    { label: 'Send',    short: 'S' },
  approve: { label: 'Approve', short: 'A' },
  use:     { label: 'Use',     short: 'U' },
};

// Fully static Tailwind classes — dynamic strings would be purged
const ACTION_ON: Record<PermissionAction, string> = {
  view:    'bg-blue-100   text-blue-700   border-blue-300   dark:bg-blue-900/50   dark:text-blue-300   dark:border-blue-700',
  create:  'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700',
  edit:    'bg-amber-100  text-amber-700  border-amber-300  dark:bg-amber-900/50  dark:text-amber-300  dark:border-amber-700',
  delete:  'bg-rose-100   text-rose-700   border-rose-300   dark:bg-rose-900/50   dark:text-rose-300   dark:border-rose-700',
  export:  'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700',
  send:    'bg-cyan-100   text-cyan-700   border-cyan-300   dark:bg-cyan-900/50   dark:text-cyan-300   dark:border-cyan-700',
  approve: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700',
  use:     'bg-teal-100   text-teal-700   border-teal-300   dark:bg-teal-900/50   dark:text-teal-300   dark:border-teal-700',
};

const ACTION_OFF = 'bg-transparent text-muted-foreground/40 border-border/50 hover:border-border hover:text-muted-foreground';

// ─── ActionPill ───────────────────────────────────────────────────────────────

const ActionPill: React.FC<{
  action: PermissionAction;
  enabled: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ action, enabled, disabled = false, onClick }) => {
  const { label, short } = ACTION_META[action];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} (enable View first)` : label}
      className={`
        inline-flex items-center justify-center w-8 h-7 rounded-md border text-[11px] font-bold
        transition-all duration-150 select-none shrink-0
        ${disabled
          ? 'opacity-20 cursor-not-allowed bg-transparent text-muted-foreground border-border/40'
          : enabled
            ? `${ACTION_ON[action]} shadow-sm cursor-pointer`
            : `${ACTION_OFF} cursor-pointer`
        }
      `}
    >
      {short}
    </button>
  );
};

// ─── SectionHeader ────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  allEnabled: boolean;
  someEnabled: boolean;
  onToggleAll: () => void;
}> = ({ label, isOpen, onToggle, allEnabled, someEnabled, onToggleAll }) => (
  <div className="flex items-center gap-2 py-2 select-none">
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 flex-1 text-left min-w-0 group"
    >
      <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors truncate">
        {label}
      </span>
    </button>

    {/* Section master toggle badge — must not shrink or wrap */}
    <button
      type="button"
      onClick={onToggleAll}
      title={allEnabled ? 'Disable all in this section' : 'Enable all in this section'}
      className={`
        shrink-0 whitespace-nowrap text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-all
        ${allEnabled
          ? 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700'
          : someEnabled
          ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
          : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-foreground'
        }
      `}
    >
      {allEnabled ? 'All on' : someEnabled ? 'Partial' : 'All off'}
    </button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PermissionsEditor: React.FC<PermissionsEditorProps> = ({
  permissions,
  role,
  onChange,
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SECTION_ORDER.map(s => [s, true]))
  );

  const toggleSection = (section: string) =>
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

  // Modules with subTabs (e.g. Accounting) start collapsed — expand on demand.
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const toggleModuleExpanded = (moduleKey: string) =>
    setExpandedModules(prev => ({ ...prev, [moduleKey]: !prev[moduleKey] }));

  // ── Module action toggle ──────────────────────────────────────────────────

  const toggleAction = useCallback(
    (moduleKey: string, action: PermissionAction) => {
      const current = permissions.modules[moduleKey]?.[action] ?? false;
      const updated: UserPermissions = {
        ...permissions,
        modules: {
          ...permissions.modules,
          [moduleKey]: {
            ...permissions.modules[moduleKey],
            [action]: !current,
          },
        },
      };

      // Toggling View OFF → clear all other actions for this module
      if (action === 'view' && current === true) {
        const def = PERMISSION_MODULES[moduleKey];
        const cleared: ModulePermissions = {};
        for (const a of def.actions) {
          if (a !== 'view' && a !== 'use') cleared[a] = false;
        }
        updated.modules[moduleKey] = {
          ...updated.modules[moduleKey],
          ...cleared,
          view: false,
        };
      }

      onChange(updated);
    },
    [permissions, onChange],
  );

  // ── Sub-tab action toggle (e.g. Accounting's Profit & Loss tab) ──────────
  // Toggling flips the currently-EFFECTIVE value (explicit override if one
  // exists, otherwise the module's own value) so the pill always does what it
  // visually shows, regardless of whether this is the first override or not.

  const toggleSubTabAction = useCallback(
    (moduleKey: string, subTabKey: string, action: PermissionAction) => {
      const moduleVal = permissions.modules[moduleKey]?.[action] === true;
      const explicit = permissions.subModules?.[moduleKey]?.[subTabKey]?.[action];
      const current = explicit !== undefined ? explicit : moduleVal;

      onChange({
        ...permissions,
        subModules: {
          ...permissions.subModules,
          [moduleKey]: {
            ...permissions.subModules?.[moduleKey],
            [subTabKey]: {
              ...permissions.subModules?.[moduleKey]?.[subTabKey],
              [action]: !current,
            },
          },
        },
      });
    },
    [permissions, onChange],
  );

  // Removes all explicit overrides for one sub-tab, so it goes back to
  // inheriting the module's own permissions.
  const resetSubTab = useCallback(
    (moduleKey: string, subTabKey: string) => {
      const moduleSubTabs = { ...permissions.subModules?.[moduleKey] };
      delete moduleSubTabs[subTabKey];
      onChange({
        ...permissions,
        subModules: { ...permissions.subModules, [moduleKey]: moduleSubTabs },
      });
    },
    [permissions, onChange],
  );

  // ── Section-level toggle all ──────────────────────────────────────────────

  const toggleSectionAll = useCallback(
    (section: string, enable: boolean) => {
      const sectionModules = Object.entries(PERMISSION_MODULES).filter(
        ([, def]) => def.section === section
      );
      const updatedModules = { ...permissions.modules };

      for (const [moduleKey, def] of sectionModules) {
        const mp: ModulePermissions = {};
        for (const a of def.actions) mp[a] = enable;
        updatedModules[moduleKey] = mp;
      }

      onChange({ ...permissions, modules: updatedModules });
    },
    [permissions, onChange],
  );

  // ── Data visibility toggle ────────────────────────────────────────────────

  const toggleDataVisibility = useCallback(
    (field: keyof DataVisibility) => {
      const current = permissions.dataVisibility?.[field] ?? true;
      onChange({
        ...permissions,
        dataVisibility: { ...permissions.dataVisibility, [field]: !current },
      });
    },
    [permissions, onChange],
  );

  // ── Department quick-apply ────────────────────────────────────────────────

  const DEPARTMENTS: {
    key: string;
    label: string;
    moduleKeys: string[];
    colorOn: string;
    colorOff: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'sales',
      label: 'Sales',
      moduleKeys: Object.entries(PERMISSION_MODULES)
        .filter(([, d]) => ['Overview', 'Sales', 'Activity'].includes(d.section))
        .map(([k]) => k),
      colorOn: 'bg-blue-600 text-white border-blue-600 shadow-sm',
      colorOff: 'bg-card text-muted-foreground border-border hover:border-blue-400 hover:text-blue-600',
      icon: <ShoppingCart size={14} />,
    },
    {
      key: 'procurement',
      label: 'Procurement',
      moduleKeys: Object.entries(PERMISSION_MODULES)
        .filter(([, d]) => ['Products', 'Procurement'].includes(d.section))
        .map(([k]) => k),
      colorOn: 'bg-amber-500 text-white border-amber-500 shadow-sm',
      colorOff: 'bg-card text-muted-foreground border-border hover:border-amber-400 hover:text-amber-600',
      icon: <Package size={14} />,
    },
    {
      key: 'accounting',
      label: 'Accounting',
      moduleKeys: ['accounting'],
      colorOn: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
      colorOff: 'bg-card text-muted-foreground border-border hover:border-emerald-400 hover:text-emerald-600',
      icon: <BookOpen size={14} />,
    },
  ];

  const isDeptActive = (moduleKeys: string[]) =>
    moduleKeys.every(k => {
      const mp = permissions.modules[k] ?? {};
      const def = PERMISSION_MODULES[k];
      return def?.actions.includes('view') ? mp.view === true : mp.use === true;
    });

  const toggleDept = (moduleKeys: string[], enable: boolean) => {
    const updatedModules = { ...permissions.modules };
    for (const k of moduleKeys) {
      const def = PERMISSION_MODULES[k];
      if (!def) continue;
      const mp: ModulePermissions = {};
      for (const a of def.actions) mp[a] = enable;
      updatedModules[k] = mp;
    }
    onChange({ ...permissions, modules: updatedModules });
  };

  // ── Reset to role preset ──────────────────────────────────────────────────

  const handleReset = () => onChange(getPresetForRole(role));

  // ── Section stats ─────────────────────────────────────────────────────────

  const getSectionStats = (section: string) => {
    const mods = Object.entries(PERMISSION_MODULES).filter(([, def]) => def.section === section);
    let total = 0, enabled = 0;
    for (const [k, def] of mods) {
      for (const a of def.actions) {
        total++;
        if (permissions.modules[k]?.[a]) enabled++;
      }
    }
    return { allEnabled: total > 0 && enabled === total, someEnabled: enabled > 0 && enabled < total };
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">

      {/* ── Department shortcuts ── */}
      <div className="border border-border/70 rounded-xl overflow-hidden">
        <div className="px-3 py-2.5 bg-muted/40 border-b border-border/40">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Department Access</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            One-click to grant a full department. Combine freely, then fine-tune below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {DEPARTMENTS.map(dept => {
            const active = isDeptActive(dept.moduleKeys);
            return (
              <button
                key={dept.key}
                type="button"
                onClick={() => toggleDept(dept.moduleKeys, !active)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-sm transition-all ${active ? dept.colorOn : dept.colorOff}`}
              >
                {dept.icon}
                {dept.label}
                {active && <CheckCircle2 size={13} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Toggle pills to override the role preset per module.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1 hover:bg-accent transition-all whitespace-nowrap"
        >
          <RotateCcw size={11} />
          Reset to {role} defaults
        </button>
      </div>

      {/* ── Action legend ── */}
      <div className="flex flex-wrap gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/60">
        {(Object.entries(ACTION_META) as [PermissionAction, typeof ACTION_META[PermissionAction]][]).map(([action, { short, label }]) => (
          <span key={action} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`inline-flex w-6 h-5 rounded border items-center justify-center text-[10px] font-bold shrink-0 ${ACTION_ON[action]}`}>
              {short}
            </span>
            {label}
          </span>
        ))}
      </div>

      {/* ── Section groups ── */}
      {SECTION_ORDER.map(section => {
        const modulesInSection = Object.entries(PERMISSION_MODULES).filter(
          ([, def]) => def.section === section
        );
        if (modulesInSection.length === 0) return null;

        const { allEnabled, someEnabled } = getSectionStats(section);
        const isOpen = openSections[section] ?? true;

        return (
          <div key={section} className="border border-border/70 rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="px-3 bg-muted/40 border-b border-border/40">
              <SectionHeader
                label={section}
                isOpen={isOpen}
                onToggle={() => toggleSection(section)}
                allEnabled={allEnabled}
                someEnabled={someEnabled}
                onToggleAll={() => toggleSectionAll(section, !allEnabled)}
              />
            </div>

            {/* Module rows */}
            {isOpen && (
              <div className="divide-y divide-border/30">
                {modulesInSection.map(([moduleKey, def], idx) => {
                  const mp = permissions.modules[moduleKey] ?? {};
                  const isViewable = mp.view === true || mp.use === true;
                  const hasSubTabs = !!def.subTabs && def.subTabs.length > 0;
                  const isExpanded = hasSubTabs && !!expandedModules[moduleKey];
                  const restrictedSubTabCount = hasSubTabs
                    ? Object.keys(permissions.subModules?.[moduleKey] ?? {}).length
                    : 0;

                  return (
                    <div key={moduleKey} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                      <div
                        className={`flex items-center gap-3 px-3 py-2 transition-colors ${!isViewable ? 'opacity-60' : ''}`}
                      >
                        {/* Expand toggle for modules with sub-tabs */}
                        {hasSubTabs ? (
                          <button
                            type="button"
                            onClick={() => toggleModuleExpanded(moduleKey)}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            title={isExpanded ? 'Hide sub-tabs' : 'Show sub-tab permissions'}
                          >
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        ) : (
                          <span className="w-[13px] shrink-0" />
                        )}

                        {/* Module name */}
                        <span className={`flex-1 text-[13px] font-medium min-w-0 flex items-center gap-2 ${
                          isViewable ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {def.label}
                          {restrictedSubTabCount > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              {restrictedSubTabCount} sub-tab override{restrictedSubTabCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </span>

                        {/* Pills */}
                        <div className="flex items-center gap-1 shrink-0">
                          {def.actions.map(action => {
                            const isEnabled = mp[action] === true;
                            const isDisabled =
                              action !== 'view' && action !== 'use' && !isViewable;

                            return (
                              <ActionPill
                                key={action}
                                action={action}
                                enabled={isEnabled}
                                disabled={isDisabled}
                                onClick={() => !isDisabled && toggleAction(moduleKey, action)}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Sub-tab rows */}
                      {isExpanded && (
                        <div className="pl-8 pr-3 pb-2 space-y-1">
                          {!isViewable && (
                            <p className="text-[11px] text-muted-foreground/60 italic py-1">
                              Enable View on {def.label} first — sub-tabs are unreachable until then.
                            </p>
                          )}
                          {def.subTabs!.map(subTab => {
                            const override = permissions.subModules?.[moduleKey]?.[subTab.key];
                            const hasOverride = override && Object.keys(override).length > 0;

                            return (
                              <div
                                key={subTab.key}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${
                                  hasOverride ? 'border-amber-300/60 bg-amber-500/5' : 'border-border/40 bg-background/40'
                                }`}
                              >
                                <CornerDownRight size={11} className="text-muted-foreground/50 shrink-0" />
                                <span className="flex-1 text-[12px] text-muted-foreground min-w-0 truncate">
                                  {subTab.label}
                                </span>
                                {hasOverride && (
                                  <button
                                    type="button"
                                    onClick={() => resetSubTab(moduleKey, subTab.key)}
                                    title="Reset to inherit from module"
                                    className="shrink-0 text-muted-foreground/50 hover:text-brand-600 transition-colors"
                                  >
                                    <Undo2 size={12} />
                                  </button>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                  {def.actions.map(action => {
                                    const explicit = override?.[action];
                                    const effective = explicit !== undefined ? explicit : mp[action] === true;
                                    const isDisabled = action !== 'view' && action !== 'use' && !isViewable;

                                    return (
                                      <ActionPill
                                        key={action}
                                        action={action}
                                        enabled={effective}
                                        disabled={isDisabled}
                                        onClick={() => !isDisabled && toggleSubTabAction(moduleKey, subTab.key, action)}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Data Visibility ── */}
      <div className="border border-border/70 rounded-xl overflow-hidden">
        <div className="px-3 py-2.5 bg-muted/40 border-b border-border/40">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Data Visibility
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            Control which sensitive columns and charts this user can see.
          </p>
        </div>

        <div className="divide-y divide-border/30">
          {(
            [
              {
                field: 'showDealerPrice' as keyof DataVisibility,
                label: 'Dealer Price column',
                description: '"Dealer Price" column in B2C & B2B Pricelist',
              },
              {
                field: 'showVendorPricing' as keyof DataVisibility,
                label: 'Vendor Pricing',
                description: 'Dealer price & user price columns in Vendor Pricelist',
              },
              {
                field: 'showPurchaseCosts' as keyof DataVisibility,
                label: 'Purchase Costs',
                description: 'Unit prices in Purchase Orders and Inventory',
              },
              {
                field: 'showRevenueData' as keyof DataVisibility,
                label: 'Revenue & Analytics',
                description: 'Revenue charts, top customers, and financial figures on Dashboard',
              },
            ] as const
          ).map(({ field, label, description }, idx) => {
            const isVisible = permissions.dataVisibility?.[field] !== false;

            return (
              <button
                key={field}
                type="button"
                onClick={() => toggleDataVisibility(field)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
                  idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                }`}
              >
                {/* Toggle pill */}
                <div className={`
                  shrink-0 w-9 h-5 rounded-full border-2 flex items-center transition-all
                  ${isVisible
                    ? 'bg-brand-600 border-brand-600 justify-end'
                    : 'bg-muted border-border justify-start'
                  }
                `}>
                  <div className="w-3.5 h-3.5 rounded-full bg-white mx-0.5 shadow-sm" />
                </div>

                {/* Icon */}
                <span className={`shrink-0 ${isVisible ? 'text-brand-500' : 'text-muted-foreground/40'}`}>
                  {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                </span>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium leading-tight ${isVisible ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                    {label}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 leading-snug">{description}</p>
                </div>

                {/* Status chip */}
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                  isVisible
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground/50'
                }`}>
                  {isVisible ? 'Visible' : 'Hidden'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PermissionsEditor;

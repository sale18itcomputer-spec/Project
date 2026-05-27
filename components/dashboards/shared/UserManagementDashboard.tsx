'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  UserPlus, Search, Edit2, Trash2, Users, KeyRound, Loader2,
  ShieldCheck, User as UserIcon, ChevronDown, X,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { createRecord, updateRecord, deleteRecord } from '../../../services/api';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { User as UserType, UserPermissions } from '../../../types';
import { useNavigation } from '../../../contexts/NavigationContext';
import { getPresetForRole } from '../../../utils/permissions';
import PermissionsEditor from '../../users/PermissionsEditor';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const isActive = status === 'Active';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
};

// ─── Role Badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  Admin:   'bg-rose-50 text-rose-700 border-rose-200',
  Manager: 'bg-violet-50 text-violet-700 border-violet-200',
  Sales:   'bg-blue-50 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  User:    'bg-slate-100 text-slate-700 border-slate-200',
};

const RoleBadge: React.FC<{ role?: string }> = ({ role = 'User' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
    ROLE_COLORS[role] ?? ROLE_COLORS['User']
  }`}>
    {role}
  </span>
);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type ModalTab = 'profile' | 'permissions';

const TABS: { id: ModalTab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',     label: 'Profile',     icon: <UserIcon size={14} /> },
  { id: 'permissions', label: 'Permissions',  icon: <ShieldCheck size={14} /> },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const UserManagementDashboard: React.FC = () => {
  const { users: allUsers, isAuthLoading: loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState<UserType | null>(null);
  const [isSettingPassword, setIsSettingPassword] = useState<UserType | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const { addToast } = useToast();
  const { handleNavigation, navigation } = useNavigation();

  // ── Modal state ─────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<ModalTab>('profile');
  const [formData, setFormData] = useState<Partial<UserType>>({});
  const [pendingRoleChange, setPendingRoleChange] = useState<string | null>(null);

  const isAdding = navigation.action === 'create';
  const isEditingUser = useMemo(() => {
    if (navigation.action === 'edit' && navigation.id && allUsers) {
      return allUsers.find(u => u.UserID === navigation.id) || null;
    }
    return null;
  }, [navigation.action, navigation.id, allUsers]);

  const isModalOpen = isAdding || !!isEditingUser;

  useEffect(() => {
    if (isEditingUser) {
      setFormData(isEditingUser);
      setActiveTab('profile');
    } else if (isAdding && !formData.Role) {
      const defaultRole = 'User';
      setFormData({
        Role: defaultRole,
        Status: 'Active',
        permissions: getPresetForRole(defaultRole),
      });
      setActiveTab('profile');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingUser, isAdding]);

  const handleCloseModal = () => {
    setFormData({});
    setActiveTab('profile');
    setPendingRoleChange(null);
    handleNavigation({ view: 'users', filter: navigation.filter });
  };

  // ── Role-change with confirmation ────────────────────────────────────────

  const handleRoleChange = (newRole: string) => {
    // If no custom permissions set yet, just switch and apply preset
    const hasCustomPerms = !!formData.permissions;
    if (!hasCustomPerms) {
      setFormData(prev => ({
        ...prev,
        Role: newRole,
        permissions: getPresetForRole(newRole),
      }));
      return;
    }
    // Ask for confirmation before resetting
    setPendingRoleChange(newRole);
  };

  const confirmRoleChange = () => {
    if (!pendingRoleChange) return;
    setFormData(prev => ({
      ...prev,
      Role: pendingRoleChange,
      permissions: getPresetForRole(pendingRoleChange),
    }));
    setPendingRoleChange(null);
  };

  // ── Permission updates ───────────────────────────────────────────────────

  const handlePermissionsChange = (updated: UserPermissions) => {
    setFormData(prev => ({ ...prev, permissions: updated }));
  };

  // Ensure permissions object is always initialised when opening Permissions tab
  const handleTabChange = (tab: ModalTab) => {
    if (tab === 'permissions' && !formData.permissions && formData.Role) {
      setFormData(prev => ({
        ...prev,
        permissions: getPresetForRole(prev.Role ?? 'User'),
      }));
    }
    setActiveTab(tab);
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    const query = (searchQuery || '').toLowerCase();
    return allUsers.filter(user =>
      user.Name?.toLowerCase().includes(query) ||
      user.Email?.toLowerCase().includes(query) ||
      user.Role?.toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  const handleSave = async () => {
    try {
      // Build the payload — always include permissions snapshot
      const perms = formData.permissions ?? getPresetForRole(formData.Role ?? 'User');
      const payload = { ...formData, permissions: perms };
      delete payload.Password; // Password handled separately via Supabase Auth API

      if (isAdding) {
        const newUserId = `USR-${Date.now()}`;
        await createRecord('Users', {
          ...payload,
          UserID: newUserId,
          Status: 'Active',
        });

        if (formData.Email && formData.Password) {
          const res = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.Email, password: formData.Password }),
          });
          if (!res.ok) {
            const body = await res.json();
            addToast(`User saved, but Supabase Auth error: ${body.error}`, 'info');
          } else {
            addToast('User created successfully with login access', 'success');
          }
        } else {
          addToast('User created (no password — they can use Google Sign-In or set one later)', 'success');
        }
      } else if (isEditingUser) {
        await updateRecord('Users', isEditingUser.UserID, payload);
        addToast('User updated successfully', 'success');
      }
      window.location.reload();
      handleCloseModal();
    } catch {
      addToast('Failed to save user', 'error');
    }
  };

  // ── Set Password ─────────────────────────────────────────────────────────

  const handleSetPassword = async () => {
    if (!isSettingPassword?.Email || !newPassword) {
      addToast('Email and new password are required.', 'error');
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch('/api/admin/update-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: isSettingPassword.Email, password: newPassword }),
      });
      const body = await res.json();
      if (!res.ok) {
        addToast(`Failed: ${body.error}`, 'error');
      } else {
        addToast(
          body.created
            ? `Supabase Auth account created for ${isSettingPassword.Name}`
            : `Password updated for ${isSettingPassword.Name}`,
          'success',
        );
        setIsSettingPassword(null);
        setNewPassword('');
      }
    } catch {
      addToast('Network error setting password', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDeleteUser = async () => {
    if (!isDeleting) return;
    try {
      await deleteRecord('Users', isDeleting.UserID);
      addToast('User deleted successfully', 'success');
      window.location.reload();
      setIsDeleting(null);
    } catch {
      addToast('Failed to delete user', 'error');
    }
  };

  const openEdit = (user: UserType) => {
    setFormData(user);
    handleNavigation({ view: 'users', filter: navigation.filter, action: 'edit', id: user.UserID });
  };

  const openAdd = () => {
    const defaultRole = 'User';
    setFormData({ Role: defaultRole, Status: 'Active', permissions: getPresetForRole(defaultRole) });
    handleNavigation({ view: 'users', filter: navigation.filter, action: 'create' });
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading users...</div>;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="p-4 lg:p-6 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">User Management</h2>
          <p className="hidden sm:block text-muted-foreground">Manage application access, roles and permissions.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-grow sm:w-64">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search className="w-4 h-4" />
            </div>
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={openAdd} className="gap-2 bg-brand-600 hover:bg-brand-700 whitespace-nowrap">
            <UserPlus className="w-4 h-4" /> <span>Add User</span>
          </Button>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-4 sm:p-6">
        <div className="rounded-xl border shadow-sm overflow-x-auto horizontal-scroll bg-card h-full">
          <Table className="min-w-full">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-muted/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] pl-4 sm:pl-6">User</TableHead>
                <TableHead className="px-3 sm:px-4">Role</TableHead>
                <TableHead className="px-3 sm:px-4">Email</TableHead>
                <TableHead className="px-3 sm:px-4">Status</TableHead>
                <TableHead className="px-3 sm:px-4">Permissions</TableHead>
                <TableHead className="text-right pr-4 sm:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <TableRow key={user.UserID} className="hover:bg-muted/30 transition-colors group">
                    <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] pl-4 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200 text-sm sm:text-base cursor-default">
                          {user.Name ? user.Name[0].toUpperCase() : '?'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">
                            {user.Name || 'Unknown User'}
                          </div>
                          <div className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">
                            #{user.UserID}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3 sm:py-4">
                      <RoleBadge role={user.Role} />
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3 sm:py-4 font-medium text-slate-600 dark:text-slate-300 text-xs sm:text-sm">
                      {user.Email || '-'}
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3 sm:py-4">
                      <StatusBadge status={user.Status} />
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3 sm:py-4">
                      {user.permissions ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                          <ShieldCheck size={10} /> Custom
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          Role default
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4 sm:pr-6 py-3 sm:py-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)}
                          className="text-muted-foreground hover:text-brand-600" title="Edit user">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-amber-600"
                          onClick={() => { setIsSettingPassword(user); setNewPassword(''); }}
                          title="Set password">
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-rose-600"
                          onClick={() => setIsDeleting(user)} title="Delete user">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center">
                      <Users className="w-12 h-12 text-muted-foreground/20 mb-4" />
                      <p className="text-muted-foreground font-medium">No users found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      {isDeleting && (
        <ConfirmationModal
          isOpen={!!isDeleting}
          onClose={() => setIsDeleting(null)}
          onConfirm={handleDeleteUser}
          title="Delete User"
        >
          Are you sure you want to delete {isDeleting.Name}? This action cannot be undone and will remove their access to the dashboard.
        </ConfirmationModal>
      )}

      {/* ── Role-Change Confirmation ──────────────────────────────────────── */}
      {pendingRoleChange && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base">Reset permissions?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Changing the role to <span className="font-semibold text-foreground">{pendingRoleChange}</span> will
                  replace all custom permissions with that role's defaults.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="ghost" onClick={() => setPendingRoleChange(null)}>Keep current</Button>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmRoleChange}>
                Reset & apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set Password Modal ────────────────────────────────────────────── */}
      {isSettingPassword && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Set Password</h2>
                <p className="text-sm text-muted-foreground">
                  {isSettingPassword.Name} &mdash; {isSettingPassword.Email}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold ml-1">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password (min. 6 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              This will create or update the user's Supabase Auth account so they can sign in with email and password.
            </p>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="ghost"
                onClick={() => { setIsSettingPassword(null); setNewPassword(''); }}
                disabled={isSavingPassword}>
                Cancel
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-white min-w-[120px]"
                onClick={handleSetPassword}
                disabled={isSavingPassword || newPassword.length < 6}
              >
                {isSavingPassword
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
                  : 'Set Password'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 rounded-lg text-brand-600 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold">
                  {isAdding ? 'Create New User' : 'Edit User Profile'}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b shrink-0 px-6">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all
                    ${activeTab === tab.id
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 pt-5 pb-6 min-h-0">

              {/* ── Profile Tab ─────────────────────────────────────── */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold ml-1">Full Name</label>
                    <Input
                      placeholder="John Doe"
                      value={formData.Name || ''}
                      onChange={e => setFormData({ ...formData, Name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold ml-1">Email Address</label>
                    <Input
                      placeholder="john@example.com"
                      value={formData.Email || ''}
                      onChange={e => setFormData({ ...formData, Email: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold ml-1">Role</label>
                      <div className="relative">
                        <select
                          className="w-full h-10 pl-3 pr-8 bg-background border rounded-md appearance-none text-sm"
                          value={formData.Role || 'User'}
                          onChange={e => handleRoleChange(e.target.value)}
                        >
                          {['Admin', 'Manager', 'Sales', 'Finance', 'User'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold ml-1">Status</label>
                      <div className="relative">
                        <select
                          className="w-full h-10 pl-3 pr-8 bg-background border rounded-md appearance-none text-sm"
                          value={formData.Status || 'Active'}
                          onChange={e => setFormData({ ...formData, Status: e.target.value as 'Active' | 'Inactive' })}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold ml-1">Phone 1</label>
                      <Input
                        placeholder="+855 xx xxx xxx"
                        value={formData['Phone 1'] || ''}
                        onChange={e => setFormData({ ...formData, 'Phone 1': e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold ml-1">Phone 2</label>
                      <Input
                        placeholder="+855 xx xxx xxx"
                        value={formData['Phone 2'] || ''}
                        onChange={e => setFormData({ ...formData, 'Phone 2': e.target.value })}
                      />
                    </div>
                  </div>
                  {isAdding && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold ml-1">
                        Password <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={formData.Password || ''}
                        onChange={e => setFormData({ ...formData, Password: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground ml-1">
                        Leave blank — user can sign in via Google or set a password later.
                      </p>
                    </div>
                  )}

                  {/* Quick tip to go to permissions */}
                  <div
                    onClick={() => handleTabChange('permissions')}
                    className="flex items-center gap-2 p-3 rounded-lg border border-brand-200 bg-brand-50 cursor-pointer hover:bg-brand-100 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
                    <p className="text-sm text-brand-700">
                      <span className="font-semibold">Permissions tab</span> — customise exactly what this user can see and do.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Permissions Tab ──────────────────────────────────── */}
              {activeTab === 'permissions' && (
                <PermissionsEditor
                  permissions={formData.permissions ?? getPresetForRole(formData.Role ?? 'User')}
                  role={formData.Role ?? 'User'}
                  onChange={handlePermissionsChange}
                />
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0">
              <Button variant="ghost" onClick={handleCloseModal}>Cancel</Button>
              <Button
                className="bg-brand-600 hover:bg-brand-700 min-w-[120px]"
                onClick={handleSave}
              >
                {isAdding ? 'Create User' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementDashboard;

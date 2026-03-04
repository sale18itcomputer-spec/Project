'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { UserPlus, Search, Edit2, Trash2, Users, KeyRound, Loader2 } from 'lucide-react';
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { createRecord, updateRecord, deleteRecord } from "../../../services/api";
import ConfirmationModal from "../../modals/ConfirmationModal";
import { User as UserType } from "../../../types";
import { useNavigation } from "../../../contexts/NavigationContext";
import { useEffect } from 'react';

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    const isActive = status === 'Active';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${isActive
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            {status}
        </span>
    );
};

const UserManagementDashboard: React.FC = () => {
    const { users: allUsers, isAuthLoading: loading } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleting, setIsDeleting] = useState<UserType | null>(null);
    const [isSettingPassword, setIsSettingPassword] = useState<UserType | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const { addToast } = useToast();
    const { handleNavigation, navigation } = useNavigation();

    const isAdding = navigation.action === 'create';
    const isEditingUser = useMemo(() => {
        if (navigation.action === 'edit' && navigation.id && allUsers) {
            return allUsers.find(u => u.UserID === navigation.id) || null;
        }
        return null;
    }, [navigation.action, navigation.id, allUsers]);

    // Form states
    const [formData, setFormData] = useState<Partial<UserType>>({});

    useEffect(() => {
        if (isEditingUser) setFormData(isEditingUser);
        else if (isAdding && !formData.Role) setFormData({ Role: 'User', Status: 'Active' });
    }, [isEditingUser, isAdding]);

    const handleCloseModal = () => {
        setFormData({});
        handleNavigation({ view: 'users', filter: navigation.filter });
    };

    const filteredUsers = useMemo(() => {
        if (!allUsers) return [];
        return allUsers.filter(user =>
            user.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.Email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.Role.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allUsers, searchQuery]);

    const handleSave = async () => {
        try {
            if (isAdding) {
                const newUserId = `USR-${Date.now()}`;
                await createRecord('Users', {
                    ...formData,
                    UserID: newUserId,
                    Status: 'Active'
                });

                // Also register in Supabase Auth so they can log in with email/password
                if (formData.Email && formData.Password) {
                    const res = await fetch('/api/admin/create-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: formData.Email, password: formData.Password }),
                    });
                    if (!res.ok) {
                        const body = await res.json();
                        // Non-fatal: user is in DB but may not be in Supabase Auth yet
                        addToast(`User saved, but Supabase Auth error: ${body.error}`, "info");
                    } else {
                        addToast("User created successfully with login access", "success");
                    }
                } else {
                    addToast("User created (no password set — they can use Google Sign-In or set a password later)", "success");
                }
            } else if (isEditingUser) {
                await updateRecord('Users', isEditingUser.UserID, formData);
                addToast("User updated successfully", "success");
            }
            window.location.reload();
            handleCloseModal();
        } catch (err) {
            addToast("Failed to save user", "error");
        }
    };

    const handleSetPassword = async () => {
        if (!isSettingPassword?.Email || !newPassword) {
            addToast("Email and new password are required.", "error");
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
                addToast(`Failed: ${body.error}`, "error");
            } else {
                addToast(body.created
                    ? `Supabase Auth account created for ${isSettingPassword.Name}`
                    : `Password updated for ${isSettingPassword.Name}`, "success");
                setIsSettingPassword(null);
                setNewPassword('');
            }
        } catch (err) {
            addToast("Network error setting password", "error");
        } finally {
            setIsSavingPassword(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!isDeleting) return;
        try {
            await deleteRecord('Users', isDeleting.UserID);
            addToast("User deleted successfully", "success");
            window.location.reload();
            setIsDeleting(null);
        } catch (err) {
            addToast("Failed to delete user", "error");
        }
    };

    const openEdit = (user: UserType) => {
        setFormData(user);
        handleNavigation({ view: 'users', filter: navigation.filter, action: 'edit', id: user.UserID });
    };

    const openAdd = () => {
        setFormData({ Role: 'User', Status: 'Active' });
        handleNavigation({ view: 'users', filter: navigation.filter, action: 'create' });
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading users...</div>;

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
            <div className="p-4 lg:p-6 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">User Management</h2>
                    <p className="hidden sm:block text-muted-foreground">Manage application access and roles.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-grow sm:w-64">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground">
                            <Search className="w-4 h-4" />
                        </div>
                        <Input
                            placeholder="Search users..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button onClick={openAdd} className="gap-2 bg-brand-600 hover:bg-brand-700 whitespace-nowrap">
                        <UserPlus className="w-4 h-4" /> <span>Add User</span>
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-4 sm:p-6">
                <div className="rounded-xl border shadow-sm overflow-x-auto horizontal-scroll bg-card h-full">
                    <Table className="min-w-full">
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="sticky left-0 z-20 bg-muted/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] pl-4 sm:pl-6">User</TableHead>
                                <TableHead className="px-3 sm:px-4">Role</TableHead>
                                <TableHead className="px-3 sm:px-4">Email</TableHead>
                                <TableHead className="px-3 sm:px-4">Status</TableHead>
                                <TableHead className="text-right pr-4 sm:pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.UserID} className="hover:bg-muted/30 transition-colors group">
                                        <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] pl-4 sm:pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200 text-sm sm:text-base cursor-default">
                                                    {user.Name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm sm:text-base leading-tight">{user.Name}</div>
                                                    <div className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">#{user.UserID}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3 sm:px-4 py-3 sm:py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                                                {user.Role}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-3 sm:px-4 py-3 sm:py-4 font-medium text-slate-600 text-xs sm:text-sm">
                                            {user.Email || '-'}
                                        </TableCell>
                                        <TableCell className="px-3 sm:px-4 py-3 sm:py-4">
                                            <StatusBadge status={user.Status} />
                                        </TableCell>
                                        <TableCell className="text-right pr-4 sm:pr-6 py-3 sm:py-4">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(user)} className="text-muted-foreground hover:text-brand-600" title="Edit user">
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-amber-600" onClick={() => { setIsSettingPassword(user); setNewPassword(''); }} title="Set password">
                                                    <KeyRound className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-600" onClick={() => setIsDeleting(user)} title="Delete user">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20">
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

            {isSettingPassword && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 border-b pb-4">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                <KeyRound className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">Set Password</h2>
                                <p className="text-sm text-muted-foreground">{isSettingPassword.Name} &mdash; {isSettingPassword.Email}</p>
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
                            <Button variant="ghost" onClick={() => { setIsSettingPassword(null); setNewPassword(''); }} disabled={isSavingPassword}>Cancel</Button>
                            <Button
                                className="bg-amber-500 hover:bg-amber-600 text-white min-w-[120px]"
                                onClick={handleSetPassword}
                                disabled={isSavingPassword || newPassword.length < 6}
                            >
                                {isSavingPassword ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Set Password'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {(isEditingUser || isAdding) && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 border-b pb-4 -mx-2">
                            <div className="p-2 bg-brand-100 rounded-lg text-brand-600">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold">{isAdding ? 'Create New User' : 'Edit User Profile'}</h2>
                        </div>

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
                                    <select
                                        className="w-full h-10 px-3 bg-background border rounded-md"
                                        value={formData.Role || 'User'}
                                        onChange={e => setFormData({ ...formData, Role: e.target.value })}
                                    >
                                        <option value="Admin">Admin</option>
                                        <option value="Manager">Manager</option>
                                        <option value="Sales">Sales</option>
                                        <option value="User">User</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">Status</label>
                                    <select
                                        className="w-full h-10 px-3 bg-background border rounded-md"
                                        value={formData.Status || 'Active'}
                                        onChange={e => setFormData({ ...formData, Status: e.target.value as any })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold ml-1">Password</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.Password || ''}
                                    onChange={e => setFormData({ ...formData, Password: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button variant="ghost" onClick={handleCloseModal}>Cancel</Button>
                            <Button className="bg-brand-600 hover:bg-brand-700 min-w-[100px]" onClick={handleSave}>
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


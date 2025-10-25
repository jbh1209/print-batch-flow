
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Edit, Trash2, RefreshCw, MoreVertical, KeyRound, Mail, Search, X } from "lucide-react";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { UserForm } from "./UserForm";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { UserFormData, UserWithRole } from "@/types/user-types";
import { toast } from "sonner";
import { resetUserPasswordAdmin, sendPasswordResetEmail } from "@/services/passwordService";
import { supabase } from "@/integrations/supabase/client";

interface Division {
  code: string;
  name: string;
  color: string;
}

export const EnhancedUserManagement = () => {
  const { users, isLoading, fetchUsers, createUser, updateUser, deleteUser } = useUserManagement();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<UserWithRole | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');

  useEffect(() => {
    const fetchDivisions = async () => {
      const { data } = await supabase
        .from('divisions')
        .select('code, name, color')
        .eq('is_active', true);
      setDivisions(data || []);
    };
    fetchDivisions();
  }, []);

  const handleCreateUser = async (userData: UserFormData) => {
    await createUser(userData);
    setShowCreateDialog(false);
  };

  const handleUpdateUser = async (userData: UserFormData) => {
    if (!editingUser) return;
    await updateUser(editingUser.id, userData);
    setEditingUser(null);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to remove ${userName}? This action cannot be undone.`)) {
      await deleteUser(userId);
    }
  };

  const handlePasswordReset = async (data: { newPassword: string }) => {
    if (!passwordResetUser) return;
    
    try {
      setActionLoading(`reset-${passwordResetUser.id}`);
      await resetUserPasswordAdmin({
        userId: passwordResetUser.id,
        newPassword: data.newPassword
      });
      toast.success('Password reset successfully');
      setPasswordResetUser(null);
    } catch (error: any) {
      toast.error(`Failed to reset password: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendPasswordResetEmail = async (email: string, userName: string) => {
    try {
      setActionLoading(`email-${email}`);
      await sendPasswordResetEmail(email);
      toast.success(`Password reset email sent to ${userName}`);
    } catch (error: any) {
      toast.error(`Failed to send reset email: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchUsers();
      toast.success('Users refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh users');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'sys_dev': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dtp_operator': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'operator': return 'bg-green-100 text-green-800 border-green-200';
      case 'packaging_operator': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'sys_dev': return 'System Developer';
      case 'dtp_operator': return 'DTP Operator';
      case 'operator': return 'Operator';
      case 'packaging_operator': return 'Packaging Operator';
      case 'manager': return 'Manager';
      case 'admin': return 'Administrator';
      default: return 'User';
    }
  };

  const convertUserToFormData = (user: UserWithRole): UserFormData => {
    return {
      email: user.email,
      full_name: user.full_name,
      role: user.role as any,
      groups: user.groups || [],
      divisions: user.divisions || [],
      primary_division: user.primary_division
    };
  };

  // Filter users based on search query, role filter, and division filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    const matchesDivision = divisionFilter === 'all' || 
      (user.divisions && user.divisions.includes(divisionFilter));
    
    return matchesSearch && matchesRole && matchesDivision;
  });

  const activeFiltersCount = 
    (searchQuery !== '' ? 1 : 0) +
    (roleFilter !== 'all' ? 1 : 0) +
    (divisionFilter !== 'all' ? 1 : 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>User Management ({users.length})</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="sys_dev">System Developer</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="dtp_operator">DTP Operator</SelectItem>
                  <SelectItem value="packaging_operator">Packaging Operator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>

              <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Divisions</SelectItem>
                  {divisions.map((division) => (
                    <SelectItem key={division.code} value={division.code}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active:
                </span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {searchQuery}
                    <button
                      onClick={() => setSearchQuery('')}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {roleFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    Role: {getRoleDisplayName(roleFilter)}
                    <button
                      onClick={() => setRoleFilter('all')}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {divisionFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    Division: {divisions.find(d => d.code === divisionFilter)?.name}
                    <button
                      onClick={() => setDivisionFilter('all')}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('all');
                    setDivisionFilter('all');
                  }}
                  className="h-7"
                >
                  Clear all
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{user.full_name}</h3>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                      {user.divisions && user.divisions.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {user.divisions.map((divCode) => {
                            const division = divisions.find(d => d.code === divCode);
                            const isPrimary = user.primary_division === divCode;
                            return (
                              <Badge 
                                key={divCode}
                                style={{ backgroundColor: division?.color || '#6B7280' }}
                                className="text-white text-xs"
                              >
                                {divCode} {isPrimary && '(Primary)'}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      {user.groups && user.groups.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {user.groups.map((groupId) => (
                            <Badge key={groupId} variant="outline" className="text-xs">
                              Group {groupId.slice(0, 8)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingUser(user)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPasswordResetUser(user)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleSendPasswordResetEmail(user.email, user.full_name)}
                          disabled={actionLoading === `email-${user.email}`}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Send Reset Email
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteUser(user.id, user.full_name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {users.length === 0 
                ? 'No users found. Create your first user to get started.'
                : 'No users match your filters.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <UserForm
            onSubmit={handleCreateUser}
            isEditing={false}
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserForm
              initialData={convertUserToFormData(editingUser)}
              onSubmit={handleUpdateUser}
              isEditing={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!passwordResetUser} onOpenChange={() => setPasswordResetUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password for {passwordResetUser?.full_name}</DialogTitle>
          </DialogHeader>
          {passwordResetUser && (
            <PasswordChangeForm
              onSubmit={handlePasswordReset}
              isCurrentUser={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

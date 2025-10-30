
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserPlus, Edit, Trash2, RefreshCw, MoreVertical, KeyRound, Mail } from "lucide-react";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { UserForm } from "./UserForm";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { UserFormData, UserWithRole } from "@/types/user-types";
import { toast } from "sonner";
import { resetUserPasswordAdmin, sendPasswordResetEmail } from "@/services/passwordService";

export const EnhancedUserManagement = () => {
  const { users, isLoading, fetchUsers, createUser, updateUser, deleteUser } = useUserManagement();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<UserWithRole | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dtp_operator': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'operator': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'dtp_operator': return 'DTP Operator';
      case 'operator': return 'Operator';
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
      groups: user.groups || []
    };
  };

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
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {users.map((user) => (
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
                      {user.groups && user.groups.length > 0 && (
                        <div className="flex gap-1 mt-2">
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

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found. Create your first user to get started.
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

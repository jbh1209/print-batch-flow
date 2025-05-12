
import React, { useState, useEffect, useCallback } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, AlertTriangle, RefreshCw } from "lucide-react";
import { UserForm } from "./UserForm";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { UserFormData, UserWithRole } from "@/types/user-types";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function UserTableContainer() {
  const { users, createUser, updateUser, deleteUser, error: contextError, fetchUsers, isLoading } = useUserManagement();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(contextError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState(0);
  
  // Sync context error to local state
  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);

  // Debounced refresh function
  const handleRefresh = useCallback(async () => {
    // Prevent rapid consecutive refreshes
    const now = Date.now();
    if (now - lastRefreshAttempt < 2000 || isRefreshing) {
      toast.error("Please wait before refreshing again");
      return;
    }
    
    try {
      setIsRefreshing(true);
      setLastRefreshAttempt(now);
      setError(null);
      toast.loading('Refreshing user data...', { duration: 3000 });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to refresh user data");
      toast.error(`Failed to refresh user data: ${err.message || "Unknown error"}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchUsers, isRefreshing, lastRefreshAttempt]);

  const handleAddUser = async (userData: UserFormData) => {
    try {
      setError(null);
      setIsProcessing(true);
      toast.loading('Creating new user...', { duration: 5000 });
      
      await createUser(userData);
      form.reset();
      setDialogOpen(false);
      toast.success(`User ${userData.email} created successfully`);
    } catch (error: any) {
      console.error("Error adding user:", error);
      setError(error.message || "Failed to create user");
      toast.error(`Failed to create user: ${error.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditUser = async (userData: UserFormData) => {
    try {
      if (!editingUser) return;
      setError(null);
      setIsProcessing(true);
      toast.loading('Updating user...', { duration: 5000 });
      
      await updateUser(editingUser.id, userData);
      toast.success(`User ${userData.full_name || editingUser.email} updated successfully`);
      setDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error("Error updating user:", error);
      setError(error.message || "Failed to update user");
      toast.error(`Failed to update user: ${error.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      setError(null);
      toast.loading("Revoking user access...", { duration: 5000 });
      await deleteUser(userId);
      toast.success("User access revoked successfully");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      setError(error.message || "Failed to revoke user access");
      toast.error(`Failed to revoke user access: ${error.message || "Unknown error"}`);
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const openAddUserDialog = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };
  
  // Handle form initialization and reset
  const form = {
    reset: () => {
      setEditingUser(null);
      setDialogOpen(false);
      setError(null);
    }
  };

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{error}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="self-start"
              disabled={isRefreshing}
            >
              {isRefreshing ? <Spinner size={16} className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="flex items-center gap-1"
          disabled={isRefreshing}
        >
          {isRefreshing ? <Spinner size={16} className="mr-1" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Users
        </Button>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setError(null);
            setEditingUser(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddUserDialog} disabled={isProcessing || isLoading}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Edit User' : 'Add New User'}
              </DialogTitle>
            </DialogHeader>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <UserForm 
              initialData={editingUser ? {
                email: editingUser.email,
                full_name: editingUser.full_name || '',
                role: editingUser.role
              } : undefined}
              onSubmit={editingUser ? handleEditUser : handleAddUser}
              isEditing={!!editingUser}
              isProcessing={isProcessing}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <Spinner size={40} />
            <p className="mt-4 text-muted-foreground">Loading user data...</p>
          </div>
        </div>
      ) : (
        <UserTable 
          users={users}
          onEdit={openEditDialog}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  );
}

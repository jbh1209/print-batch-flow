
import React, { useState, useCallback } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { UserFormData, UserWithRole } from "@/types/user-types";
import { toast } from "sonner";
import { useUserManagement } from "@/hooks/useUserManagement";
import { ErrorDisplay } from "./ErrorDisplay";
import { TableControls } from "./TableControls";
import { UserDialogForm } from "./UserDialogForm";
import { LoadingState } from "./LoadingState";

export function UserTableContainer() {
  const { users, createUser, updateUser, deleteUser, error: contextError, fetchUsers, isLoading } = useUserManagement();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(contextError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState(0);
  
  // Sync context error to local state
  React.useEffect(() => {
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

  const handleUserFormSubmit = async (userData: UserFormData) => {
    try {
      setError(null);
      setIsProcessing(true);
      
      if (editingUser) {
        toast.loading('Updating user...', { duration: 5000 });
        await updateUser(editingUser.id, userData);
        toast.success(`User ${userData.full_name || editingUser.email} updated successfully`);
      } else {
        toast.loading('Creating new user...', { duration: 5000 });
        await createUser(userData);
        toast.success(`User ${userData.email} created successfully`);
      }
      
      setDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error("Error processing user:", error);
      setError(error.message || "Failed to process user");
      toast.error(`Failed to process user: ${error.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
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
  
  const handleDeleteUser = async (userId: string) => {
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

  return (
    <div>
      <ErrorDisplay 
        error={error} 
        onRetry={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <TableControls 
        onRefresh={handleRefresh}
        onAddUser={openAddUserDialog}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
        isProcessing={isProcessing}
      />
      
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setError(null);
          setEditingUser(null);
        }
      }}>
        <DialogTrigger asChild>
          <span style={{ display: 'none' }}></span> {/* Hidden trigger, we use the one in TableControls */}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <UserDialogForm 
            onSubmit={handleUserFormSubmit}
            editingUser={editingUser}
            error={error}
            isProcessing={isProcessing}
          />
        </DialogContent>
      </Dialog>
      
      {isLoading ? (
        <LoadingState />
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

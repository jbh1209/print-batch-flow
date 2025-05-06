
import React, { useState } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, AlertTriangle } from "lucide-react";
import { UserForm } from "./UserForm";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { UserFormData, UserWithRole } from "@/types/user-types";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function UserTableContainer() {
  const { users, createUser, updateUser, deleteUser, error: contextError } = useUserManagement();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(contextError);
  
  const handleAddUser = async (userData: UserFormData) => {
    try {
      setError(null);
      setIsProcessing(true);
      toast.loading('Creating new user...');
      await createUser(userData);
      toast.success(`User ${userData.email} created successfully`);
      setDialogOpen(false);
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
      toast.loading('Updating user...');
      
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

  const handleDeleteUser = async (userId: string) => {
    try {
      setError(null);
      toast.loading("Revoking user access...");
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

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end mb-4">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setError(null);
        }}>
          <DialogTrigger asChild>
            <Button onClick={openAddUserDialog}>
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
                full_name: editingUser.full_name,
                role: editingUser.role
              } : undefined}
              onSubmit={editingUser ? handleEditUser : handleAddUser}
              isEditing={!!editingUser}
              isProcessing={isProcessing}
            />
          </DialogContent>
        </Dialog>
      </div>
      <UserTable 
        users={users}
        onEdit={openEditDialog}
        onDelete={handleDeleteUser}
      />
    </div>
  );
}

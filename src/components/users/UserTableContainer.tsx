
import React, { useState } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UserForm } from "./UserForm";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { UserFormData, UserWithRole } from "@/types/user-types";
import { toast } from "sonner";

export function UserTableContainer() {
  const { users, createUser, updateUser, deleteUser } = useUserManagement();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleAddUser = async (userData: UserFormData) => {
    try {
      setIsProcessing(true);
      await createUser(userData);
      setDialogOpen(false);
    } catch (error) {
      console.error("Error adding user:", error);
      // Error handling is done in the context
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditUser = async (userData: UserFormData) => {
    try {
      if (!editingUser) return;
      setIsProcessing(true);
      
      await updateUser(editingUser.id, userData);
      toast.success(`User ${userData.full_name || editingUser.email} updated successfully`);
      setDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(`Failed to update user: ${error.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      toast.loading("Revoking user access...");
      await deleteUser(userId);
    } catch (error) {
      // Error handling is done in the context
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
      <div className="flex justify-end mb-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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

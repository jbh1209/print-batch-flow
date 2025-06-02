
import React, { useState } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UserForm } from "./UserForm";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { UserFormData, UserWithRole, UserRole } from "@/types/user-types";

export function SimpleUserManagement() {
  const { users, createUser, updateUser, deleteUser } = useUserManagement();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  
  const handleAddUser = async (userData: UserFormData) => {
    try {
      await createUser(userData);
      setDialogOpen(false);
    } catch (error) {
      // Error handling is done in the context
    }
  };

  const handleEditUser = async (userData: UserFormData) => {
    try {
      if (!editingUser) return;
      await updateUser(editingUser.id, userData);
      setDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      // Error handling is done in the context
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddUserDialog}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-auto my-8 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Edit User' : 'Add New User'}
              </DialogTitle>
            </DialogHeader>
            <UserForm 
              initialData={editingUser ? {
                email: editingUser.email,
                full_name: editingUser.full_name,
                role: editingUser.role as UserRole
              } : undefined}
              onSubmit={editingUser ? handleEditUser : handleAddUser}
              isEditing={!!editingUser}
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

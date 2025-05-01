
import React, { useState } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UserForm } from "./UserForm";
import { useAuth } from "@/hooks/useAuth";
import { useUserOperations } from "@/hooks/useUserOperations";
import { User, UserFormData } from "@/types/user-types";

interface UserTableContainerProps {
  users: User[];
  userRoles: Record<string, string>;
  isLoading: boolean;
  refreshUsers: () => Promise<void>;
}

export function UserTableContainer({ users, userRoles, isLoading, refreshUsers }: UserTableContainerProps) {
  const { user: currentUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const { 
    processing, 
    addUser, 
    editUser, 
    deleteUser, 
    toggleAdminRole 
  } = useUserOperations(refreshUsers);

  // Handle form submission - either add or edit user
  const handleFormSubmit = async (userData: UserFormData) => {
    if (editingUser) {
      const success = await editUser(
        editingUser.id, 
        userData, 
        userRoles[editingUser.id]
      );
      
      if (success) {
        setDialogOpen(false);
        setEditingUser(null);
      }
    } else {
      const success = await addUser(userData);
      
      if (success) {
        setDialogOpen(false);
      }
    }
  };

  // Open user editing dialog
  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingUser(null)}>
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
                email: editingUser.email || undefined,
                full_name: editingUser.full_name || undefined,
                role: userRoles[editingUser.id] === 'admin' ? 'admin' : 'user'
              } : undefined}
              onSubmit={handleFormSubmit}
              isEditing={!!editingUser}
              isProcessing={processing}
            />
          </DialogContent>
        </Dialog>
      </div>
      <UserTable 
        users={users} 
        userRoles={userRoles}
        onEdit={openEditDialog}
        onDelete={(userId) => deleteUser(userId, currentUser?.id)}
        onRoleToggle={(userId, currentRole) => toggleAdminRole(userId, currentRole, currentUser?.id)}
        currentUserId={currentUser?.id}
        isLoading={isLoading}
      />
    </div>
  );
}

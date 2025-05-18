
import { useState } from "react";
import { UserWithRole } from "@/types/user-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserForm } from "@/components/users/UserForm";
import { UserFormData } from "@/types/user-types";

interface UsersTableProps {
  users: UserWithRole[];
}

export const UsersTable = ({ users }: UsersTableProps) => {
  const { updateUser, deleteUser, addAdminRole } = useUserManagement();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMakeAdmin = async (userId: string) => {
    try {
      await addAdminRole(userId);
      toast.success("Admin role added successfully");
    } catch (err) {
      toast.error("Failed to add admin role");
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to revoke access for ${userName}?`)) {
      try {
        await deleteUser(userId);
        toast.success(`User access revoked successfully`);
      } catch (err) {
        toast.error("Failed to revoke user access");
      }
    }
  };

  const handleEditUser = async (userData: UserFormData) => {
    try {
      if (!editingUser) return;
      setIsProcessing(true);
      toast.loading('Updating user...');
      
      await updateUser(editingUser.id, userData);
      toast.success(`User ${userData.full_name || editingUser.email} updated successfully`);
      setIsDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(`Failed to update user: ${error.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user accounts and permissions
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
            </DialogHeader>
            <UserForm 
              initialData={editingUser ? {
                email: editingUser.email,
                full_name: editingUser.full_name,
                role: editingUser.role
              } : undefined}
              onSubmit={handleEditUser}
              isEditing={!!editingUser}
              isProcessing={isProcessing}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="[&_th]:p-2 [&_th]:text-left [&_th]:font-semibold">
                <th>Name / Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-2">
              {users.map(user => (
                <tr key={user.id} className="border-t">
                  <td className="flex flex-col">
                    <span className="font-medium">{user.full_name || 'Not set'}</span>
                    <span className="text-xs text-gray-500">{user.email}</span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="flex space-x-2">
                    <Button
                      variant="ghost" 
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      Edit
                    </Button>
                    {user.role !== 'admin' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleMakeAdmin(user.id)}
                      >
                        Make Admin
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id, user.full_name || user.email)}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {users.length === 0 && (
            <div className="text-center p-4 text-muted-foreground">
              No users found.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

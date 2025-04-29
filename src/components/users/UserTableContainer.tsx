
import React, { useState } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UserForm } from "./UserForm";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Define User interface explicitly to avoid recursive type issues
interface User {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  last_sign_in_at?: string;
}

// Define FormData interface for better type safety
interface UserFormData {
  email?: string;
  full_name?: string;
  password?: string;
  role?: string;
}

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
  const [processing, setProcessing] = useState(false);
  
  const handleAddUser = async (userData: UserFormData) => {
    setProcessing(true);
    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email)
        .limit(1);
        
      if (existingUsers && existingUsers.length > 0) {
        toast.error('A user with this email already exists');
        setProcessing(false);
        return;
      }
      
      // Sign up the user with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email || '',
        password: userData.password || '',
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: userData.full_name
          }
        }
      });
      
      if (authError) throw authError;
      
      if (authData.user) {
        // Assign role to the new user if not the default user role
        if (userData.role && userData.role !== 'user') {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert([
              { user_id: authData.user.id, role: userData.role }
            ]);
            
          if (roleError) throw roleError;
        }
        
        toast.success('User created successfully');
        setDialogOpen(false);
        await refreshUsers();
      }
    } catch (error: any) {
      toast.error(`Error creating user: ${error.message}`);
      console.error('Error creating user:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditUser = async (userData: UserFormData) => {
    if (!editingUser) return;
    
    setProcessing(true);
    try {
      // Update role if changed
      if (userData.role && userRoles[editingUser.id] !== userData.role) {
        // Delete existing role if present
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editingUser.id);
          
        // Only insert new role if not the default user role
        if (userData.role !== 'user') {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert([
              { user_id: editingUser.id, role: userData.role }
            ]);
            
          if (roleError) throw roleError;
        }
      }
      
      // Update user profile
      if (userData.full_name && userData.full_name !== editingUser.full_name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: userData.full_name })
          .eq('id', editingUser.id);
          
        if (profileError) throw profileError;
      }
      
      toast.success('User updated successfully');
      setDialogOpen(false);
      setEditingUser(null);
      await refreshUsers();
    } catch (error: any) {
      toast.error(`Error updating user: ${error.message}`);
      console.error('Error updating user:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setProcessing(true);
    try {
      // Cannot delete yourself
      if (userId === currentUser?.id) {
        toast.error("You cannot delete your own account");
        return;
      }
      
      // Delete user from auth system
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });
        
      if (error) throw error;
      
      toast.success('User deleted successfully');
      await refreshUsers();
    } catch (error: any) {
      toast.error(`Error deleting user: ${error.message}`);
      console.error('Error deleting user:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleAdminRole = async (userId: string, currentRole: string) => {
    // Prevent updating your own role
    if (userId === currentUser?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    
    setProcessing(true);
    try {
      if (currentRole === 'admin') {
        // Remove admin role (delete from user_roles)
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
          
        if (error) throw error;
        toast.success('Admin role removed successfully');
      } else {
        // Make user an admin
        // First delete any existing roles
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
          
        // Then add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, role: 'admin' }]);
          
        if (error) throw error;
        toast.success('User promoted to admin successfully');
      }
      
      await refreshUsers();
    } catch (error: any) {
      toast.error(`Error changing user role: ${error.message}`);
      console.error('Error changing user role:', error);
    } finally {
      setProcessing(false);
    }
  };

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
                email: editingUser.email,
                full_name: editingUser.full_name,
                role: userRoles[editingUser.id] || 'user'
              } : undefined}
              onSubmit={editingUser ? handleEditUser : handleAddUser}
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
        onDelete={handleDeleteUser}
        onRoleToggle={handleToggleAdminRole}
        currentUserId={currentUser?.id}
        isLoading={isLoading}
      />
    </div>
  );
}

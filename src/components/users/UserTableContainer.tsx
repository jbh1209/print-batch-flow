
import React, { useState } from "react";
import { UserTable } from "./UserTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UserForm } from "./UserForm";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UserTableContainerProps {
  users: any[];
  userRoles: Record<string, string>;
  userProfiles: Record<string, any>;
  refreshUsers: () => Promise<void>;
}

export function UserTableContainer({ users, userRoles, userProfiles, refreshUsers }: UserTableContainerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const handleAddUser = async (userData: any) => {
    try {
      // Sign up the user with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: userData.full_name
          }
        }
      });
      
      if (authError) throw authError;
      
      if (authData.user) {
        // Assign role to the new user
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
    }
  };

  const handleEditUser = async (userData: any) => {
    try {
      if (!editingUser) return;
      
      // Update role if changed
      if (userData.role && userRoles[editingUser.id] !== userData.role) {
        // Delete existing role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editingUser.id);
          
        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: editingUser.id, role: userData.role }
          ]);
          
        if (roleError) throw roleError;
      }
      
      // Update user profile if name changed
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
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // We can't delete users directly using the client API
      // Instead, disable their access by revoking their role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
        
      if (error) throw error;
      
      toast.success('User role revoked successfully');
      await refreshUsers();
    } catch (error: any) {
      toast.error(`Error removing user role: ${error.message}`);
    }
  };

  const openEditDialog = (user: any) => {
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
            />
          </DialogContent>
        </Dialog>
      </div>
      <UserTable 
        users={users} 
        userRoles={userRoles}
        userProfiles={userProfiles}
        onEdit={openEditDialog}
        onDelete={handleDeleteUser}
      />
    </div>
  );
}


import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserFormData } from "@/types/user-types";

export const useUserOperations = (refreshUsers: () => Promise<void>) => {
  const [processing, setProcessing] = useState(false);

  // Handle adding a new user
  const addUser = async (userData: UserFormData) => {
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
        return false;
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
            .insert({
              user_id: authData.user.id, 
              role: userData.role // Direct string without type casting
            });
            
          if (roleError) throw roleError;
        }
        
        toast.success('User created successfully');
        await refreshUsers();
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(`Error creating user: ${error.message}`);
      console.error('Error creating user:', error);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Handle editing an existing user
  const editUser = async (userId: string, userData: UserFormData, currentRole?: string) => {
    setProcessing(true);
    try {
      // Update role if changed
      if (userData.role && currentRole !== userData.role) {
        // Delete existing role if present
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
          
        // Only insert new role if not the default user role
        if (userData.role !== 'user') {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userId, 
              role: userData.role // Direct string without type casting
            });
            
          if (roleError) throw roleError;
        }
      }
      
      // Update user profile
      if (userData.full_name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: userData.full_name })
          .eq('id', userId);
          
        if (profileError) throw profileError;
      }
      
      toast.success('User updated successfully');
      await refreshUsers();
      return true;
    } catch (error: any) {
      toast.error(`Error updating user: ${error.message}`);
      console.error('Error updating user:', error);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Handle deleting a user
  const deleteUser = async (userId: string, currentUserId: string | undefined) => {
    // Cannot delete yourself
    if (userId === currentUserId) {
      toast.error("You cannot delete your own account");
      return false;
    }
    
    setProcessing(true);
    try {
      // Delete user from auth system
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });
        
      if (error) throw error;
      
      toast.success('User deleted successfully');
      await refreshUsers();
      return true;
    } catch (error: any) {
      toast.error(`Error deleting user: ${error.message}`);
      console.error('Error deleting user:', error);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Handle toggling admin role
  const toggleAdminRole = async (userId: string, currentRole: string, currentUserId: string | undefined) => {
    // Prevent updating your own role
    if (userId === currentUserId) {
      toast.error("You cannot change your own role");
      return false;
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
          .insert({
            user_id: userId, 
            role: 'admin' // Direct string instead of type casting
          });
          
        if (error) throw error;
        toast.success('User promoted to admin successfully');
      }
      
      await refreshUsers();
      return true;
    } catch (error: any) {
      toast.error(`Error changing user role: ${error.message}`);
      console.error('Error changing user role:', error);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  return {
    processing,
    addUser,
    editUser,
    deleteUser,
    toggleAdminRole
  };
};

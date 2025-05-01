
import { supabase } from "@/integrations/supabase/client";
import { User, UserFormData } from "@/types/user-types";
import { toast } from "sonner";

/**
 * User service for handling all user-related operations
 */
export const userService = {
  /**
   * Create a new user
   */
  async createUser(userData: UserFormData): Promise<boolean> {
    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email)
        .limit(1);
        
      if (existingUsers && existingUsers.length > 0) {
        toast.error('A user with this email already exists');
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
        // Only assign non-default roles
        if (userData.role && userData.role !== 'user') {
          // Validate the role string
          if (userData.role !== 'admin') {
            throw new Error(`Invalid role: ${userData.role}`);
          }
          
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: authData.user.id, 
              role: userData.role
            });
            
          if (roleError) throw roleError;
        }
        
        toast.success('User created successfully');
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(`Error creating user: ${error.message}`);
      console.error('Error creating user:', error);
      return false;
    }
  },
  
  /**
   * Update an existing user
   */
  async updateUser(userId: string, userData: UserFormData, currentRole?: string): Promise<boolean> {
    try {
      // Update role if changed
      if (userData.role && currentRole !== userData.role) {
        // Validate the role string
        if (userData.role !== 'admin' && userData.role !== 'user') {
          throw new Error(`Invalid role: ${userData.role}`);
        }
        
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
              role: userData.role
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
      return true;
    } catch (error: any) {
      toast.error(`Error updating user: ${error.message}`);
      console.error('Error updating user:', error);
      return false;
    }
  },
  
  /**
   * Delete a user
   */
  async deleteUser(userId: string, currentUserId: string | undefined): Promise<boolean> {
    // Cannot delete yourself
    if (userId === currentUserId) {
      toast.error("You cannot delete your own account");
      return false;
    }
    
    try {
      // Delete user from auth system
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });
        
      if (error) throw error;
      
      toast.success('User deleted successfully');
      return true;
    } catch (error: any) {
      toast.error(`Error deleting user: ${error.message}`);
      console.error('Error deleting user:', error);
      return false;
    }
  },
  
  /**
   * Toggle admin role for a user
   */
  async toggleAdminRole(userId: string, currentRole: string, currentUserId: string | undefined): Promise<boolean> {
    // Prevent updating your own role
    if (userId === currentUserId) {
      toast.error("You cannot change your own role");
      return false;
    }
    
    try {
      // Validate that the new role will be valid
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      if (newRole !== 'admin' && newRole !== 'user') {
        throw new Error(`Invalid role: ${newRole}`);
      }
      
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
            role: 'admin'
          });
          
        if (error) throw error;
        toast.success('User promoted to admin successfully');
      }
      
      return true;
    } catch (error: any) {
      toast.error(`Error changing user role: ${error.message}`);
      console.error('Error changing user role:', error);
      return false;
    }
  }
};

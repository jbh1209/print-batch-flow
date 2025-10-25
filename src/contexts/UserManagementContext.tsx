
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import * as userService from '@/services/userService';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/integrations/supabase/client';

interface UserManagementContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (userData: UserFormData) => Promise<void>;
  updateUser: (userId: string, userData: UserFormData) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

const UserManagementContext = createContext<UserManagementContextType>({
  users: [],
  isLoading: false,
  error: null,
  fetchUsers: async () => {},
  createUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
});

export const UserManagementProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAdminAuth();

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedUsers = await userService.fetchUsers();
      
      // Enhance users with group and division information
      const usersWithGroups = await Promise.all(
        fetchedUsers.map(async (user) => {
          try {
            // Fetch group memberships
            const { data: groupMemberships, error: groupError } = await supabase
              .from('user_group_memberships')
              .select('group_id')
              .eq('user_id', user.id);
            
            if (groupError) {
              console.warn(`Could not fetch groups for user ${user.id}:`, groupError);
            }
            
            // Fetch division assignments
            const { data: divisionAssignments, error: divError } = await supabase
              .from('user_division_assignments')
              .select('division_code, is_primary')
              .eq('user_id', user.id);
            
            if (divError) {
              console.warn(`Could not fetch divisions for user ${user.id}:`, divError);
            }
            
            return {
              ...user,
              groups: groupMemberships?.map(membership => membership.group_id) || [],
              divisions: divisionAssignments?.map(d => d.division_code) || [],
              primary_division: divisionAssignments?.find(d => d.is_primary)?.division_code
            };
          } catch (error) {
            console.warn(`Error fetching data for user ${user.id}:`, error);
            return { ...user, groups: [], divisions: [], primary_division: undefined };
          }
        })
      );
      
      setUsers(usersWithGroups);
      console.log(`✅ Successfully fetched ${usersWithGroups.length} users with group data`);
    } catch (error: any) {
      console.error('❌ Error loading users:', error);
      setError(error.message);
      toast.error(`Error loading users: ${error.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      await userService.createUser(userData);
      toast.success('User created successfully');
      await fetchUsers();
    } catch (error: any) {
      console.error('❌ Error creating user:', error);
      toast.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      await userService.updateUserProfile(userId, userData);
      toast.success('User updated successfully');
      await fetchUsers();
    } catch (error: any) {
      console.error('❌ Error updating user:', error);
      toast.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await userService.revokeUserAccess(userId);
      toast.success('User access revoked successfully');
      await fetchUsers();
    } catch (error: any) {
      console.error('❌ Error removing user:', error);
      toast.error(`Error removing user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  const value = {
    users,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };

  return (
    <UserManagementContext.Provider value={value}>
      {children}
    </UserManagementContext.Provider>
  );
};

export const useUserManagement = () => useContext(UserManagementContext);


import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserWithRole } from '@/types/user-types';
import * as UserService from '@/services/UserService';
import { toast } from 'sonner';

interface UserContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  refetchUsers: () => Promise<void>;
  createUser: (userData: { email: string; password: string; full_name?: string; role?: string }) => Promise<void>;
  updateUser: (userId: string, userData: { full_name?: string; role?: string }) => Promise<void>;
  revokeAccess: (userId: string) => Promise<void>;
  addAdminRole: (userId: string) => Promise<void>;
  checkAdminExists: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType>({
  users: [],
  isLoading: false,
  error: null,
  refetchUsers: async () => {},
  createUser: async () => {},
  updateUser: async () => {},
  revokeAccess: async () => {},
  addAdminRole: async () => {},
  checkAdminExists: async () => false,
});

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin, user } = useAuth();
  
  // Only fetch users if the current user is an admin
  const refetchUsers = useCallback(async (silent = false) => {
    // Skip if not admin
    if (!isAdmin || !user) return;
    
    if (!silent) {
      setIsLoading(true);
    }
    
    setError(null);
    
    try {
      const data = await UserService.fetchUsers(true);
      
      // Sort users by name/email for better UX
      const sortedUsers = [...data].sort((a, b) => {
        const nameA = a.full_name || a.email || '';
        const nameB = b.full_name || b.email || '';
        return nameA.localeCompare(nameB);
      });
      
      setUsers(sortedUsers);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
      
      // Show toast only if not silent refresh
      if (!silent) {
        toast.error(`Error loading users: ${err.message || 'Unknown error'}`);
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [isAdmin, user]);
  
  // Create a new user
  const createUser = async (userData: { 
    email: string; 
    password: string; 
    full_name?: string; 
    role?: string 
  }) => {
    try {
      await UserService.createUser(userData);
      await refetchUsers();
      toast.success(`User ${userData.email} created successfully`);
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast.error(`Failed to create user: ${err.message}`);
      throw err;
    }
  };
  
  // Update a user
  const updateUser = async (userId: string, userData: { 
    full_name?: string; 
    role?: string 
  }) => {
    try {
      await UserService.updateUser(userId, userData);
      await refetchUsers();
      toast.success('User updated successfully');
    } catch (err: any) {
      console.error('Error updating user:', err);
      toast.error(`Failed to update user: ${err.message}`);
      throw err;
    }
  };
  
  // Revoke user access
  const revokeAccess = async (userId: string) => {
    try {
      await UserService.revokeUserAccess(userId);
      await refetchUsers();
      toast.success('User access revoked successfully');
    } catch (err: any) {
      console.error('Error revoking access:', err);
      toast.error(`Failed to revoke user access: ${err.message}`);
      throw err;
    }
  };
  
  // Add admin role
  const addAdminRole = async (userId: string) => {
    try {
      await UserService.addAdminRole(userId);
      await refetchUsers();
      toast.success('Admin role assigned successfully');
    } catch (err: any) {
      console.error('Error setting admin role:', err);
      toast.error(`Failed to assign admin role: ${err.message}`);
      throw err;
    }
  };
  
  // Check if any admin exists
  const checkAdminExists = useCallback(async () => {
    try {
      return await UserService.checkAdminExists();
    } catch (err: any) {
      console.error('Error checking admin existence:', err);
      return false;
    }
  }, []);
  
  // Fetch users when admin status changes
  useEffect(() => {
    if (isAdmin && user) {
      refetchUsers();
    }
  }, [isAdmin, user, refetchUsers]);

  // Set up periodic silent refresh
  useEffect(() => {
    if (!isAdmin) return;
    
    const interval = setInterval(() => {
      refetchUsers(true); // Silent refresh
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [isAdmin, refetchUsers]);
  
  return (
    <UserContext.Provider value={{
      users,
      isLoading,
      error,
      refetchUsers,
      createUser,
      updateUser,
      revokeAccess,
      addAdminRole,
      checkAdminExists
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUsers = () => useContext(UserContext);

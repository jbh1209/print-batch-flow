
import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useAuth } from '@/hooks/useAuth';
import { useUserFetching } from '@/hooks/user/useUserFetching';
import { useUserCreation } from '@/hooks/user/useUserCreation';
import { useUserModification } from '@/hooks/user/useUserModification';
import { useAdminChecks } from '@/hooks/user/useAdminChecks';
import { useLocation } from 'react-router-dom';

interface UserManagementContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  anyAdminExists: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (userData: UserFormData) => Promise<void>;
  updateUser: (userId: string, userData: UserFormData) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  addAdminRole: (userId: string) => Promise<void>;
  checkAdminExists: () => Promise<boolean>;
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined);

// Array of admin-only routes where users data should be loaded ON DEMAND ONLY
const ADMIN_ROUTES = ['/users', '/admin'];

export const UserManagementProvider = ({ children }: { children: ReactNode }) => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const { users, isLoading, error, fetchUsersVoid, setUsers } = useUserFetching();
  const { createUser } = useUserCreation(fetchUsersVoid, setUsers);
  const { updateUser, deleteUser } = useUserModification(fetchUsersVoid);
  const { 
    anyAdminExists, 
    error: adminError, 
    checkAdminExists, 
    addAdminRole, 
    setError 
  } = useAdminChecks(fetchUsersVoid);

  // Track if this is an admin page that needs user data
  const [isAdminPage, setIsAdminPage] = useState(false);
  
  // Determine if current route is an admin page
  useEffect(() => {
    const currentPath = location.pathname;
    const isCurrentPathAdminRoute = ADMIN_ROUTES.some(route => 
      currentPath === route || currentPath.startsWith(`${route}/`)
    );
    setIsAdminPage(isCurrentPathAdminRoute);
  }, [location.pathname]);

  // Sync errors between hooks
  useEffect(() => {
    if (error) {
      setError(error);
    }
  }, [error, setError]);

  // Effect for initial data loading - ONLY CHECK ADMIN EXISTS
  useEffect(() => {
    // Only check admin existence on first mount - no user data loading
    checkAdminExists().catch(console.error);
    
    // IMPORTANT: We're no longer auto-loading users data on all pages
    // Users will only be fetched when explicitly requested
  }, [checkAdminExists]);

  return (
    <UserManagementContext.Provider
      value={{
        users,
        isLoading,
        error: error || adminError,
        anyAdminExists,
        fetchUsers: fetchUsersVoid,
        createUser,
        updateUser,
        deleteUser,
        checkAdminExists,
        addAdminRole,
      }}
    >
      {children}
    </UserManagementContext.Provider>
  );
};

export const useUserManagement = () => {
  const context = useContext(UserManagementContext);
  if (context === undefined) {
    throw new Error('useUserManagement must be used within a UserManagementProvider');
  }
  return context;
};

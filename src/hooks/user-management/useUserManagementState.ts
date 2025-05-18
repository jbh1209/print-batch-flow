
import { useState } from 'react';
import { UserWithRole } from '@/types/user-types';

/**
 * Hook for managing user management state
 */
export function useUserManagementState() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  
  return {
    users,
    setUsers,
    isLoading,
    setIsLoading,
    error,
    setError,
    anyAdminExists, 
    setAnyAdminExists
  };
}

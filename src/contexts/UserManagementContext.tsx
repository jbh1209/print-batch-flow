
// This file re-exports the user management context components and hooks
// for backward compatibility
import { 
  UserManagementContext,
  UserManagementProvider 
} from '@/providers/UserManagementProvider';
import { useUserManagementContext } from '@/hooks/useUserManagementContext';

// Re-export the hook as useUserManagement for backward compatibility
export const useUserManagement = useUserManagementContext;

// Re-export the provider and context
export { UserManagementContext, UserManagementProvider };

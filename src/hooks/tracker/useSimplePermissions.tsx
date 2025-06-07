
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/tracker/useUserRole";

export interface SimplePermissions {
  canViewJobs: boolean;
  canEditJobs: boolean;
  canWorkOnJobs: boolean;
  canManageJobs: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isManager: boolean;
  accessibleStageNames: string[];
}

export const useSimplePermissions = () => {
  const { user } = useAuth();
  const { userRole, isLoading, isOperator, isAdmin, isManager } = useUserRole();
  const [permissions, setPermissions] = useState<SimplePermissions>({
    canViewJobs: false,
    canEditJobs: false,
    canWorkOnJobs: false,
    canManageJobs: false,
    isAdmin: false,
    isOperator: false,
    isManager: false,
    accessibleStageNames: []
  });

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    // Simplified permission logic - much cleaner than before
    const newPermissions: SimplePermissions = {
      canViewJobs: true, // Everyone can view jobs
      canEditJobs: isAdmin || isManager,
      canWorkOnJobs: true, // Everyone can work on jobs they have access to
      canManageJobs: isAdmin || isManager,
      isAdmin,
      isOperator,
      isManager,
      accessibleStageNames: getAccessibleStageNames(userRole)
    };

    setPermissions(newPermissions);
  }, [user, userRole, isLoading, isAdmin, isOperator, isManager]);

  return {
    permissions,
    isLoading
  };
};

// Simplified stage access - based on user role patterns
function getAccessibleStageNames(userRole: string | null): string[] {
  if (!userRole) return [];

  const role = userRole.toLowerCase();
  
  // DTP operators get DTP-related stages
  if (role.includes('dtp') || role.includes('design') || role.includes('artwork')) {
    return ['dtp', 'design', 'artwork', 'proof', 'pre-press', 'digital'];
  }
  
  // Print operators get print-related stages
  if (role.includes('print') || role.includes('production')) {
    return ['print', 'production', 'finishing', 'cutting', 'folding'];
  }
  
  // Finishing operators get finishing stages
  if (role.includes('finish') || role.includes('binding')) {
    return ['finishing', 'cutting', 'folding', 'binding', 'laminating'];
  }
  
  // Default: give access to common stages
  return ['dtp', 'proof', 'print', 'finishing'];
}

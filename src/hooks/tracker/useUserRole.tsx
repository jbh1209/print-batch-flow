
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Represents the available user roles in the system
 */
export type UserRole = 'admin' | 'manager' | 'operator' | 'dtp_operator' | 'user';

/**
 * Response from the useUserRole hook
 */
export interface UserRoleResponse {
  /** The current user's role */
  userRole: UserRole;
  /** Whether the role data is still loading */
  isLoading: boolean;
  /** Whether the user is an admin */
  isAdmin: boolean;
  /** Whether the user is a manager (or admin) */
  isManager: boolean;
  /** Whether the user is any type of operator */
  isOperator: boolean;
  /** Whether the user is specifically a DTP operator */
  isDtpOperator: boolean;
  /** List of stages the user has access to */
  accessibleStages: Array<{
    stage_id: string;
    stage_name: string;
    stage_color: string;
    can_view: boolean;
    can_edit: boolean;
    can_work: boolean;
    can_manage: boolean;
  }>;
}

/**
 * Hook to determine the current user's role in the system
 * @returns UserRoleResponse object containing role information
 */
export const useUserRole = (): UserRoleResponse => {
  const { user } = useAuth();
  const { accessibleStages, isLoading: stagesLoading } = useUserStagePermissions();
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const determineUserRole = async () => {
      if (!user?.id || stagesLoading) return;

      try {
        // Check for admin role first - this takes precedence over all other roles
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        const hasAdminRole = userRoles?.some(r => r.role === 'admin');
        if (hasAdminRole) {
          setUserRole('admin');
          setIsLoading(false);
          return;
        }

        // Check group memberships for manager role
        const { data: groupMemberships, error: groupError } = await supabase
          .from('user_group_memberships')
          .select(`
            user_groups!inner(name, description)
          `)
          .eq('user_id', user.id);

        if (groupError) throw groupError;

        // Check for manager role in group names or descriptions
        const isManager = groupMemberships?.some(m => {
          const groupName = m.user_groups?.name?.toLowerCase() || '';
          const groupDesc = m.user_groups?.description?.toLowerCase() || '';
          
          return groupName.includes('manager') || 
                 groupName.includes('supervisor') ||
                 groupDesc.includes('manager role') ||
                 groupDesc.includes('supervisor role');
        });

        if (isManager) {
          setUserRole('manager');
          setIsLoading(false);
          return;
        }

        // ENHANCED: More precise DTP operator detection based on accessible stages
        // Calculate user's workable DTP stages and total workable stages
        const dtpRelatedStages = accessibleStages.filter(stage => {
          const stageName = stage.stage_name.toLowerCase();
          return stageName.includes('dtp') || 
                 stageName.includes('digital') ||
                 stageName.includes('proof') ||
                 stageName.includes('pre-press') ||
                 stageName.includes('design') ||
                 stageName.includes('artwork');
        });

        const workableStages = accessibleStages.filter(stage => stage.can_work);
        const workableDtpStages = dtpRelatedStages.filter(stage => stage.can_work);
        
        // Log detailed information for debugging purposes
        console.log('🧑‍💻 User role determination:', {
          userId: user.id,
          totalStages: accessibleStages.length,
          workableStages: workableStages.length,
          dtpStages: dtpRelatedStages.length,
          workableDtpStages: workableDtpStages.length,
          stageNames: workableStages.map(s => s.stage_name)
        });
        
        // Primary criteria: User is considered a DTP operator if they have workable
        // DTP-related stages and at least half of their workable stages are DTP-related
        if (workableDtpStages.length > 0) {
          const dtpRatio = workableDtpStages.length / workableStages.length;
          
          if (dtpRatio >= 0.5) {
            setUserRole('dtp_operator');
          } else if (workableStages.length > 0) {
            setUserRole('operator');
          } else {
            setUserRole('user');
          }
        } else if (workableStages.length > 0) {
          setUserRole('operator');
        } else {
          setUserRole('user');
        }
      } catch (error) {
        console.error('Error determining user role:', error);
        setUserRole('user');
      } finally {
        setIsLoading(false);
      }
    };

    determineUserRole();
  }, [user?.id, accessibleStages, stagesLoading]);

  // Derived properties for convenient access
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || userRole === 'admin';
  const isOperator = userRole === 'operator' || userRole === 'dtp_operator' || isManager;
  const isDtpOperator = userRole === 'dtp_operator';

  return {
    userRole,
    isLoading,
    isAdmin,
    isManager,
    isOperator,
    isDtpOperator,
    accessibleStages
  };
};

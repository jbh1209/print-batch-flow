
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  /** Whether the user is any type of operator (but NOT admin/manager) */
  isOperator: boolean;
  /** Whether the user is specifically a DTP operator */
  isDtpOperator: boolean;
  /** List of stages the user has access to - based on actual group memberships, not admin overrides */
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
  const { user, loading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isLoading, setIsLoading] = useState(true);
  const [accessibleStages, setAccessibleStages] = useState<Array<{
    stage_id: string;
    stage_name: string;
    stage_color: string;
    can_view: boolean;
    can_edit: boolean;
    can_work: boolean;
    can_manage: boolean;
  }>>([]);

  useEffect(() => {
    const determineUserRole = async () => {
      // Wait for auth to complete first
      if (authLoading) {
        return;
      }

      if (!user?.id) {
        setUserRole('user');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Check for admin role first - this takes precedence over all other roles
        const { data: userRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (roleError) {
          console.warn('⚠️ Error fetching user roles, defaulting to user role:', roleError);
          setUserRole('user');
          setIsLoading(false);
          return;
        }

        const hasAdminRole = userRoles?.some(r => r.role === 'admin');
        if (hasAdminRole) {
          setUserRole('admin');
          setAccessibleStages([]);
          setIsLoading(false);
          return;
        }

        // Get user's group memberships and stage permissions
        const { data: groupMemberships, error: groupError } = await supabase
          .from('user_group_memberships')
          .select(`
            user_groups!inner(name, description)
          `)
          .eq('user_id', user.id);

        if (groupError) {
          console.warn('⚠️ Error fetching group memberships, defaulting to user role:', groupError);
          setUserRole('user');
          setIsLoading(false);
          return;
        }

        // Get their ACTUAL group-based permissions (not admin overrides)
        const { data: actualStages, error: stagesError } = await supabase.rpc('get_user_accessible_stages', {
          p_user_id: user.id
        });

        if (stagesError) {
          console.warn('⚠️ Error fetching accessible stages:', stagesError);
          // Continue with group-based role detection even if stages fail
        }

        const normalizedStages = (actualStages || []).map((stage: any) => ({
          stage_id: stage.stage_id,
          stage_name: stage.stage_name,
          stage_color: stage.stage_color,
          can_view: stage.can_view,
          can_edit: stage.can_edit,
          can_work: stage.can_work,
          can_manage: stage.can_manage
        }));

        setAccessibleStages(normalizedStages);

        // Enhanced role detection logic with fallbacks
        const groupNames = groupMemberships?.map(m => m.user_groups?.name?.toLowerCase() || '') || [];
        const groupDescriptions = groupMemberships?.map(m => m.user_groups?.description?.toLowerCase() || '') || [];

        // Check for manager role in group names or descriptions
        const isManager = groupNames.some(name => 
          name.includes('manager') || 
          name.includes('supervisor') || 
          name.includes('admin')
        ) || groupDescriptions.some(desc => 
          desc.includes('manager') || 
          desc.includes('supervisor')
        );

        if (isManager) {
          setUserRole('manager');
          setIsLoading(false);
          return;
        }

        // Enhanced operator detection - check both group names and workable stages
        const workableStages = normalizedStages.filter(stage => stage.can_work);
        const dtpRelatedStages = workableStages.filter(stage => {
          const stageName = stage.stage_name.toLowerCase();
          return stageName.includes('dtp') || 
                 stageName.includes('digital') ||
                 stageName.includes('proof') ||
                 stageName.includes('pre-press') ||
                 stageName.includes('design') ||
                 stageName.includes('artwork');
        });

        const printingRelatedStages = workableStages.filter(stage => {
          const stageName = stage.stage_name.toLowerCase();
          return stageName.includes('print') ||
                 stageName.includes('hp') ||
                 stageName.includes('press') ||
                 stageName.includes('production');
        });

        // Check if user is in operator-related groups
        const isInOperatorGroup = groupNames.some(name => 
          name.includes('operator') || 
          name.includes('printing') || 
          name.includes('dtp') || 
          name.includes('production')
        );

        // Role determination with enhanced logic and fallbacks
        if (dtpRelatedStages.length > 0 && (dtpRelatedStages.length >= printingRelatedStages.length || groupNames.includes('dtp'))) {
          setUserRole('dtp_operator');
        } else if (workableStages.length > 0 || isInOperatorGroup) {
          setUserRole('operator');
        } else {
          setUserRole('user');
        }

      } catch (error) {
        console.error('❌ Error determining user role:', error);
        // Fallback to safe default
        setUserRole('user');
      } finally {
        setIsLoading(false);
      }
    };

    determineUserRole();
  }, [user?.id, authLoading]);

  // Derived properties for convenient access
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || userRole === 'admin';
  // IMPORTANT: isOperator should NOT include admin/manager - only actual operators
  const isOperator = userRole === 'operator' || userRole === 'dtp_operator';
  const isDtpOperator = userRole === 'dtp_operator';

  return {
    userRole,
    isLoading: authLoading || isLoading, // Include auth loading state
    isAdmin,
    isManager,
    isOperator,
    isDtpOperator,
    accessibleStages
  };
};

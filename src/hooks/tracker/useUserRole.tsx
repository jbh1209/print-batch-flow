
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
  const { user } = useAuth();
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
      if (!user?.id) return;

      try {
        // Check for admin role first - this takes precedence over all other roles
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        const hasAdminRole = userRoles?.some(r => r.role === 'admin');
        if (hasAdminRole) {
          console.log('🔑 User determined as admin');
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

        if (groupError) throw groupError;

        // Get their ACTUAL group-based permissions (not admin overrides)
        const { data: actualStages, error: stagesError } = await supabase.rpc('get_user_accessible_stages', {
          p_user_id: user.id
        });

        if (stagesError) throw stagesError;

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

        // Enhanced role detection logic
        const groupNames = groupMemberships?.map(m => m.user_groups?.name?.toLowerCase() || '') || [];
        const groupDescriptions = groupMemberships?.map(m => m.user_groups?.description?.toLowerCase() || '') || [];
        
        console.log('🔍 User group analysis:', {
          userId: user.id,
          groupNames,
          groupDescriptions,
          totalStages: normalizedStages.length,
          workableStages: normalizedStages.filter(s => s.can_work).length
        });

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
          console.log('🔑 User determined as manager');
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

        console.log('🧑‍💻 Enhanced operator analysis:', {
          workableStages: workableStages.length,
          dtpStages: dtpRelatedStages.length,
          printingStages: printingRelatedStages.length,
          isInOperatorGroup,
          stageNames: workableStages.map(s => s.stage_name)
        });

        // Role determination with enhanced logic
        if (dtpRelatedStages.length > 0 && (dtpRelatedStages.length >= printingRelatedStages.length || groupNames.includes('dtp'))) {
          console.log('🔑 User determined as dtp_operator');
          setUserRole('dtp_operator');
        } else if (workableStages.length > 0 || isInOperatorGroup) {
          console.log('🔑 User determined as operator');
          setUserRole('operator');
        } else {
          console.log('🔑 User determined as user');
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
  }, [user?.id]);

  // Derived properties for convenient access
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || userRole === 'admin';
  // IMPORTANT: isOperator should NOT include admin/manager - only actual operators
  const isOperator = userRole === 'operator' || userRole === 'dtp_operator';
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


import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'manager' | 'operator' | 'dtp_operator' | 'user';

export const useUserRole = () => {
  const { user } = useAuth();
  const { accessibleStages, isLoading: stagesLoading } = useUserStagePermissions();
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const determineUserRole = async () => {
      if (!user?.id || stagesLoading) return;

      try {
        // Check for admin role first
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
            user_groups!inner(name)
          `)
          .eq('user_id', user.id);

        if (groupError) throw groupError;

        const isManager = groupMemberships?.some(m => 
          m.user_groups?.name?.toLowerCase().includes('manager') || 
          m.user_groups?.name?.toLowerCase().includes('supervisor')
        );

        if (isManager) {
          setUserRole('manager');
          setIsLoading(false);
          return;
        }

        // Determine operator type based on accessible stages
        const dtpStages = accessibleStages.filter(stage => 
          stage.stage_name.toLowerCase().includes('dtp') || 
          stage.stage_name.toLowerCase().includes('proof')
        );

        const canWorkStages = accessibleStages.filter(stage => stage.can_work);

        if (dtpStages.length > 0 && canWorkStages.length <= 3) {
          setUserRole('dtp_operator');
        } else if (canWorkStages.length > 0) {
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

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager' || userRole === 'admin';
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

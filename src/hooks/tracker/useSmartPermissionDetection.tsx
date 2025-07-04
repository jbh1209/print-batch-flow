
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PermissionType = 'view' | 'edit' | 'work' | 'manage';

export const useSmartPermissionDetection = () => {
  const { user } = useAuth();
  const [highestPermission, setHighestPermission] = useState<PermissionType>('view');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectHighestPermission = async () => {
      if (!user?.id) {
        setHighestPermission('view');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Check if user is admin first - admins get 'manage' permission
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        if (adminCheck?.role === 'admin') {
          console.log('👑 Admin user detected - highest permission: manage');
          setHighestPermission('manage');
          setIsLoading(false);
          return;
        }

        // For non-admin users, get their stage permissions and find the highest level
        const { data: permissions, error } = await supabase.rpc('get_user_accessible_stages', {
          p_user_id: user.id
        });

        if (error) {
          console.error('Error fetching user permissions:', error);
          setHighestPermission('view');
          setIsLoading(false);
          return;
        }

        if (!permissions || permissions.length === 0) {
          console.log('No permissions found - defaulting to view');
          setHighestPermission('view');
          setIsLoading(false);
          return;
        }

        // Find the highest permission level across all accessible stages
        let highest: PermissionType = 'view';

        for (const perm of permissions) {
          if (perm.can_manage) {
            highest = 'manage';
            break; // 'manage' is the highest, no need to check further
          } else if (perm.can_work) {
            highest = 'work';
          } else if (perm.can_edit && highest === 'view') {
            highest = 'edit';
          }
        }

        console.log('🎯 Smart permission detection result:', {
          userId: user.id,
          totalStages: permissions.length,
          highestPermission: highest,
          permissionBreakdown: {
            manage: permissions.filter(p => p.can_manage).length,
            work: permissions.filter(p => p.can_work).length,
            edit: permissions.filter(p => p.can_edit).length,
            view: permissions.filter(p => p.can_view).length
          }
        });

        setHighestPermission(highest);
      } catch (error) {
        console.error('Error in smart permission detection:', error);
        setHighestPermission('view');
      } finally {
        setIsLoading(false);
      }
    };

    detectHighestPermission();
  }, [user?.id]);

  return {
    highestPermission,
    isLoading
  };
};

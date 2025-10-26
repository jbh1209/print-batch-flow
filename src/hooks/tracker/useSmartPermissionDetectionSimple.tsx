
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PermissionType = 'view' | 'edit' | 'work' | 'manage';

export const useSmartPermissionDetectionSimple = () => {
  const { user } = useAuth();
  const [highestPermission, setHighestPermission] = useState<PermissionType>('work');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectPermission = async () => {
      if (!user?.id) {
        setHighestPermission('view');
        setIsLoading(false);
        return;
      }

      try {
        // Check if admin first
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'sys_dev'])
          .single();

        if (adminCheck?.role === 'admin' || adminCheck?.role === 'sys_dev') {
          console.log('👑 Admin user - using manage permission');
          setHighestPermission('manage');
          setIsLoading(false);
          return;
        }

        // For non-admin, use 'work' as default
        // The database function will handle the actual permission checking
        console.log('👤 Regular user - using work permission');
        setHighestPermission('work');
      } catch (error) {
        console.error('Error detecting permission:', error);
        setHighestPermission('work');
      } finally {
        setIsLoading(false);
      }
    };

    detectPermission();
  }, [user?.id]);

  return {
    highestPermission,
    isLoading
  };
};

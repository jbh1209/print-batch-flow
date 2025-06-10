
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserStagePermission {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

export const useUserStagePermissions = (userId?: string) => {
  const [accessibleStages, setAccessibleStages] = useState<UserStagePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!userId) {
        setAccessibleStages([]);
        setIsLoading(false);
        setIsAdmin(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // First check if user is admin
        const { data: adminCheck, error: adminError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();

        const userIsAdmin = !adminError && adminCheck?.role === 'admin';
        setIsAdmin(userIsAdmin);

        console.log("🔍 User permissions check:", {
          userId,
          userIsAdmin,
          adminCheck,
          adminError
        });

        if (userIsAdmin) {
          // Admin gets access to ALL stages
          const { data: allStages, error: stagesError } = await supabase
            .from('production_stages')
            .select('id, name, color')
            .eq('is_active', true)
            .order('order_index');

          if (stagesError) throw stagesError;

          const adminStages = (allStages || []).map(stage => ({
            stage_id: stage.id,
            stage_name: stage.name,
            stage_color: stage.color,
            can_view: true,
            can_edit: true,
            can_work: true,
            can_manage: true
          }));

          console.log("👑 Admin permissions - all stages accessible:", adminStages.length);
          setAccessibleStages(adminStages);
        } else {
          // Regular user - use existing permission system
          const { data, error } = await supabase.rpc('get_user_accessible_stages', {
            p_user_id: userId
          });

          if (error) throw error;

          const stages = (data || []).map((stage: any) => ({
            stage_id: stage.stage_id,
            stage_name: stage.stage_name,
            stage_color: stage.stage_color,
            can_view: stage.can_view,
            can_edit: stage.can_edit,
            can_work: stage.can_work,
            can_manage: stage.can_manage
          }));

          console.log("👤 Regular user permissions:", stages.length);
          setAccessibleStages(stages);
        }
      } catch (err) {
        console.error('Error fetching user permissions:', err);
        setError(err instanceof Error ? err.message : "Failed to load permissions");
        setAccessibleStages([]);
        toast.error("Failed to load user permissions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPermissions();
  }, [userId]);

  return {
    accessibleStages,
    isLoading,
    error,
    isAdmin
  };
};

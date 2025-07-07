import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { consolidateStagesByMasterQueue, ConsolidatedStage, getAllIndividualStages, UserStagePermission } from "@/utils/tracker/stageConsolidation";

export { type UserStagePermission } from "@/utils/tracker/stageConsolidation";

export const useUserStagePermissions = (userId?: string) => {
  const [accessibleStages, setAccessibleStages] = useState<UserStagePermission[]>([]);
  const [consolidatedStages, setConsolidatedStages] = useState<ConsolidatedStage[]>([]);
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

        let rawStages: UserStagePermission[] = [];

        if (userIsAdmin) {
          // Admin gets access to ALL stages - but this is for ADMIN functionality only
          const { data: allStages, error: stagesError } = await supabase
            .from('production_stages')
            .select(`
              id, 
              name, 
              color
            `)
            .eq('is_active', true)
            .order('order_index');

          if (stagesError) throw stagesError;

          rawStages = (allStages || []).map(stage => ({
            stage_id: stage.id,
            stage_name: stage.name,
            stage_color: stage.color,
            can_view: true,
            can_edit: true,
            can_work: true,
            can_manage: true
          }));

          console.log("👑 Admin permissions - all stages accessible:", rawStages.length);
        } else {
          // Regular user - try new function first, fallback to old one
          try {
            const { data, error } = await supabase.rpc('get_user_accessible_stages', {
              p_user_id: userId
            });

            if (error) throw error;

            rawStages = (data || []).map((stage: any) => ({
              stage_id: stage.stage_id,
              stage_name: stage.stage_name,
              stage_color: stage.stage_color,
              can_view: stage.can_view,
              can_edit: stage.can_edit,
              can_work: stage.can_work,
              can_manage: stage.can_manage,
              master_queue_id: stage.master_queue_id || undefined,
              master_queue_name: stage.master_queue_name || undefined
            }));

            console.log("👤 Regular user permissions:", rawStages.length);
          } catch (rpcError) {
            console.warn("New function not available, falling back to old function:", rpcError);
            
            // Fallback to original function
            const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_user_accessible_stages', {
              p_user_id: userId
            });

            if (fallbackError) throw fallbackError;

            rawStages = (fallbackData || []).map((stage: any) => ({
              stage_id: stage.stage_id,
              stage_name: stage.stage_name,
              stage_color: stage.stage_color,
              can_view: stage.can_view,
              can_edit: stage.can_edit,
              can_work: stage.can_work,
              can_manage: stage.can_manage,
              master_queue_id: undefined,
              master_queue_name: undefined
            }));

            console.log("👤 Regular user permissions (fallback):", rawStages.length);
          }
        }

        // Set raw stages for admin use or backwards compatibility
        setAccessibleStages(rawStages);
        
        // Create consolidated stages for operator UI
        const consolidated = consolidateStagesByMasterQueue(rawStages);
        setConsolidatedStages(consolidated);
        
        console.log("🔄 Stage consolidation results:", {
          rawStages: rawStages.length,
          consolidatedStages: consolidated.length,
          masterQueues: consolidated.filter(s => s.is_master_queue).length,
          standaloneStages: consolidated.filter(s => !s.is_master_queue).length
        });

      } catch (err) {
        console.error('Error fetching user permissions:', err);
        setError(err instanceof Error ? err.message : "Failed to load permissions");
        setAccessibleStages([]);
        setConsolidatedStages([]);
        toast.error("Failed to load user permissions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPermissions();
  }, [userId]);

  return {
    accessibleStages, // Raw stages for admin/backwards compatibility
    consolidatedStages, // Consolidated stages for operator UI
    isLoading,
    error,
    isAdmin
  };
};

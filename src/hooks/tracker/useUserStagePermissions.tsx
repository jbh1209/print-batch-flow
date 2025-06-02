
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserStageAccess {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

export const useUserStagePermissions = (userId?: string) => {
  const [accessibleStages, setAccessibleStages] = useState<UserStageAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserStageAccess = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .rpc('get_user_accessible_stages', { 
          p_user_id: userId || undefined 
        });

      if (fetchError) {
        console.error('Error fetching user stage access:', fetchError);
        throw new Error(`Failed to fetch stage access: ${fetchError.message}`);
      }

      setAccessibleStages(data || []);
    } catch (err) {
      console.error('Error in fetchUserStageAccess:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible stages";
      setError(errorMessage);
      toast.error("Failed to load accessible stages");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStageAccess();
  }, [userId]);

  const canViewStage = (stageId: string): boolean => {
    const access = accessibleStages.find(s => s.stage_id === stageId);
    return access?.can_view || false;
  };

  const canEditStage = (stageId: string): boolean => {
    const access = accessibleStages.find(s => s.stage_id === stageId);
    return access?.can_edit || false;
  };

  const canWorkWithStage = (stageId: string): boolean => {
    const access = accessibleStages.find(s => s.stage_id === stageId);
    return access?.can_work || false;
  };

  const canManageStage = (stageId: string): boolean => {
    const access = accessibleStages.find(s => s.stage_id === stageId);
    return access?.can_manage || false;
  };

  const getStagePermissions = (stageId: string) => {
    const access = accessibleStages.find(s => s.stage_id === stageId);
    return {
      canView: access?.can_view || false,
      canEdit: access?.can_edit || false,
      canWork: access?.can_work || false,
      canManage: access?.can_manage || false
    };
  };

  return {
    accessibleStages,
    isLoading,
    error,
    canViewStage,
    canEditStage,
    canWorkWithStage,
    canManageStage,
    getStagePermissions,
    refreshAccess: fetchUserStageAccess
  };
};

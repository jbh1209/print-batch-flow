
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StagePermission } from "./useGroupStageData";

export const usePermissionOperations = () => {
  const [isSaving, setIsSaving] = useState(false);

  const savePermission = async (
    groupId: string,
    stageId: string,
    field: keyof Omit<StagePermission, 'id' | 'user_group_id' | 'production_stage_id'>,
    value: boolean
  ) => {
    try {
      setIsSaving(true);

      // First, check if a record exists
      const { data: existing } = await supabase
        .from('user_group_stage_permissions')
        .select('*')
        .eq('user_group_id', groupId)
        .eq('production_stage_id', stageId)
        .maybeSingle();

      if (existing) {
        // Update existing record - only update the specific field
        const { error } = await supabase
          .from('user_group_stage_permissions')
          .update({ 
            [field]: value,
            updated_at: new Date().toISOString()
          })
          .eq('user_group_id', groupId)
          .eq('production_stage_id', stageId);

        if (error) throw error;
      } else {
        // Create new record with only the specified field set to true, others false
        const newPermission = {
          user_group_id: groupId,
          production_stage_id: stageId,
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false,
          can_work: field === 'can_work' ? value : false,
          can_manage: field === 'can_manage' ? value : false,
        };

        const { error } = await supabase
          .from('user_group_stage_permissions')
          .insert(newPermission);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error saving permission:', error);
      toast.error('Failed to save permission');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    savePermission,
    isSaving
  };
};

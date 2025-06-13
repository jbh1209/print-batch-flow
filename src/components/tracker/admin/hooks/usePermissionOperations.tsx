
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

      // Use upsert to handle both new and existing permissions
      const { error } = await supabase
        .from('user_group_stage_permissions')
        .upsert({
          user_group_id: groupId,
          production_stage_id: stageId,
          [field]: value,
          // Set other permissions to false if this is a new record
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false,
          can_work: field === 'can_work' ? value : false,
          can_manage: field === 'can_manage' ? value : false,
        }, {
          onConflict: 'user_group_id,production_stage_id',
          ignoreDuplicates: false
        });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error saving permission:', error);
      toast.error('Failed to save permission');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const bulkSavePermissions = async (permissions: StagePermission[]) => {
    try {
      setIsSaving(true);
      console.log('Starting bulk save process...');

      if (permissions.length === 0) {
        return true;
      }

      // Filter and validate permissions to save
      const validPermissions = permissions.filter(p => {
        const hasPermission = p.can_view || p.can_edit || p.can_work || p.can_manage;
        const isValid = p.user_group_id && 
                       p.production_stage_id && 
                       typeof p.can_view === 'boolean' &&
                       typeof p.can_edit === 'boolean' &&
                       typeof p.can_work === 'boolean' &&
                       typeof p.can_manage === 'boolean';

        return hasPermission && isValid;
      }).map(p => {
        const { id, ...permissionWithoutId } = p;
        return permissionWithoutId;
      });

      console.log(`Saving ${validPermissions.length} valid permissions...`);

      // Save permissions in smaller batches
      if (validPermissions.length > 0) {
        const batchSize = 10;
        
        for (let i = 0; i < validPermissions.length; i += batchSize) {
          const batch = validPermissions.slice(i, i + batchSize);
          
          const { error: insertError } = await supabase
            .from('user_group_stage_permissions')
            .upsert(batch, {
              onConflict: 'user_group_id,production_stage_id',
              ignoreDuplicates: false
            });

          if (insertError) {
            console.error('Insert failed:', insertError);
            throw new Error(`Failed to save permissions batch: ${insertError.message}`);
          }
        }
      }

      console.log('Bulk save completed successfully');
      toast.success(`Successfully saved ${validPermissions.length} permission assignments`);
      return true;
      
    } catch (error) {
      console.error('Bulk save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to save permissions: ${errorMessage}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    savePermission,
    bulkSavePermissions,
    isSaving
  };
};


import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserGroup {
  id: string;
  name: string;
  description: string;
}

interface ProductionStage {
  id: string;
  name: string;
  color: string;
  master_queue_id?: string;
  master_queue_name?: string;
}

interface StagePermission {
  id?: string; // Make ID optional for new records
  user_group_id: string;
  production_stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

export const useGroupStagePermissions = () => {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [permissions, setPermissions] = useState<StagePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load user groups
      const { data: groups, error: groupsError } = await supabase
        .from('user_groups')
        .select('id, name, description')
        .order('name');

      if (groupsError) throw groupsError;

      // Load production stages with master queue info
      const { data: stages, error: stagesError } = await supabase
        .from('production_stages')
        .select(`
          id, 
          name, 
          color,
          master_queue_id,
          master_queue:master_queue_id(name)
        `)
        .eq('is_active', true)
        .order('order_index');

      if (stagesError) throw stagesError;

      // Load existing permissions with IDs
      const { data: perms, error: permsError } = await supabase
        .from('user_group_stage_permissions')
        .select('id, user_group_id, production_stage_id, can_view, can_edit, can_work, can_manage');

      if (permsError) throw permsError;

      setUserGroups(groups || []);
      setProductionStages((stages || []).map(stage => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        master_queue_id: stage.master_queue_id,
        master_queue_name: stage.master_queue?.name
      })));
      setPermissions(perms || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load group permissions data');
    } finally {
      setIsLoading(false);
    }
  };

  const getPermission = (groupId: string, stageId: string) => {
    return permissions.find(p => p.user_group_id === groupId && p.production_stage_id === stageId);
  };

  const updatePermission = (groupId: string, stageId: string, field: keyof Omit<StagePermission, 'id' | 'user_group_id' | 'production_stage_id'>, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.user_group_id === groupId && p.production_stage_id === stageId);
      
      if (existing) {
        return prev.map(p => 
          p.user_group_id === groupId && p.production_stage_id === stageId
            ? { ...p, [field]: value }
            : p
        );
      } else {
        // Create new permission record without ID - let database generate it
        const newPermission: StagePermission = {
          user_group_id: groupId,
          production_stage_id: stageId,
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false,
          can_work: field === 'can_work' ? value : false,
          can_manage: field === 'can_manage' ? value : false,
        };
        return [...prev, newPermission];
      }
    });
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      console.log('Starting save process...');

      if (userGroups.length === 0) {
        toast.error('No user groups found');
        return;
      }

      const groupIds = userGroups.map(g => g.id);
      console.log('Processing groups:', groupIds);

      // Clear existing permissions for these groups
      const { error: deleteError } = await supabase
        .from('user_group_stage_permissions')
        .delete()
        .in('user_group_id', groupIds);

      if (deleteError) {
        console.error('Delete failed:', deleteError);
        throw new Error(`Failed to clear existing permissions: ${deleteError.message}`);
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
        // Remove ID from the object to let database generate new ones
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
            .insert(batch);

          if (insertError) {
            console.error('Insert failed:', insertError);
            throw new Error(`Failed to save permissions batch: ${insertError.message}`);
          }
        }
      }

      console.log('Save completed successfully');
      toast.success(`Successfully saved ${validPermissions.length} permission assignments`);
      
      // Reload data to get the new IDs
      await loadData();
      
    } catch (error) {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to save permissions: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return {
    userGroups,
    productionStages,
    permissions,
    isLoading,
    saving,
    getPermission,
    updatePermission,
    savePermissions
  };
};

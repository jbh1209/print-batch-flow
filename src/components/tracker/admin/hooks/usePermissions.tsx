
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
  user_group_id: string;
  production_stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

export const usePermissions = () => {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [permissions, setPermissions] = useState<StagePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());

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

      // Load permissions
      const { data: perms, error: permsError } = await supabase
        .from('user_group_stage_permissions')
        .select('user_group_id, production_stage_id, can_view, can_edit, can_work, can_manage');

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
      console.error('Error loading permissions data:', error);
      toast.error('Failed to load permissions data');
    } finally {
      setIsLoading(false);
    }
  };

  const getPermission = (groupId: string, stageId: string): StagePermission | undefined => {
    return permissions.find(p => p.user_group_id === groupId && p.production_stage_id === stageId);
  };

  const updatePermission = async (
    groupId: string,
    stageId: string,
    field: keyof Omit<StagePermission, 'user_group_id' | 'production_stage_id'>,
    value: boolean
  ) => {
    const saveKey = `${groupId}-${stageId}-${field}`;
    
    try {
      setSavingItems(prev => new Set(prev).add(saveKey));

      // Check if permission exists
      const { data: existing } = await supabase
        .from('user_group_stage_permissions')
        .select('*')
        .eq('user_group_id', groupId)
        .eq('production_stage_id', stageId)
        .maybeSingle();

      if (existing) {
        // Update existing permission
        const { error } = await supabase
          .from('user_group_stage_permissions')
          .update({ [field]: value })
          .eq('user_group_id', groupId)
          .eq('production_stage_id', stageId);

        if (error) throw error;
      } else {
        // Create new permission
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

      // Update local state
      setPermissions(prev => {
        const existingIndex = prev.findIndex(p => 
          p.user_group_id === groupId && p.production_stage_id === stageId
        );

        if (existingIndex >= 0) {
          // Update existing
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], [field]: value };
          return updated;
        } else {
          // Add new
          const newPerm: StagePermission = {
            user_group_id: groupId,
            production_stage_id: stageId,
            can_view: field === 'can_view' ? value : false,
            can_edit: field === 'can_edit' ? value : false,
            can_work: field === 'can_work' ? value : false,
            can_manage: field === 'can_manage' ? value : false,
          };
          return [...prev, newPerm];
        }
      });

    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    } finally {
      setSavingItems(prev => {
        const updated = new Set(prev);
        updated.delete(saveKey);
        return updated;
      });
    }
  };

  const isSaving = (groupId: string, stageId: string, field: string): boolean => {
    return savingItems.has(`${groupId}-${stageId}-${field}`);
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    userGroups,
    productionStages,
    permissions,
    isLoading,
    getPermission,
    updatePermission,
    isSaving
  };
};

export type { UserGroup, ProductionStage, StagePermission };

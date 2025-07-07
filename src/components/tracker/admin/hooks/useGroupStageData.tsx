
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
}

interface StagePermission {
  id?: string;
  user_group_id: string;
  production_stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

export const useGroupStageData = () => {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [permissions, setPermissions] = useState<StagePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load user groups
      const { data: groups, error: groupsError } = await supabase
        .from('user_groups')
        .select('id, name, description')
        .order('name');

      if (groupsError) throw groupsError;

      // Load production stages
      const { data: stages, error: stagesError } = await supabase
        .from('production_stages')
        .select(`
          id, 
          name, 
          color
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
        color: stage.color
      })));
      setPermissions(perms || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load group permissions data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    userGroups,
    productionStages,
    permissions,
    setPermissions,
    isLoading,
    loadData
  };
};

export type { UserGroup, ProductionStage, StagePermission };

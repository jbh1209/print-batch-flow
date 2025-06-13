
import { useState, useCallback } from "react";
import { StagePermission } from "./useGroupStageData";

export const usePermissionState = (initialPermissions: StagePermission[]) => {
  const [permissions, setPermissions] = useState<StagePermission[]>(initialPermissions);

  const getPermission = useCallback((groupId: string, stageId: string) => {
    return permissions.find(p => p.user_group_id === groupId && p.production_stage_id === stageId);
  }, [permissions]);

  const updatePermissionLocally = useCallback((
    groupId: string, 
    stageId: string, 
    field: keyof Omit<StagePermission, 'id' | 'user_group_id' | 'production_stage_id'>, 
    value: boolean
  ) => {
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
  }, []);

  const refreshPermissions = useCallback((newPermissions: StagePermission[]) => {
    setPermissions(newPermissions);
  }, []);

  return {
    permissions,
    getPermission,
    updatePermissionLocally,
    refreshPermissions
  };
};


import { useGroupStageData } from "./useGroupStageData";
import { usePermissionOperations } from "./usePermissionOperations";
import { usePermissionState } from "./usePermissionState";
import { StagePermission } from "./useGroupStageData";

export const useGroupStagePermissions = () => {
  const {
    userGroups,
    productionStages,
    permissions: rawPermissions,
    isLoading,
    loadData
  } = useGroupStageData();

  const {
    permissions,
    getPermission,
    updatePermissionLocally,
    refreshPermissions
  } = usePermissionState(rawPermissions);

  const {
    savePermission,
    isSaving
  } = usePermissionOperations();

  const handlePermissionChange = async (
    groupId: string,
    stageId: string,
    field: keyof Omit<StagePermission, 'id' | 'user_group_id' | 'production_stage_id'>,
    value: boolean
  ) => {
    // Update local state immediately for responsive UI
    updatePermissionLocally(groupId, stageId, field, value);

    // Save to database
    const success = await savePermission(groupId, stageId, field, value);
    
    if (success) {
      // Reload permissions from database to ensure sync
      await loadData();
      refreshPermissions(rawPermissions);
    } else {
      // Revert local change on failure
      updatePermissionLocally(groupId, stageId, field, !value);
    }
  };

  return {
    userGroups,
    productionStages,
    permissions,
    isLoading,
    saving: isSaving,
    getPermission,
    updatePermission: handlePermissionChange
  };
};

export { type UserGroup, type ProductionStage, type StagePermission } from "./useGroupStageData";

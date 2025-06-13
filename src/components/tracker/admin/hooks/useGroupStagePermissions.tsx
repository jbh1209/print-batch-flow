
import { useGroupStageData } from "./useGroupStageData";
import { usePermissionOperations } from "./usePermissionOperations";
import { usePermissionState } from "./usePermissionState";

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
    updatePermission,
    refreshPermissions
  } = usePermissionState(rawPermissions);

  const {
    savePermission,
    bulkSavePermissions,
    isSaving
  } = usePermissionOperations();

  const handleSavePermissions = async () => {
    const success = await bulkSavePermissions(permissions);
    if (success) {
      // Reload data to get the new IDs
      await loadData();
      refreshPermissions(rawPermissions);
    }
  };

  return {
    userGroups,
    productionStages,
    permissions,
    isLoading,
    saving: isSaving,
    getPermission,
    updatePermission,
    savePermissions: handleSavePermissions,
    savePermission
  };
};

export { type UserGroup, type ProductionStage, type StagePermission } from "./useGroupStageData";


import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Settings, Save } from "lucide-react";
import { useGroupStagePermissions } from "./hooks/useGroupStagePermissions";
import { GroupPermissionsSection } from "./components/GroupPermissionsSection";

export const GroupStagePermissions = () => {
  const {
    userGroups,
    productionStages,
    isLoading,
    saving,
    getPermission,
    updatePermission,
    savePermissions
  } = useGroupStagePermissions();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Settings className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading group permissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Group Stage Permissions</CardTitle>
          </div>
          <Button onClick={savePermissions} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>View:</strong> Can see jobs in this stage</p>
          <p><strong>Edit:</strong> Can modify job details and stage information</p>
          <p><strong>Work:</strong> Can actively work on jobs (start, complete, advance)</p>
          <p><strong>Manage:</strong> Full control including reassigning jobs and workflows</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {userGroups.map(group => (
            <GroupPermissionsSection
              key={group.id}
              group={group}
              stages={productionStages}
              getPermission={getPermission}
              onPermissionChange={updatePermission}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

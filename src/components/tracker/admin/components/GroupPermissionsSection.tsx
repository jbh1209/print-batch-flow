
import React from "react";
import { Separator } from "@/components/ui/separator";
import { StagePermissionRow } from "./StagePermissionRow";

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

interface GroupPermissionsSectionProps {
  group: UserGroup;
  stages: ProductionStage[];
  getPermission: (groupId: string, stageId: string) => StagePermission | undefined;
  onPermissionChange: (groupId: string, stageId: string, field: string, value: boolean) => void;
}

export const GroupPermissionsSection: React.FC<GroupPermissionsSectionProps> = ({
  group,
  stages,
  getPermission,
  onPermissionChange
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{group.name}</h3>
        {group.description && (
          <p className="text-sm text-gray-600">{group.description}</p>
        )}
      </div>
      
      <div className="grid gap-3">
        {stages.map(stage => (
          <StagePermissionRow
            key={stage.id}
            stage={stage}
            groupId={group.id}
            permission={getPermission(group.id, stage.id)}
            onPermissionChange={onPermissionChange}
          />
        ))}
      </div>
      
      <Separator />
    </div>
  );
};

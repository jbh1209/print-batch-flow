
import React from "react";
import { Separator } from "@/components/ui/separator";
import { StagePermissionCard } from "./StagePermissionCard";
import { UserGroup, ProductionStage, StagePermission } from "../hooks/usePermissions";

interface GroupPermissionCardProps {
  group: UserGroup;
  stages: ProductionStage[];
  getPermission: (groupId: string, stageId: string) => StagePermission | undefined;
  onPermissionChange: (groupId: string, stageId: string, field: string, value: boolean) => void;
  isSaving: (groupId: string, stageId: string, field: string) => boolean;
}

export const GroupPermissionCard: React.FC<GroupPermissionCardProps> = ({
  group,
  stages,
  getPermission,
  onPermissionChange,
  isSaving
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
          <StagePermissionCard
            key={stage.id}
            stage={stage}
            groupId={group.id}
            permission={getPermission(group.id, stage.id)}
            onPermissionChange={onPermissionChange}
            isSaving={isSaving}
          />
        ))}
      </div>
      
      <Separator />
    </div>
  );
};

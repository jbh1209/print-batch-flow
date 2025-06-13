
import React from "react";
import { Badge } from "@/components/ui/badge";
import { PermissionCheckbox } from "./PermissionCheckbox";
import { ProductionStage, StagePermission } from "../hooks/usePermissions";

interface StagePermissionCardProps {
  stage: ProductionStage;
  groupId: string;
  permission: StagePermission | undefined;
  onPermissionChange: (groupId: string, stageId: string, field: string, value: boolean) => void;
  isSaving: (groupId: string, stageId: string, field: string) => boolean;
}

export const StagePermissionCard: React.FC<StagePermissionCardProps> = ({
  stage,
  groupId,
  permission,
  onPermissionChange,
  isSaving
}) => {
  const stageName = stage.master_queue_name 
    ? `${stage.master_queue_name} - ${stage.name}`
    : stage.name;

  const permissionTypes = [
    { key: 'can_view', label: 'View' },
    { key: 'can_edit', label: 'Edit' },
    { key: 'can_work', label: 'Work' },
    { key: 'can_manage', label: 'Manage' }
  ];

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <span className="font-medium">{stageName}</span>
        {stage.master_queue_name && (
          <Badge variant="secondary" className="text-xs">
            Master Queue
          </Badge>
        )}
      </div>
      
      <div className="flex items-center gap-6">
        {permissionTypes.map(({ key, label }) => (
          <PermissionCheckbox
            key={key}
            groupId={groupId}
            stageId={stage.id}
            field={key}
            label={label}
            checked={permission?.[key as keyof StagePermission] || false}
            onCheckedChange={onPermissionChange}
            saving={isSaving(groupId, stage.id, key)}
          />
        ))}
      </div>
    </div>
  );
};

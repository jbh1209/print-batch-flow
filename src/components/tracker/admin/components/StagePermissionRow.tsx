
import React from "react";
import { Badge } from "@/components/ui/badge";
import { PermissionCheckboxes } from "./PermissionCheckboxes";

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

interface StagePermissionRowProps {
  stage: ProductionStage;
  groupId: string;
  permission: StagePermission | undefined;
  onPermissionChange: (groupId: string, stageId: string, field: string, value: boolean) => void;
}

export const StagePermissionRow: React.FC<StagePermissionRowProps> = ({
  stage,
  groupId,
  permission,
  onPermissionChange
}) => {
  const stageName = stage.master_queue_name 
    ? `${stage.master_queue_name} - ${stage.name}`
    : stage.name;

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
      
      <PermissionCheckboxes
        groupId={groupId}
        stageId={stage.id}
        permission={permission}
        onPermissionChange={onPermissionChange}
      />
    </div>
  );
};

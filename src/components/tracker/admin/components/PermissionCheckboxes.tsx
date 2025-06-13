
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface PermissionCheckboxesProps {
  groupId: string;
  stageId: string;
  permission: {
    can_view: boolean;
    can_edit: boolean;
    can_work: boolean;
    can_manage: boolean;
  } | undefined;
  onPermissionChange: (groupId: string, stageId: string, field: string, value: boolean) => void;
  saving?: boolean;
}

export const PermissionCheckboxes: React.FC<PermissionCheckboxesProps> = ({
  groupId,
  stageId,
  permission,
  onPermissionChange,
  saving = false
}) => {
  const permissionTypes = [
    { key: 'can_view', label: 'View' },
    { key: 'can_edit', label: 'Edit' },
    { key: 'can_work', label: 'Work' },
    { key: 'can_manage', label: 'Manage' }
  ];

  return (
    <div className="flex items-center gap-6">
      {permissionTypes.map(({ key, label }) => (
        <div key={key} className="flex items-center space-x-2">
          <div className="relative">
            <Checkbox
              id={`${groupId}-${stageId}-${key}`}
              checked={permission?.[key as keyof typeof permission] || false}
              onCheckedChange={(checked) => 
                onPermissionChange(groupId, stageId, key, !!checked)
              }
              disabled={saving}
            />
            {saving && (
              <Loader2 className="h-3 w-3 animate-spin absolute -top-1 -right-1" />
            )}
          </div>
          <label 
            htmlFor={`${groupId}-${stageId}-${key}`}
            className="text-sm font-medium"
          >
            {label}
          </label>
        </div>
      ))}
    </div>
  );
};

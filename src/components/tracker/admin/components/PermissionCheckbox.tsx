
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface PermissionCheckboxProps {
  groupId: string;
  stageId: string;
  field: string;
  label: string;
  checked: boolean;
  onCheckedChange: (groupId: string, stageId: string, field: string, value: boolean) => void;
  saving: boolean;
}

export const PermissionCheckbox: React.FC<PermissionCheckboxProps> = ({
  groupId,
  stageId,
  field,
  label,
  checked,
  onCheckedChange,
  saving
}) => {
  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <Checkbox
          id={`${groupId}-${stageId}-${field}`}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(groupId, stageId, field, !!value)}
          disabled={saving}
        />
        {saving && (
          <Loader2 className="h-3 w-3 animate-spin absolute -top-1 -right-1" />
        )}
      </div>
      <label 
        htmlFor={`${groupId}-${stageId}-${field}`}
        className="text-sm font-medium cursor-pointer"
      >
        {label}
      </label>
    </div>
  );
};


import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { UserWithGroups } from "../types";

interface SingleUserGroupsProps {
  user: UserWithGroups;
  onRemoveFromGroup: (userId: string, groupId: string) => void;
}

export const SingleUserGroups = ({ user, onRemoveFromGroup }: SingleUserGroupsProps) => {
  return (
    <div className="space-y-3">
      {user.groups.map(group => (
        <Badge key={group.id} variant="secondary" className="flex items-center gap-2">
          {group.name}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-red-100"
            onClick={() => onRemoveFromGroup(user.id, group.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      {user.groups.length === 0 && (
        <p className="text-sm text-gray-500">No groups assigned</p>
      )}
    </div>
  );
};

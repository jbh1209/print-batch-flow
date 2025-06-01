
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { UserWithGroups } from "../types";

interface UserGroupsListProps {
  users: UserWithGroups[];
  onRemoveFromGroup: (userId: string, groupId: string) => void;
}

export const UserGroupsList = ({ users, onRemoveFromGroup }: UserGroupsListProps) => {
  return (
    <div className="space-y-3">
      {users.map(user => (
        <div key={user.id} className="flex items-center justify-between p-3 border rounded">
          <div>
            <div className="font-medium">{user.full_name || user.email}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {user.groups.map(group => (
              <Badge 
                key={group.id} 
                variant="secondary"
                className="flex items-center gap-1"
              >
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
              <span className="text-sm text-gray-400">No groups assigned</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

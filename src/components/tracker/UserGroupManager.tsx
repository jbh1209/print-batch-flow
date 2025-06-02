
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useUserGroups } from "./user-groups/hooks/useUserGroups";
import { useGroupOperations } from "./user-groups/hooks/useGroupOperations";
import { GroupAssignmentDialog } from "./user-groups/components/GroupAssignmentDialog";
import { UserGroupsList } from "./user-groups/components/UserGroupsList";
import { SingleUserGroups } from "./user-groups/components/SingleUserGroups";
import { UserGroupManagerProps } from "./user-groups/types";

export const UserGroupManager = ({ userId, showAllUsers = false }: UserGroupManagerProps) => {
  const { groups, users, loading, refreshData } = useUserGroups(userId, showAllUsers);
  const { addUserToGroup, removeUserFromGroup } = useGroupOperations(refreshData);

  if (loading) {
    return <div>Loading user groups...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Groups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAllUsers ? (
          <div className="space-y-4">
            <GroupAssignmentDialog 
              groups={groups}
              users={users}
              onAssign={addUserToGroup}
            />
            <UserGroupsList 
              users={users}
              onRemoveFromGroup={removeUserFromGroup}
            />
          </div>
        ) : (
          users[0] && (
            <SingleUserGroups 
              userId={users[0].id}
              userEmail={users[0].email || 'No email'}
            />
          )
        )}
      </CardContent>
    </Card>
  );
};

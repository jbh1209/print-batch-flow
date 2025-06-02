
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UserPlus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useGroupOperations } from "../hooks/useGroupOperations";

interface UserGroup {
  id: string;
  name: string;
  description?: string;
}

interface UserGroupMembership {
  id: string;
  user_id: string;
  group_id: string;
  user_groups: UserGroup;
}

interface User {
  id: string;
  email: string;
  full_name?: string;
}

interface SingleUserGroupsProps {
  userId: string;
  userEmail: string;
}

export const SingleUserGroups: React.FC<SingleUserGroupsProps> = ({ userId, userEmail }) => {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [userMemberships, setUserMemberships] = useState<UserGroupMembership[]>([]);
  const [availableGroups, setAvailableGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingGroups, setUpdatingGroups] = useState<Set<string>>(new Set());

  const { addUserToGroup, removeUserFromGroup } = useGroupOperations(fetchData);

  async function fetchData() {
    try {
      setIsLoading(true);

      // Fetch all groups
      const { data: allGroups, error: groupsError } = await supabase
        .from('user_groups')
        .select('id, name, description')
        .order('name');

      if (groupsError) throw groupsError;

      // Fetch user's current memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('user_group_memberships')
        .select(`
          id,
          user_id,
          group_id,
          user_groups (
            id,
            name,
            description
          )
        `)
        .eq('user_id', userId);

      if (membershipsError) throw membershipsError;

      console.log('🔍 User group memberships fetched:', {
        userId,
        memberships: memberships?.length || 0,
        membershipData: memberships
      });

      const userGroupIds = memberships?.map(m => m.group_id) || [];
      const userGroupsData = memberships?.map(m => m.user_groups as UserGroup) || [];
      const availableGroupsData = allGroups?.filter(g => !userGroupIds.includes(g.id)) || [];

      setUserGroups(userGroupsData);
      setUserMemberships(memberships || []);
      setAvailableGroups(availableGroupsData);
      setUserGroups(allGroups || []);

    } catch (error) {
      console.error('Error fetching user groups:', error);
      toast.error('Failed to load user groups');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const handleToggleGroup = async (groupId: string, isCurrentlyMember: boolean) => {
    setUpdatingGroups(prev => new Set([...prev, groupId]));
    
    try {
      if (isCurrentlyMember) {
        await removeUserFromGroup(userId, groupId);
      } else {
        await addUserToGroup(userId, groupId);
      }
      
      // Refresh data after successful operation
      await fetchData();
    } finally {
      setUpdatingGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    }
  };

  const isUserInGroup = (groupId: string): boolean => {
    return userMemberships.some(membership => membership.group_id === groupId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading user groups...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          User Groups for {userEmail}
        </CardTitle>
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {userGroups.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No user groups available</p>
        ) : (
          <div className="space-y-3">
            {userGroups.map((group) => {
              const isInGroup = isUserInGroup(group.id);
              const isUpdating = updatingGroups.has(group.id);
              
              return (
                <div 
                  key={group.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isInGroup}
                      onCheckedChange={() => handleToggleGroup(group.id, isInGroup)}
                      disabled={isUpdating}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{group.name}</span>
                        {isInGroup && (
                          <Badge variant="default" className="text-xs">
                            Member
                          </Badge>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-600">{group.description}</p>
                      )}
                    </div>
                  </div>
                  
                  {isUpdating && (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Debug Information */}
        <div className="mt-6 p-3 bg-gray-50 rounded border text-xs">
          <p><strong>Debug Info:</strong></p>
          <p>User ID: {userId}</p>
          <p>Total Groups: {userGroups.length}</p>
          <p>User Memberships: {userMemberships.length}</p>
          <p>Available Groups: {availableGroups.length}</p>
          <p>Member of: {userMemberships.map(m => m.user_groups?.name || 'Unknown').join(', ') || 'None'}</p>
        </div>
      </CardContent>
    </Card>
  );
};

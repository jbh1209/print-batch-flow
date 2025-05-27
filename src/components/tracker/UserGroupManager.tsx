
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserGroup {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
}

interface UserWithGroups {
  id: string;
  email: string;
  full_name: string;
  groups: UserGroup[];
}

interface UserGroupManagerProps {
  userId?: string;
  showAllUsers?: boolean;
}

export const UserGroupManager = ({ userId, showAllUsers = false }: UserGroupManagerProps) => {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<UserWithGroups[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
    if (showAllUsers) {
      fetchUsersWithGroups();
    } else if (userId) {
      fetchUserGroups(userId);
    }
  }, [userId, showAllUsers]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('user_groups')
        .select('*')
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load user groups');
    }
  };

  const fetchUsersWithGroups = async () => {
    try {
      // Get all users with their profiles and roles
      const { data: usersData, error: usersError } = await supabase.functions.invoke('get-users-admin');
      
      if (usersError) throw usersError;

      // Get group memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('user_group_memberships')
        .select(`
          user_id,
          user_groups (*)
        `);

      if (membershipsError) throw membershipsError;

      // Combine data
      const usersWithGroups = usersData.map((user: any) => ({
        ...user,
        groups: memberships
          ?.filter(m => m.user_id === user.id)
          ?.map(m => m.user_groups) || []
      }));

      setUsers(usersWithGroups);
    } catch (error) {
      console.error('Error fetching users with groups:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserGroups = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('user_group_memberships')
        .select(`
          user_groups (*)
        `)
        .eq('user_id', uid);

      if (error) throw error;

      const userGroups = data?.map(m => m.user_groups).filter(Boolean) || [];
      setUsers([{ 
        id: uid, 
        email: '', 
        full_name: '', 
        groups: userGroups as UserGroup[] 
      }]);
    } catch (error) {
      console.error('Error fetching user groups:', error);
      toast.error('Failed to load user groups');
    } finally {
      setLoading(false);
    }
  };

  const addUserToGroup = async () => {
    if (!selectedUser || !selectedGroup) return;

    try {
      const { error } = await supabase
        .from('user_group_memberships')
        .insert({
          user_id: selectedUser,
          group_id: selectedGroup
        });

      if (error) throw error;

      toast.success('User added to group successfully');
      setSelectedUser("");
      setSelectedGroup("");
      
      if (showAllUsers) {
        fetchUsersWithGroups();
      } else if (userId) {
        fetchUserGroups(userId);
      }
    } catch (error) {
      console.error('Error adding user to group:', error);
      toast.error('Failed to add user to group');
    }
  };

  const removeUserFromGroup = async (uid: string, groupId: string) => {
    try {
      const { error } = await supabase
        .from('user_group_memberships')
        .delete()
        .eq('user_id', uid)
        .eq('group_id', groupId);

      if (error) throw error;

      toast.success('User removed from group');
      
      if (showAllUsers) {
        fetchUsersWithGroups();
      } else if (userId) {
        fetchUserGroups(userId);
      }
    } catch (error) {
      console.error('Error removing user from group:', error);
      toast.error('Failed to remove user from group');
    }
  };

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
          // Show all users and their groups
          <div className="space-y-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Assign User to Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign User to Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    onClick={addUserToGroup}
                    disabled={!selectedUser || !selectedGroup}
                    className="w-full"
                  >
                    Assign to Group
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

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
                          onClick={() => removeUserFromGroup(user.id, group.id)}
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
          </div>
        ) : (
          // Show groups for single user
          <div className="space-y-3">
            {users[0]?.groups.map(group => (
              <Badge key={group.id} variant="secondary" className="flex items-center gap-2">
                {group.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-100"
                  onClick={() => removeUserFromGroup(userId!, group.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {users[0]?.groups.length === 0 && (
              <p className="text-sm text-gray-500">No groups assigned</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};


import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserGroup, UserWithGroups } from "../types";

export const useUserGroups = (userId?: string, showAllUsers = false) => {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<UserWithGroups[]>([]);
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
      
      // Transform permissions from Json to Record<string, boolean>
      const transformedGroups = data?.map(group => ({
        ...group,
        permissions: typeof group.permissions === 'object' && group.permissions !== null 
          ? group.permissions as Record<string, boolean>
          : {}
      })) || [];
      
      setGroups(transformedGroups);
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
          ?.map(m => ({
            ...m.user_groups,
            permissions: typeof m.user_groups.permissions === 'object' && m.user_groups.permissions !== null 
              ? m.user_groups.permissions as Record<string, boolean>
              : {}
          })) || []
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

      const userGroups = data?.map(m => ({
        ...m.user_groups,
        permissions: typeof m.user_groups.permissions === 'object' && m.user_groups.permissions !== null 
          ? m.user_groups.permissions as Record<string, boolean>
          : {}
      })).filter(Boolean) || [];
      
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

  const refreshData = () => {
    if (showAllUsers) {
      fetchUsersWithGroups();
    } else if (userId) {
      fetchUserGroups(userId);
    }
  };

  return {
    groups,
    users,
    loading,
    refreshData
  };
};

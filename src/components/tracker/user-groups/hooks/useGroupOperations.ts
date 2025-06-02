
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useGroupOperations = (refreshData: () => void) => {
  const addUserToGroup = async (selectedUser: string, selectedGroup: string) => {
    if (!selectedUser || !selectedGroup) return;

    try {
      console.log('🔄 Adding user to group:', { selectedUser, selectedGroup });
      
      // Check if membership already exists
      const { data: existing, error: checkError } = await supabase
        .from('user_group_memberships')
        .select('id')
        .eq('user_id', selectedUser)
        .eq('group_id', selectedGroup)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected
        throw checkError;
      }

      if (existing) {
        toast.info('User is already in this group');
        return true;
      }

      // Add new membership
      const { error } = await supabase
        .from('user_group_memberships')
        .insert({
          user_id: selectedUser,
          group_id: selectedGroup
        });

      if (error) {
        // Handle duplicate key error gracefully
        if (error.code === '23505') {
          toast.info('User is already in this group');
          return true;
        }
        throw error;
      }

      toast.success('User added to group successfully');
      refreshData();
      return true;
    } catch (error) {
      console.error('❌ Error adding user to group:', error);
      toast.error('Failed to add user to group');
      return false;
    }
  };

  const removeUserFromGroup = async (uid: string, groupId: string) => {
    try {
      console.log('🔄 Removing user from group:', { uid, groupId });
      
      const { error } = await supabase
        .from('user_group_memberships')
        .delete()
        .eq('user_id', uid)
        .eq('group_id', groupId);

      if (error) throw error;

      toast.success('User removed from group');
      refreshData();
    } catch (error) {
      console.error('❌ Error removing user from group:', error);
      toast.error('Failed to remove user from group');
    }
  };

  return {
    addUserToGroup,
    removeUserFromGroup
  };
};

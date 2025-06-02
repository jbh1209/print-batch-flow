
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Settings, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserGroup {
  id: string;
  name: string;
  description: string;
}

interface ProductionStage {
  id: string;
  name: string;
  color: string;
}

interface StagePermission {
  id?: string;
  user_group_id: string;
  production_stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

interface StagePermissionsManagerProps {
  stage: ProductionStage;
}

export const StagePermissionsManager: React.FC<StagePermissionsManagerProps> = ({ stage }) => {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [permissions, setPermissions] = useState<StagePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [stage.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('user_groups')
        .select('id, name, description')
        .order('name');

      if (groupsError) throw groupsError;

      // Fetch existing permissions for this stage
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_group_stage_permissions')
        .select('*')
        .eq('production_stage_id', stage.id);

      if (permissionsError) throw permissionsError;

      setUserGroups(groupsData || []);
      setPermissions(permissionsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load permissions data');
    } finally {
      setLoading(false);
    }
  };

  const getPermissionForGroup = (groupId: string): StagePermission => {
    const existing = permissions.find(p => p.user_group_id === groupId);
    return existing || {
      user_group_id: groupId,
      production_stage_id: stage.id,
      can_view: false,
      can_edit: false,
      can_work: false,
      can_manage: false
    };
  };

  const updatePermission = async (groupId: string, field: keyof StagePermission, value: boolean) => {
    try {
      const existing = permissions.find(p => p.user_group_id === groupId);
      
      if (existing?.id) {
        // Update existing permission
        const { error } = await supabase
          .from('user_group_stage_permissions')
          .update({ 
            [field]: value,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new permission
        const newPermission = {
          user_group_id: groupId,
          production_stage_id: stage.id,
          [field]: value,
          assigned_by: (await supabase.auth.getUser()).data.user?.id
        };

        const { error } = await supabase
          .from('user_group_stage_permissions')
          .insert(newPermission);

        if (error) throw error;
      }

      // Refresh data
      await fetchData();
      toast.success('Permissions updated successfully');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permissions');
    }
  };

  const removeAllPermissions = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('user_group_stage_permissions')
        .delete()
        .eq('user_group_id', groupId)
        .eq('production_stage_id', stage.id);

      if (error) throw error;

      await fetchData();
      toast.success('Permissions removed successfully');
    } catch (error) {
      console.error('Error removing permissions:', error);
      toast.error('Failed to remove permissions');
    }
  };

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Manage Access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            {stage.name} - User Group Permissions
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Configure which user groups can view, edit, work with, or manage this production stage.
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Group</TableHead>
                <TableHead>View</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead>Work</TableHead>
                <TableHead>Manage</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userGroups.map((group) => {
                const permission = getPermissionForGroup(group.id);
                const hasAnyPermission = permission.can_view || permission.can_edit || permission.can_work || permission.can_manage;
                
                return (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{group.name}</div>
                        {group.description && (
                          <div className="text-xs text-gray-500">{group.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={permission.can_view}
                        onCheckedChange={(checked) => 
                          updatePermission(group.id, 'can_view', !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={permission.can_edit}
                        onCheckedChange={(checked) => 
                          updatePermission(group.id, 'can_edit', !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={permission.can_work}
                        onCheckedChange={(checked) => 
                          updatePermission(group.id, 'can_work', !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={permission.can_manage}
                        onCheckedChange={(checked) => 
                          updatePermission(group.id, 'can_manage', !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {hasAnyPermission && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeAllPermissions(group.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove All
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {userGroups.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No user groups found. Create user groups first to assign stage permissions.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

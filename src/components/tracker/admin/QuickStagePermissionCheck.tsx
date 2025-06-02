
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserGroup {
  id: string;
  name: string;
}

interface ProductionStage {
  id: string;
  name: string;
  color: string;
}

interface StagePermission {
  user_group_id: string;
  production_stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

export const QuickStagePermissionCheck = () => {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [permissions, setPermissions] = useState<StagePermission[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('user_groups')
        .select('id, name')
        .order('name');

      if (groupsError) throw groupsError;

      // Fetch production stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .eq('is_active', true)
        .order('order_index');

      if (stagesError) throw stagesError;

      // Fetch existing permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_group_stage_permissions')
        .select('*');

      if (permissionsError) throw permissionsError;

      setUserGroups(groupsData || []);
      setProductionStages(stagesData || []);
      setPermissions(permissionsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getPermissionForGroupAndStage = (groupId: string, stageId: string) => {
    return permissions.find(p => 
      p.user_group_id === groupId && p.production_stage_id === stageId
    );
  };

  const updatePermission = async (groupId: string, stageId: string, permissionType: string, value: boolean) => {
    try {
      const existing = getPermissionForGroupAndStage(groupId, stageId);
      
      if (existing) {
        // Update existing permission
        const { error } = await supabase
          .from('user_group_stage_permissions')
          .update({ 
            [permissionType]: value,
            updated_at: new Date().toISOString()
          })
          .eq('user_group_id', groupId)
          .eq('production_stage_id', stageId);

        if (error) throw error;
      } else {
        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        
        // Create new permission
        const newPermission = {
          user_group_id: groupId,
          production_stage_id: stageId,
          can_view: permissionType === 'can_view' ? value : false,
          can_edit: permissionType === 'can_edit' ? value : false,
          can_work: permissionType === 'can_work' ? value : false,
          can_manage: permissionType === 'can_manage' ? value : false,
          assigned_by: user?.id || null
        };

        const { error } = await supabase
          .from('user_group_stage_permissions')
          .insert(newPermission);

        if (error) throw error;
      }

      // Refresh permissions
      await fetchData();
      toast.success('Permission updated');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    }
  };

  const grantBasicAccessToGroup = async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const promises = productionStages.map(async (stage) => {
        const existing = getPermissionForGroupAndStage(groupId, stage.id);
        if (!existing) {
          return supabase
            .from('user_group_stage_permissions')
            .insert({
              user_group_id: groupId,
              production_stage_id: stage.id,
              can_view: true,
              can_work: true,
              can_edit: false,
              can_manage: false,
              assigned_by: user?.id || null
            });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      await fetchData();
      toast.success('Basic access granted to all stages');
    } catch (error) {
      console.error('Error granting basic access:', error);
      toast.error('Failed to grant basic access');
    }
  };

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Stage Permission Check</CardTitle>
        <div className="flex gap-2">
          <select 
            value={selectedGroup} 
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">Select a group</option>
            {userGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          {selectedGroup && (
            <Button 
              onClick={() => grantBasicAccessToGroup(selectedGroup)}
              size="sm"
            >
              Grant Basic Access to All Stages
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {selectedGroup ? (
          <div className="space-y-4">
            <h3 className="font-medium">
              Stage Permissions for: {userGroups.find(g => g.id === selectedGroup)?.name}
            </h3>
            <div className="grid gap-4">
              {productionStages.map(stage => {
                const permission = getPermissionForGroupAndStage(selectedGroup, stage.id);
                return (
                  <div key={stage.id} className="border rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-medium">{stage.name}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      {['can_view', 'can_edit', 'can_work', 'can_manage'].map(permType => (
                        <label key={permType} className="flex items-center gap-2">
                          <Checkbox
                            checked={permission?.[permType] || false}
                            onCheckedChange={(checked) => 
                              updatePermission(selectedGroup, stage.id, permType, !!checked)
                            }
                          />
                          {permType.replace('can_', '')}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Select a user group to view and edit stage permissions</p>
        )}
      </CardContent>
    </Card>
  );
};

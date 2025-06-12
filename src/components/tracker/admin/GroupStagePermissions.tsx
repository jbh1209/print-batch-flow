
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Settings, Save } from "lucide-react";

interface UserGroup {
  id: string;
  name: string;
  description: string;
}

interface ProductionStage {
  id: string;
  name: string;
  color: string;
  master_queue_id?: string;
  master_queue_name?: string;
}

interface StagePermission {
  user_group_id: string;
  production_stage_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_work: boolean;
  can_manage: boolean;
}

export const GroupStagePermissions = () => {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [permissions, setPermissions] = useState<StagePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load user groups
      const { data: groups, error: groupsError } = await supabase
        .from('user_groups')
        .select('id, name, description')
        .order('name');

      if (groupsError) throw groupsError;

      // Load production stages with master queue info
      const { data: stages, error: stagesError } = await supabase
        .from('production_stages')
        .select(`
          id, 
          name, 
          color,
          master_queue_id,
          master_queue:master_queue_id(name)
        `)
        .eq('is_active', true)
        .order('order_index');

      if (stagesError) throw stagesError;

      // Load existing permissions
      const { data: perms, error: permsError } = await supabase
        .from('user_group_stage_permissions')
        .select('*');

      if (permsError) throw permsError;

      setUserGroups(groups || []);
      setProductionStages((stages || []).map(stage => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        master_queue_id: stage.master_queue_id,
        master_queue_name: stage.master_queue?.name
      })));
      setPermissions(perms || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load group permissions data');
    } finally {
      setIsLoading(false);
    }
  };

  const getPermission = (groupId: string, stageId: string) => {
    return permissions.find(p => p.user_group_id === groupId && p.production_stage_id === stageId);
  };

  const updatePermission = (groupId: string, stageId: string, field: keyof StagePermission, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.user_group_id === groupId && p.production_stage_id === stageId);
      
      if (existing) {
        return prev.map(p => 
          p.user_group_id === groupId && p.production_stage_id === stageId
            ? { ...p, [field]: value }
            : p
        );
      } else {
        return [...prev, {
          user_group_id: groupId,
          production_stage_id: stageId,
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false,
          can_work: field === 'can_work' ? value : false,
          can_manage: field === 'can_manage' ? value : false,
        }];
      }
    });
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      console.log('Starting permission save process...');

      // Get all unique group IDs from our current state
      const groupIds = userGroups.map(g => g.id);
      
      if (groupIds.length === 0) {
        console.log('No groups found, skipping save');
        toast.error('No user groups found');
        return;
      }

      console.log('Deleting existing permissions for groups:', groupIds);

      // Delete existing permissions for these groups
      const { error: deleteError } = await supabase
        .from('user_group_stage_permissions')
        .delete()
        .in('user_group_id', groupIds);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      // Filter permissions to only include those with at least one permission enabled
      const permissionsToInsert = permissions.filter(p => 
        p.can_view || p.can_edit || p.can_work || p.can_manage
      );

      console.log('Inserting permissions:', permissionsToInsert.length);

      if (permissionsToInsert.length > 0) {
        // Validate each permission before inserting
        const validPermissions = permissionsToInsert.filter(p => {
          const isValid = p.user_group_id && p.production_stage_id && 
                         typeof p.can_view === 'boolean' &&
                         typeof p.can_edit === 'boolean' &&
                         typeof p.can_work === 'boolean' &&
                         typeof p.can_manage === 'boolean';
          
          if (!isValid) {
            console.warn('Invalid permission object:', p);
          }
          return isValid;
        });

        if (validPermissions.length > 0) {
          const { error: insertError } = await supabase
            .from('user_group_stage_permissions')
            .insert(validPermissions);

          if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
          }
        }
      }

      console.log('Permission save completed successfully');
      toast.success(`Successfully saved ${permissionsToInsert.length} permission assignments`);
      
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(`Failed to save permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Settings className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading group permissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Group Stage Permissions</CardTitle>
          </div>
          <Button onClick={savePermissions} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>View:</strong> Can see jobs in this stage</p>
          <p><strong>Edit:</strong> Can modify job details and stage information</p>
          <p><strong>Work:</strong> Can actively work on jobs (start, complete, advance)</p>
          <p><strong>Manage:</strong> Full control including reassigning jobs and workflows</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {userGroups.map(group => (
            <div key={group.id} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-gray-600">{group.description}</p>
                )}
              </div>
              
              <div className="grid gap-3">
                {productionStages.map(stage => {
                  const permission = getPermission(group.id, stage.id);
                  const stageName = stage.master_queue_name 
                    ? `${stage.master_queue_name} - ${stage.name}`
                    : stage.name;

                  return (
                    <div key={stage.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-medium">{stageName}</span>
                        {stage.master_queue_name && (
                          <Badge variant="secondary" className="text-xs">
                            Master Queue
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {[
                          { key: 'can_view' as const, label: 'View' },
                          { key: 'can_edit' as const, label: 'Edit' },
                          { key: 'can_work' as const, label: 'Work' },
                          { key: 'can_manage' as const, label: 'Manage' }
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${group.id}-${stage.id}-${key}`}
                              checked={permission?.[key] || false}
                              onCheckedChange={(checked) => 
                                updatePermission(group.id, stage.id, key, !!checked)
                              }
                            />
                            <label 
                              htmlFor={`${group.id}-${stage.id}-${key}`}
                              className="text-sm font-medium"
                            >
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <Separator />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

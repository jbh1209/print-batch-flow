import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Users, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface StageGroup {
  id: string;
  name: string;
  description: string;
  parallel_processing_enabled: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

interface ProductionStage {
  id: string;
  name: string;
  stage_group_id: string | null;
  color: string;
  order_index: number;
}

const StageGroupManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StageGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parallel_processing_enabled: false,
    color: '#6B7280'
  });

  const queryClient = useQueryClient();

  // Fetch stage groups
  const { data: stageGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ['stage-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_groups')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as StageGroup[];
    }
  });

  // Fetch production stages
  const { data: productionStages, isLoading: stagesLoading } = useQuery({
    queryKey: ['production-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_stages')
        .select('id, name, stage_group_id, color, order_index')
        .order('order_index');
      
      if (error) throw error;
      return data as ProductionStage[];
    }
  });

  // Create/Update stage group mutation
  const saveGroupMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingGroup) {
        const { error } = await supabase
          .from('stage_groups')
          .update(data)
          .eq('id', editingGroup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stage_groups')
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-groups'] });
      setDialogOpen(false);
      setEditingGroup(null);
      setFormData({ name: '', description: '', parallel_processing_enabled: false, color: '#6B7280' });
      toast.success(editingGroup ? 'Stage group updated' : 'Stage group created');
    },
    onError: (error) => {
      toast.error('Failed to save stage group: ' + error.message);
    }
  });

  // Delete stage group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from('stage_groups')
        .delete()
        .eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-groups'] });
      toast.success('Stage group deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete stage group: ' + error.message);
    }
  });

  // Update stage group assignment mutation
  const updateStageGroupMutation = useMutation({
    mutationFn: async ({ stageId, groupId }: { stageId: string; groupId: string | null }) => {
      const { error } = await supabase
        .from('production_stages')
        .update({ stage_group_id: groupId })
        .eq('id', stageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-stages'] });
      toast.success('Stage group assignment updated');
    },
    onError: (error) => {
      toast.error('Failed to update stage assignment: ' + error.message);
    }
  });

  const handleEditGroup = (group: StageGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      parallel_processing_enabled: group.parallel_processing_enabled,
      color: group.color
    });
    setDialogOpen(true);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (confirm('Are you sure you want to delete this stage group?')) {
      deleteGroupMutation.mutate(groupId);
    }
  };

  const handleStageGroupChange = (stageId: string, groupId: string) => {
    updateStageGroupMutation.mutate({ 
      stageId, 
      groupId: groupId === 'none' ? null : groupId 
    });
  };

  const getStageCountForGroup = (groupId: string) => {
    return productionStages?.filter(stage => stage.stage_group_id === groupId).length || 0;
  };

  if (groupsLoading || stagesLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stage Group Management</h2>
          <p className="text-muted-foreground">Manage stage groups and parallel processing settings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingGroup(null);
              setFormData({ name: '', description: '', parallel_processing_enabled: false, color: '#6B7280' });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              New Stage Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Edit Stage Group' : 'Create Stage Group'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Printing, Finishing, Binding"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this group contains"
                />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="parallel"
                  checked={formData.parallel_processing_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, parallel_processing_enabled: checked }))}
                />
                <Label htmlFor="parallel">Enable Parallel Processing</Label>
              </div>
              <Button 
                onClick={() => saveGroupMutation.mutate(formData)}
                disabled={saveGroupMutation.isPending || !formData.name.trim()}
                className="w-full"
              >
                {editingGroup ? 'Update Group' : 'Create Group'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stage Groups Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stageGroups?.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditGroup(group)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{group.description}</p>
                <div className="flex items-center justify-between">
                  <Badge variant={group.parallel_processing_enabled ? "default" : "secondary"}>
                    {group.parallel_processing_enabled ? 'Parallel' : 'Sequential'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {getStageCountForGroup(group.id)} stages
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stage Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Stage Group Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage Name</TableHead>
                <TableHead>Current Group</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productionStages?.map((stage) => {
                const currentGroup = stageGroups?.find(g => g.id === stage.stage_group_id);
                return (
                  <TableRow key={stage.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {currentGroup ? (
                        <Badge style={{ backgroundColor: currentGroup.color, color: 'white' }}>
                          {currentGroup.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>{stage.order_index}</TableCell>
                    <TableCell>
                      <Select
                        value={stage.stage_group_id || 'none'}
                        onValueChange={(value) => handleStageGroupChange(stage.id, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Group</SelectItem>
                          {stageGroups?.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StageGroupManagement;
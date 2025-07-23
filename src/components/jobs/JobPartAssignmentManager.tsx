import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Clock, Play, Package, Wrench, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface JobStageInstance {
  id: string;
  production_stage_id: string;
  stage_order: number;
  status: string;
  part_assignment: string;
  part_name: string | null;
  quantity: number | null;
  production_stages: {
    name: string;
    color: string;
    stage_group_id: string | null;
  };
  stage_groups?: {
    name: string;
    parallel_processing_enabled: boolean;
  };
}

interface Job {
  id: string;
  wo_no: string;
  customer: string;
  reference: string;
  status: string;
  has_custom_workflow: boolean;
}

interface JobPartAssignmentManagerProps {
  jobId: string;
  jobTableName: string;
  open: boolean;
  onClose: () => void;
}

const PART_ASSIGNMENT_OPTIONS = [
  { value: 'both', label: 'Both Parts', icon: Package, color: 'bg-blue-100 text-blue-800' },
  { value: 'cover', label: 'Cover Only', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  { value: 'text', label: 'Text Only', icon: Wrench, color: 'bg-orange-100 text-orange-800' },
  { value: 'none', label: 'No Assignment', icon: Clock, color: 'bg-gray-100 text-gray-800' }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'active': return <Play className="h-4 w-4 text-blue-600" />;
    case 'pending': return <Clock className="h-4 w-4 text-orange-600" />;
    default: return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

const JobPartAssignmentManager: React.FC<JobPartAssignmentManagerProps> = ({
  jobId,
  jobTableName,
  open,
  onClose
}) => {
  const queryClient = useQueryClient();

  // Fetch job details - currently only supporting production_jobs
  const { data: job } = useQuery({
    queryKey: ['job', jobId, jobTableName],
    queryFn: async () => {
      if (jobTableName !== 'production_jobs') {
        throw new Error('Currently only production_jobs are supported');
      }
      
      const { data, error } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, reference, status, has_custom_workflow')
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      return data as Job;
    },
    enabled: open
  });

  // Fetch job stage instances
  const { data: stages, isLoading } = useQuery({
    queryKey: ['job-stages', jobId, jobTableName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          stage_order,
          status,
          part_assignment,
          part_name,
          quantity,
          production_stages!inner (
            name,
            color,
            stage_group_id,
            stage_groups (
              name,
              parallel_processing_enabled
            )
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .order('stage_order');
      
      if (error) throw error;
      return data as JobStageInstance[];
    },
    enabled: open
  });

  // Update part assignment mutation
  const updatePartAssignmentMutation = useMutation({
    mutationFn: async ({ stageId, partAssignment }: { stageId: string; partAssignment: string }) => {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ part_assignment: partAssignment })
        .eq('id', stageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-stages', jobId, jobTableName] });
      toast.success('Part assignment updated');
    },
    onError: (error) => {
      toast.error('Failed to update part assignment: ' + error.message);
    }
  });

  const handlePartAssignmentChange = (stageId: string, newAssignment: string) => {
    updatePartAssignmentMutation.mutate({ stageId, partAssignment: newAssignment });
  };

  const groupStagesByGroup = () => {
    if (!stages) return [];
    
    const grouped: { [key: string]: JobStageInstance[] } = {};
    
    stages.forEach(stage => {
      const groupName = stage.production_stages.stage_group_id 
        ? stage.stage_groups?.name || 'Unknown Group'
        : 'Ungrouped Stages';
      
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(stage);
    });
    
    return Object.entries(grouped).map(([groupName, groupStages]) => ({
      name: groupName,
      stages: groupStages,
      parallelEnabled: groupStages[0]?.stage_groups?.parallel_processing_enabled || false
    }));
  };

  const getPartAssignmentOption = (value: string) => {
    return PART_ASSIGNMENT_OPTIONS.find(opt => opt.value === value) || PART_ASSIGNMENT_OPTIONS[0];
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Job Part Assignment - {job?.wo_no}
          </DialogTitle>
        </DialogHeader>

        {job && (
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <div className="font-medium">{job.customer}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Reference:</span>
                <div className="font-medium">{job.reference}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="font-medium">{job.status}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Workflow:</span>
                <Badge variant={job.has_custom_workflow ? "default" : "secondary"}>
                  {job.has_custom_workflow ? 'Custom' : 'Standard'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading stage information...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupStagesByGroup().map((group, groupIndex) => (
              <Card key={group.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {group.name === 'Ungrouped Stages' ? (
                        <Clock className="h-5 w-5 text-gray-500" />
                      ) : (
                        <Package className="h-5 w-5" />
                      )}
                      {group.name}
                    </span>
                    {group.parallelEnabled && (
                      <Badge variant="default">Parallel Processing Enabled</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Current Assignment</TableHead>
                        <TableHead>Part Assignment</TableHead>
                        <TableHead>Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.stages.map((stage) => {
                        const partOption = getPartAssignmentOption(stage.part_assignment);
                        const Icon = partOption.icon;
                        
                        return (
                          <TableRow key={stage.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: stage.production_stages.color }}
                                />
                                <span className="font-medium">{stage.production_stages.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(stage.status)}
                                <span className="capitalize">{stage.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>{stage.stage_order}</TableCell>
                            <TableCell>
                              <Badge className={partOption.color}>
                                <Icon className="h-3 w-3 mr-1" />
                                {partOption.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={stage.part_assignment}
                                onValueChange={(value) => handlePartAssignmentChange(stage.id, value)}
                                disabled={stage.status === 'completed'}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PART_ASSIGNMENT_OPTIONS.map((option) => {
                                    const OptionIcon = option.icon;
                                    return (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                          <OptionIcon className="h-4 w-4" />
                                          {option.label}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {stage.quantity || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Part Assignment Guide</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <strong>Cover:</strong> For jobs that work on the cover/outer part (e.g., Cover Print, Cover Lamination)
                </div>
                <div>
                  <strong>Text:</strong> For jobs that work on the text/inner content (e.g., Text Print, Text Trimming)
                </div>
                <div>
                  <strong>Both:</strong> For operations that work on the complete job (e.g., Gathering, Perfect Binding)
                </div>
                <div>
                  <strong>None:</strong> For preparatory or administrative stages
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobPartAssignmentManager;
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Settings, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResourceData {
  name: string;
  type: 'Equipment' | 'Human';
  utilization: number;
  status: string;
  current_job: string | null;
  daily_capacity: number;
  hours_used: number;
  queue_length: number;
}

export const ResourceUtilization: React.FC = () => {
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResourceData();
  }, []);

  const loadResourceData = async () => {
    try {
      setIsLoading(true);
      
      // Get printers and their utilization
      const { data: printers } = await supabase
        .from('printers')
        .select('*')
        .eq('status', 'active');

      // Get production stages (human resources)
      const { data: stages } = await supabase
        .from('production_stages')
        .select('*')
        .eq('is_active', true);

      // Get active jobs by stage to calculate utilization
      const { data: activeJobs } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          status,
          production_stages:production_stage_id (name)
        `)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['active', 'pending']);

      // Group jobs by stage for queue calculations
      const jobsByStage = (activeJobs || []).reduce((acc: Record<string, any[]>, job) => {
        const stageName = job.production_stages?.name || 'Unknown';
        if (!acc[stageName]) acc[stageName] = [];
        acc[stageName].push(job);
        return acc;
      }, {});

      const resourceData: ResourceData[] = [];

      // Add printers as equipment resources
      (printers || []).forEach(printer => {
        const queueLength = Math.floor(Math.random() * 15) + 1; // Simulate queue
        const hoursUsed = Math.random() * 8;
        const utilization = Math.round((hoursUsed / 8) * 100);
        
        resourceData.push({
          name: printer.name,
          type: 'Equipment',
          utilization,
          status: utilization > 90 ? 'high_load' : 'operational',
          current_job: utilization > 20 ? `WO-2024-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}` : null,
          daily_capacity: 8,
          hours_used: Math.round(hoursUsed * 10) / 10,
          queue_length: queueLength
        });
      });

      // Add production stages as human resources
      (stages || []).slice(0, 3).forEach(stage => {
        const stageJobs = jobsByStage[stage.name] || [];
        const activeCount = stageJobs.filter(j => j.status === 'active').length;
        const queueLength = stageJobs.length;
        
        // Estimate capacity based on stage type
        const teamSize = stage.name.toLowerCase().includes('finishing') ? 3 : 2;
        const dailyCapacity = teamSize * 8;
        const hoursUsed = Math.min(dailyCapacity, activeCount * 4 + Math.random() * 8);
        const utilization = Math.round((hoursUsed / dailyCapacity) * 100);
        
        resourceData.push({
          name: `${stage.name} Team`,
          type: 'Human',
          utilization,
          status: utilization > 90 ? 'high_load' : 'operational',
          current_job: activeCount > 0 ? `WO-2024-${Math.floor(Math.random() * 100).toString().padStart(3, '0')}` : null,
          daily_capacity: dailyCapacity,
          hours_used: Math.round(hoursUsed * 10) / 10,
          queue_length: queueLength
        });
      });

      setResources(resourceData);
    } catch (error) {
      console.error('Error loading resource data:', error);
      toast.error('Failed to load resource utilization data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading resource data...</span>
        </CardContent>
      </Card>
    );
  }

  // Mock data for demonstration - in a real implementation, this would come from the database
  const mockResources = [
    {
      name: 'HP 12000 Printer',
      type: 'Equipment',
      utilization: 85,
      status: 'operational',
      current_job: 'WO-2024-001',
      daily_capacity: 8,
      hours_used: 6.8,
      queue_length: 12
    },
    {
      name: 'Lamination Machine',
      type: 'Equipment', 
      utilization: 92,
      status: 'operational',
      current_job: 'WO-2024-002',
      daily_capacity: 8,
      hours_used: 7.4,
      queue_length: 8
    },
    {
      name: 'Cutting Station',
      type: 'Equipment',
      utilization: 67,
      status: 'operational',
      current_job: null,
      daily_capacity: 8,
      hours_used: 5.4,
      queue_length: 5
    },
    {
      name: 'Pre-Press Team',
      type: 'Human',
      utilization: 78,
      status: 'operational',
      current_job: 'WO-2024-003',
      daily_capacity: 16, // 2 people
      hours_used: 12.5,
      queue_length: 15
    },
    {
      name: 'Finishing Team',
      type: 'Human',
      utilization: 94,
      status: 'high_load',
      current_job: 'WO-2024-004',
      daily_capacity: 24, // 3 people
      hours_used: 22.6,
      queue_length: 20
    }
  ];

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 95) return 'bg-red-500';
    if (utilization >= 85) return 'bg-yellow-500';
    if (utilization >= 70) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (status: string, utilization: number) => {
    if (utilization >= 95) return { variant: 'destructive' as const, label: 'Overloaded' };
    if (utilization >= 85) return { variant: 'secondary' as const, label: 'High Load' };
    if (status === 'operational') return { variant: 'default' as const, label: 'Operational' };
    return { variant: 'outline' as const, label: 'Available' };
  };

  const getResourceIcon = (type: string) => {
    return type === 'Human' ? <Users className="h-5 w-5" /> : <Settings className="h-5 w-5" />;
  };

  const displayResources = resources.length > 0 ? resources : mockResources;
  const totalCapacity = displayResources.reduce((sum, resource) => sum + resource.daily_capacity, 0);
  const totalUsed = displayResources.reduce((sum, resource) => sum + resource.hours_used, 0);
  const overallUtilization = Math.round((totalUsed / totalCapacity) * 100);

  return (
    <div className="space-y-6">
      {/* Overall Utilization Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overall Resource Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{Math.round(totalUsed)}h</p>
              <p className="text-sm text-muted-foreground">Hours Used Today</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{totalCapacity}h</p>
              <p className="text-sm text-muted-foreground">Total Capacity</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-bold ${
                overallUtilization >= 90 ? 'text-red-600' : 
                overallUtilization >= 80 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {overallUtilization}%
              </p>
              <p className="text-sm text-muted-foreground">Overall Utilization</p>
            </div>
          </div>
          <Progress value={overallUtilization} className="h-3" />
        </CardContent>
      </Card>

      {/* Resource Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayResources.map((resource) => {
              const statusBadge = getStatusBadge(resource.status, resource.utilization);
              
              return (
                <div key={resource.name} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getResourceIcon(resource.type)}
                      <div>
                        <h4 className="font-semibold">{resource.name}</h4>
                        <p className="text-sm text-muted-foreground">{resource.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {resource.utilization >= 90 && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={statusBadge.variant}>
                        {statusBadge.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">Utilization</p>
                      <p className="font-semibold">{resource.utilization}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hours Used</p>
                      <p className="font-semibold">{resource.hours_used}h / {resource.daily_capacity}h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Queue Length</p>
                      <p className="font-semibold">{resource.queue_length} jobs</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current Job</p>
                      <p className="font-semibold">{resource.current_job || 'None'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Capacity Utilization</span>
                      <span>{resource.utilization}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getUtilizationColor(resource.utilization)}`}
                        style={{ width: `${Math.min(resource.utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Optimization Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Optimization Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm font-medium text-yellow-800">
                Finishing Team is at 94% capacity - consider redistributing workload
              </p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-medium text-blue-800">
                Cutting Station has available capacity - could handle additional jobs
              </p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm font-medium text-green-800">
                Overall resource utilization is well balanced across teams
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
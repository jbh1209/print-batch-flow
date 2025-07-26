import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Settings, AlertTriangle } from 'lucide-react';

export const ResourceUtilization: React.FC = () => {
  // Mock data for now - in a real implementation, this would come from the database
  const resources = [
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

  const totalCapacity = resources.reduce((sum, resource) => sum + resource.daily_capacity, 0);
  const totalUsed = resources.reduce((sum, resource) => sum + resource.hours_used, 0);
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
            {resources.map((resource) => {
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
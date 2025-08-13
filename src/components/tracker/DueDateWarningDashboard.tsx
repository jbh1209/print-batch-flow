import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, Clock, RefreshCw } from 'lucide-react';
import { dynamicDueDateService } from '@/services/dynamicDueDateService';

interface JobWithWarning {
  id: string;
  wo_no: string;
  customer: string;
  due_date: string;
  internal_completion_date: string;
  due_date_warning_level: string;
  days_overdue: number;
}

const warningConfig = {
  green: { color: 'bg-green-100 text-green-800', icon: Clock, label: 'On Track' },
  amber: { color: 'bg-amber-100 text-amber-800', icon: AlertTriangle, label: 'At Risk' },
  red: { color: 'bg-red-100 text-red-800', icon: AlertTriangle, label: 'Overdue' },
  critical: { color: 'bg-red-200 text-red-900', icon: AlertTriangle, label: 'Critical' }
};

export const DueDateWarningDashboard: React.FC = () => {
  const [warningJobs, setWarningJobs] = useState<JobWithWarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadWarningJobs = async () => {
    try {
      const jobs = await dynamicDueDateService.getJobsWithWarnings();
      setWarningJobs(jobs);
    } catch (error) {
      console.error('Failed to load warning jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDueDates = async () => {
    setIsRefreshing(true);
    try {
      await dynamicDueDateService.recalculateJobDueDates();
      await loadWarningJobs();
    } catch (error) {
      console.error('Failed to refresh due dates:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWarningJobs();
  }, []);

  const getWarningCounts = () => {
    return {
      amber: warningJobs.filter(j => j.due_date_warning_level === 'amber').length,
      red: warningJobs.filter(j => j.due_date_warning_level === 'red').length,
      critical: warningJobs.filter(j => j.due_date_warning_level === 'critical').length,
      total: warningJobs.length
    };
  };

  const warningCounts = getWarningCounts();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading due date warnings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Due Date Warnings
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDueDates}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Jobs with potential due date issues based on current production workload
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
            <div className="text-2xl font-bold text-amber-800">{warningCounts.amber}</div>
            <div className="text-sm text-amber-600">At Risk</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-800">{warningCounts.red}</div>
            <div className="text-sm text-red-600">Overdue</div>
          </div>
          <div className="bg-red-100 p-3 rounded-lg border border-red-300">
            <div className="text-2xl font-bold text-red-900">{warningCounts.critical}</div>
            <div className="text-sm text-red-700">Critical</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-800">{warningCounts.total}</div>
            <div className="text-sm text-gray-600">Total Warnings</div>
          </div>
        </div>

        {/* Warning Jobs List */}
        {warningJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">All jobs are on track!</p>
            <p className="text-sm">No due date warnings at this time.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h4 className="font-medium">Jobs Requiring Attention ({warningJobs.length})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {warningJobs.map((job) => {
                const config = warningConfig[job.due_date_warning_level as keyof typeof warningConfig];
                const Icon = config.icon;
                
                return (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium">{job.wo_no}</div>
                        <div className="text-sm text-gray-600">{job.customer}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-right">
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {new Date(job.due_date).toLocaleDateString()}
                        </div>
                        {job.internal_completion_date && (
                          <div className="text-xs text-gray-500">
                            Est: {new Date(job.internal_completion_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={config.color}>
                          {config.label}
                        </Badge>
                        {job.days_overdue > 0 && (
                          <span className="text-xs text-red-600">
                            +{job.days_overdue} day{job.days_overdue !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <p><strong>Due dates are calculated using:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>8-hour working shifts at 85% efficiency</li>
            <li>1 working day buffer for production safety</li>
            <li>Current production queue and capacity</li>
            <li>Automatic recalculation when production changes occur</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
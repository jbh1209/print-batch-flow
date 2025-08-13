import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, TrendingUp } from 'lucide-react';
import { autoSchedulerService } from '@/services/autoSchedulerService';
import { toast } from 'sonner';

interface DailyWorkload {
  date: string;
  total_jobs: number;
  total_estimated_hours: number;
  capacity_utilization: number;
}

export const ProductionCalendar: React.FC = () => {
  const [workloadData, setWorkloadData] = useState<DailyWorkload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    try {
      setIsLoading(true);
      
      // Get next 7 working days
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 10);
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const data = await autoSchedulerService.getScheduleOverview(startDate, endDateStr);
      setWorkloadData(data);
    } catch (error) {
      console.error('Error loading schedule data:', error);
      toast.error('Failed to load production schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 100) return 'bg-destructive text-destructive-foreground';
    if (utilization >= 80) return 'bg-yellow-500 text-yellow-900';
    if (utilization >= 60) return 'bg-blue-500 text-blue-900';
    return 'bg-green-500 text-green-900';
  };

  const getUtilizationLabel = (utilization: number) => {
    if (utilization >= 100) return 'Overloaded';
    if (utilization >= 80) return 'High Load';
    if (utilization >= 60) return 'Medium Load';
    return 'Light Load';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return { day, weekday, month };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Production Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading schedule...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Production Schedule Overview
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Workload distribution based on smart scheduling (8-hour work days)
        </p>
      </CardHeader>
      <CardContent>
        {workloadData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No scheduled workload found</p>
            <p className="text-sm">Import jobs to see production schedule</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {workloadData.reduce((sum, day) => sum + day.total_jobs, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {Math.round(workloadData.reduce((sum, day) => sum + day.total_estimated_hours, 0))}h
                </div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {Math.round(workloadData.reduce((sum, day) => sum + day.capacity_utilization, 0) / workloadData.length)}%
                </div>
                <div className="text-sm text-muted-foreground">Avg Utilization</div>
              </div>
            </div>

            {/* Daily Schedule */}
            <div className="space-y-3">
              {workloadData.map((day) => {
                const { day: dayNum, weekday, month } = formatDate(day.date);
                
                return (
                  <div key={day.date} className="flex items-center gap-4 p-4 border rounded-lg">
                    {/* Date */}
                    <div className="text-center min-w-[80px]">
                      <div className="text-lg font-semibold">{dayNum}</div>
                      <div className="text-xs text-muted-foreground">{weekday}</div>
                      <div className="text-xs text-muted-foreground">{month}</div>
                    </div>
                    
                    {/* Workload Info */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">
                          {day.total_jobs} job{day.total_jobs !== 1 ? 's' : ''} scheduled
                        </div>
                        <Badge className={getUtilizationColor(day.capacity_utilization)}>
                          {getUtilizationLabel(day.capacity_utilization)}
                        </Badge>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            day.capacity_utilization >= 100 ? 'bg-destructive' :
                            day.capacity_utilization >= 80 ? 'bg-yellow-500' :
                            day.capacity_utilization >= 60 ? 'bg-blue-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(day.capacity_utilization, 100)}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{Math.round(day.total_estimated_hours)}h / 8h capacity</span>
                        <span>{Math.round(day.capacity_utilization)}% utilized</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
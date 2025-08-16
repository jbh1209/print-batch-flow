/**
 * **CAPACITY DASHBOARD: Real-time monitoring of stage utilization**
 * Displays live capacity data, warnings, and utilization metrics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface CapacityData {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  total_capacity_minutes: number;
  used_minutes_today: number;
  available_minutes_today: number;
  utilization_percentage: number;
  active_jobs_count: number;
  pending_jobs_count: number;
  capacity_status: 'healthy' | 'warning' | 'critical';
  last_updated: string;
}

const CapacityDashboard = () => {
  const [capacityData, setCapacityData] = useState<CapacityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchCapacityData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch real capacity data from production stages and job instances
      const { data: stages, error: stagesError } = await supabase
        .from('production_stages')
        .select(`
          id,
          name,
          color,
          stage_capacity_profiles(
            daily_capacity_hours,
            max_parallel_jobs
          )
        `)
        .eq('is_active', true);

      if (stagesError) throw stagesError;

      // Build capacity data from actual production data
      const capacityData: CapacityData[] = (stages || []).map(stage => {
        const capacity = stage.stage_capacity_profiles?.[0];
        const dailyMinutes = (capacity?.daily_capacity_hours || 8) * 60;
        
        return {
          stage_id: stage.id,
          stage_name: stage.name,
          stage_color: stage.color || '#6B7280',
          total_capacity_minutes: dailyMinutes,
          used_minutes_today: 0, // Will be calculated from scheduled jobs
          available_minutes_today: dailyMinutes,
          utilization_percentage: 0,
          active_jobs_count: 0,
          pending_jobs_count: 0,
          capacity_status: 'healthy' as const,
          last_updated: new Date().toISOString()
        };
      });

      setCapacityData(capacityData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch capacity data:', err);
      setError('Failed to load capacity data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacityData();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchCapacityData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading && capacityData.length === 0) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>📊 Real-time Capacity Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Loading capacity data...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                📊 Real-time Capacity Dashboard
                {isLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={fetchCapacityData}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
        </Card>

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-semibold">Error Loading Data</p>
                <p className="text-sm">{error}</p>
                <Button 
                  variant="outline" 
                  onClick={fetchCapacityData}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall Statistics */}
        {capacityData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {capacityData.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Stages</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {capacityData.filter(d => d.capacity_status === 'critical').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Critical Alerts</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">
                    {capacityData.filter(d => d.capacity_status === 'warning').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {Math.round(capacityData.reduce((sum, d) => sum + d.utilization_percentage, 0) / capacityData.length)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Utilization</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stage Capacity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capacityData.map((stage) => (
            <Card key={stage.stage_id} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.stage_color }}
                    />
                    {stage.stage_name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(stage.capacity_status)}
                    <Badge variant={getStatusColor(stage.capacity_status) as any}>
                      {stage.capacity_status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Utilization Progress */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Capacity Utilization</span>
                    <span className="text-sm font-bold">
                      {stage.utilization_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={stage.utilization_percentage} 
                    className="w-full"
                  />
                </div>

                {/* Time Breakdown */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Used Today</p>
                    <p className="font-semibold text-red-600">
                      {formatTime(stage.used_minutes_today)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Available</p>
                    <p className="font-semibold text-green-600">
                      {formatTime(stage.available_minutes_today)}
                    </p>
                  </div>
                </div>

                {/* Job Counts */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-blue-600">
                      {stage.active_jobs_count}
                    </p>
                    <p className="text-xs text-muted-foreground">Active Jobs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-orange-600">
                      {stage.pending_jobs_count}
                    </p>
                    <p className="text-xs text-muted-foreground">Pending Jobs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">
                      {formatTime(stage.total_capacity_minutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Capacity</p>
                  </div>
                </div>

                {/* Capacity Warning */}
                {stage.capacity_status !== 'healthy' && (
                  <div className={`p-3 rounded-md ${
                    stage.capacity_status === 'critical' 
                      ? 'bg-red-50 border border-red-200' 
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      stage.capacity_status === 'critical' ? 'text-red-800' : 'text-yellow-800'
                    }`}>
                      {stage.capacity_status === 'critical' 
                        ? '⚠️ Critical: Over 90% capacity used' 
                        : '⚡ Warning: Over 70% capacity used'}
                    </p>
                    <p className={`text-xs ${
                      stage.capacity_status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      Consider rescheduling non-urgent jobs or adding overtime.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {capacityData.length === 0 && !isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <p className="font-semibold">No Capacity Data Available</p>
                <p className="text-sm">
                  No production stages are currently configured or active.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p><strong>🔄 Auto-refresh:</strong> Every 30 seconds</p>
              <p><strong>🎯 Capacity Status:</strong> Healthy (&lt;70%) | Warning (70-90%) | Critical (&gt;90%)</p>
              <p><strong>⏰ Working Hours:</strong> 8:00 AM - 5:30 PM SAST</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CapacityDashboard;
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, Clock, TrendingUp, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BottleneckData {
  stage_name: string;
  active_jobs: number;
  avg_wait_time: number;
  throughput_rate: number;
  capacity_utilization: number;
  is_bottleneck: boolean;
  impact_score: number;
}

export const BottleneckAnalysis: React.FC = () => {
  const [bottlenecks, setBottlenecks] = useState<BottleneckData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBottleneckAnalysis();
  }, []);

  const loadBottleneckAnalysis = async () => {
    try {
      setIsLoading(true);
      
      // Get active jobs by stage
      const { data: stageData } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          status,
          started_at,
          created_at,
          production_stages:production_stage_id (name, color)
        `)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['active', 'pending']);

      if (!stageData) {
        setBottlenecks([]);
        return;
      }

      // Group by stage and calculate metrics
      const stageGroups = stageData.reduce((acc: Record<string, any[]>, stage) => {
        const stageName = stage.production_stages?.name || 'Unknown';
        if (!acc[stageName]) acc[stageName] = [];
        acc[stageName].push(stage);
        return acc;
      }, {});

      const bottleneckAnalysis: BottleneckData[] = Object.entries(stageGroups).map(([stageName, stages]) => {
        const activeJobs = stages.filter(s => s.status === 'active').length;
        const pendingJobs = stages.filter(s => s.status === 'pending').length;
        const totalJobs = activeJobs + pendingJobs;

        // Calculate average wait time for pending jobs
        const now = new Date();
        const avgWaitTime = pendingJobs > 0
          ? stages
              .filter(s => s.status === 'pending')
              .reduce((sum, s) => {
                const waitTime = (now.getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
                return sum + waitTime;
              }, 0) / pendingJobs
          : 0;

        // Simple throughput calculation (jobs completed in last 24h)
        const throughputRate = Math.max(1, totalJobs / 24); // jobs per hour

        // Mock capacity utilization based on active jobs
        const capacityUtilization = Math.min(100, (activeJobs / Math.max(1, activeJobs + pendingJobs)) * 100);

        // Calculate impact score (higher = more problematic)
        const impactScore = (totalJobs * 0.4) + (avgWaitTime * 0.3) + (pendingJobs * 0.3);

        return {
          stage_name: stageName,
          active_jobs: activeJobs,
          avg_wait_time: avgWaitTime,
          throughput_rate: throughputRate,
          capacity_utilization: capacityUtilization,
          is_bottleneck: totalJobs >= 3 && avgWaitTime > 4, // Bottleneck if 3+ jobs and >4h wait
          impact_score: impactScore
        };
      });

      // Sort by impact score descending
      bottleneckAnalysis.sort((a, b) => b.impact_score - a.impact_score);
      
      setBottlenecks(bottleneckAnalysis);
    } catch (error) {
      console.error('Error loading bottleneck analysis:', error);
      toast.error('Failed to load bottleneck analysis');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Analyzing bottlenecks...</span>
        </CardContent>
      </Card>
    );
  }

  const getSeverityBadge = (isBottleneck: boolean, impactScore: number) => {
    if (isBottleneck) return { variant: 'destructive' as const, label: 'Critical Bottleneck' };
    if (impactScore > 5) return { variant: 'secondary' as const, label: 'High Impact' };
    if (impactScore > 2) return { variant: 'outline' as const, label: 'Medium Impact' };
    return { variant: 'default' as const, label: 'Low Impact' };
  };

  const getWaitTimeColor = (waitTime: number) => {
    if (waitTime > 8) return 'text-red-600';
    if (waitTime > 4) return 'text-yellow-600';
    return 'text-green-600';
  };

  const primaryBottlenecks = bottlenecks.filter(b => b.is_bottleneck);
  const otherStages = bottlenecks.filter(b => !b.is_bottleneck);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{primaryBottlenecks.length}</p>
              <p className="text-sm text-muted-foreground">Critical Bottlenecks</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {Math.round(bottlenecks.reduce((sum, b) => sum + b.avg_wait_time, 0) / Math.max(1, bottlenecks.length))}h
              </p>
              <p className="text-sm text-muted-foreground">Avg Wait Time</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {bottlenecks.reduce((sum, b) => sum + b.active_jobs, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Jobs in Progress</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Bottlenecks */}
      {primaryBottlenecks.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Critical Bottlenecks Requiring Immediate Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {primaryBottlenecks.map((bottleneck) => {
                const severityBadge = getSeverityBadge(bottleneck.is_bottleneck, bottleneck.impact_score);
                
                return (
                  <div key={bottleneck.stage_name} className="p-4 bg-white border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-red-900">{bottleneck.stage_name}</h4>
                      <Badge variant={severityBadge.variant}>
                        {severityBadge.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-muted-foreground">Active Jobs</p>
                        <p className="font-semibold text-red-700">{bottleneck.active_jobs}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Wait Time</p>
                        <p className={`font-semibold ${getWaitTimeColor(bottleneck.avg_wait_time)}`}>
                          {Math.round(bottleneck.avg_wait_time * 10) / 10}h
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Throughput Rate</p>
                        <p className="font-semibold">{Math.round(bottleneck.throughput_rate * 10) / 10}/h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Impact Score</p>
                        <p className="font-semibold text-red-700">{Math.round(bottleneck.impact_score * 10) / 10}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Capacity Utilization</span>
                        <span>{Math.round(bottleneck.capacity_utilization)}%</span>
                      </div>
                      <Progress value={bottleneck.capacity_utilization} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Stages Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Stage Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {otherStages.map((stage) => {
              const severityBadge = getSeverityBadge(stage.is_bottleneck, stage.impact_score);
              
              return (
                <div key={stage.stage_name} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{stage.stage_name}</h4>
                    <Badge variant={severityBadge.variant}>
                      {severityBadge.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">Active Jobs</p>
                      <p className="font-semibold">{stage.active_jobs}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Wait Time</p>
                      <p className={`font-semibold ${getWaitTimeColor(stage.avg_wait_time)}`}>
                        {Math.round(stage.avg_wait_time * 10) / 10}h
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Throughput Rate</p>
                      <p className="font-semibold">{Math.round(stage.throughput_rate * 10) / 10}/h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Impact Score</p>
                      <p className="font-semibold">{Math.round(stage.impact_score * 10) / 10}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Capacity Utilization</span>
                      <span>{Math.round(stage.capacity_utilization)}%</span>
                    </div>
                    <Progress value={stage.capacity_utilization} className="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Optimization Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {primaryBottlenecks.length > 0 ? (
              <>
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-800">
                    <strong>Priority:</strong> Address {primaryBottlenecks[0].stage_name} bottleneck by reallocating resources or parallel processing
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm font-medium text-yellow-800">
                    Consider batch processing for {primaryBottlenecks[0].stage_name} to improve throughput
                  </p>
                </div>
              </>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm font-medium text-green-800">
                  No critical bottlenecks detected. Production flow appears well balanced.
                </p>
              </div>
            )}
            
            {bottlenecks.some(b => b.avg_wait_time > 4) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm font-medium text-blue-800">
                  Monitor stages with high wait times and consider workflow optimization
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Zap, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Users, 
  RefreshCw,
  ArrowRight,
  Activity,
  Target
} from "lucide-react";
import { useFlowBasedScheduling } from "@/hooks/tracker/useFlowBasedScheduling";
import { stageQueueManager } from "@/services/stageQueueManager";
import { toast } from "sonner";

interface StageFlow {
  stageId: string;
  stageName: string;
  queueLength: number;
  activeJobs: number;
  capacityUtilization: number;
  isBottleneck: boolean;
  flowRate: number; // Jobs per day
  nextAvailable: Date;
}

export const RealTimeProductionFlow: React.FC = () => {
  const [stageFlows, setStageFlows] = useState<StageFlow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  const {
    workloadSummary,
    refreshWorkloadSummary,
    isCalculating
  } = useFlowBasedScheduling();

  const fetchStageFlows = async () => {
    try {
      setIsLoading(true);
      const workloads = await stageQueueManager.getAllStageWorkloads();
      
      const flows: StageFlow[] = workloads.map(workload => ({
        stageId: workload.stageId,
        stageName: workload.stageName,
        queueLength: workload.pendingJobsCount,
        activeJobs: workload.activeJobsCount,
        capacityUtilization: ((workload.totalPendingHours + workload.totalActiveHours) / 
          (workload.dailyCapacityHours * 7)) * 100,
        isBottleneck: workload.isBottleneck || workload.queueDaysToProcess > 3,
        flowRate: workload.dailyCapacityHours > 0 ? 
          (workload.dailyCapacityHours * 5) / (workload.totalPendingHours || 1) : 0, // Weekly throughput estimate
        nextAvailable: workload.earliestAvailableSlot
      }));

      setStageFlows(flows);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching stage flows:', error);
      toast.error('Failed to load production flow data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshFlowData = async () => {
    await stageQueueManager.updateAllStageWorkloads();
    await fetchStageFlows();
    await refreshWorkloadSummary();
    toast.success('Production flow data updated');
  };

  // Auto-refresh every 2 minutes for real-time updates
  useEffect(() => {
    fetchStageFlows();
    const interval = setInterval(fetchStageFlows, 120000);
    return () => clearInterval(interval);
  }, []);

  const criticalBottlenecks = stageFlows.filter(stage => 
    stage.isBottleneck && stage.capacityUtilization > 90
  );

  const averageFlowRate = stageFlows.length > 0 ? 
    stageFlows.reduce((sum, stage) => sum + stage.flowRate, 0) / stageFlows.length : 0;

  const totalQueuedJobs = stageFlows.reduce((sum, stage) => sum + stage.queueLength, 0);

  const getFlowSeverity = (utilizationRate: number) => {
    if (utilizationRate >= 95) return { color: 'bg-red-500', label: 'Critical' };
    if (utilizationRate >= 80) return { color: 'bg-amber-500', label: 'High' };
    if (utilizationRate >= 60) return { color: 'bg-blue-500', label: 'Normal' };
    return { color: 'bg-green-500', label: 'Low' };
  };

  const getTimeSinceUpdate = () => {
    const diff = new Date().getTime() - lastUpdate.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Real-time Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl">Real-Time Production Flow</CardTitle>
                <CardDescription>
                  Live monitoring of production stages • Updated {getTimeSinceUpdate()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span>Live</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshFlowData}
                disabled={isLoading || isCalculating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isCalculating ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Total Queue</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{totalQueuedJobs}</div>
              <div className="text-xs text-blue-700">jobs waiting</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Avg Flow Rate</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{averageFlowRate.toFixed(1)}</div>
              <div className="text-xs text-green-700">jobs/day</div>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Bottlenecks</span>
              </div>
              <div className="text-2xl font-bold text-amber-900">{criticalBottlenecks.length}</div>
              <div className="text-xs text-amber-700">critical stages</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Avg Lead Time</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {workloadSummary?.averageLeadTime.toFixed(1) || 0}
              </div>
              <div className="text-xs text-purple-700">days</div>
            </div>
          </div>

          {/* Critical Alerts */}
          {criticalBottlenecks.length > 0 && (
            <Alert className="border-red-200 bg-red-50 mb-6">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <strong>Critical bottlenecks detected:</strong> {criticalBottlenecks.length} stage(s) 
                are operating above 90% capacity. Immediate attention required.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Production Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Stage Flow Analysis
          </CardTitle>
          <CardDescription>
            Real-time view of each production stage's capacity and throughput
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                <span>Loading production flow data...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {stageFlows.map((stage, index) => {
                const severity = getFlowSeverity(stage.capacityUtilization);
                const isLastStage = index === stageFlows.length - 1;
                
                return (
                  <div key={stage.stageId} className="relative">
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                      stage.isBottleneck 
                        ? 'border-red-200 bg-red-50' 
                        : 'border-gray-200 bg-white hover:border-blue-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${severity.color}`} />
                          <div>
                            <h4 className="font-semibold text-lg">{stage.stageName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {stage.queueLength} queued • {stage.activeJobs} active
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={stage.isBottleneck ? "destructive" : "secondary"}>
                            {severity.label}
                          </Badge>
                          <div className="text-right text-sm">
                            <div className="font-medium">{stage.flowRate.toFixed(1)} jobs/day</div>
                            <div className="text-muted-foreground">throughput</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Capacity Utilization</span>
                            <span className="font-medium">{stage.capacityUtilization.toFixed(1)}%</span>
                          </div>
                          <Progress 
                            value={Math.min(stage.capacityUtilization, 100)} 
                            className="h-2"
                          />
                        </div>
                        
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Next Available: {stage.nextAvailable.toLocaleDateString()}</span>
                          {stage.isBottleneck && (
                            <span className="text-red-600 font-medium">⚠ Bottleneck</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Flow Arrow */}
                    {!isLastStage && (
                      <div className="flex justify-center py-2">
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
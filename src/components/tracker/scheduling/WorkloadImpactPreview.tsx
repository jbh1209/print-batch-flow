import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Users } from "lucide-react";
import type { CapacityImpact, WorkloadSummary } from "@/hooks/tracker/useFlowBasedScheduling";

interface WorkloadImpactPreviewProps {
  currentWorkload: WorkloadSummary;
  capacityImpact?: CapacityImpact;
  newJobsCount: number;
  isCalculating?: boolean;
}

export const WorkloadImpactPreview: React.FC<WorkloadImpactPreviewProps> = ({
  currentWorkload,
  capacityImpact,
  newJobsCount,
  isCalculating = false
}) => {
  return (
    <div className="space-y-6">
      {/* Current State Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Current Production State
          </CardTitle>
          <CardDescription>
            Overview of your current production workload
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{currentWorkload.totalPendingJobs}</div>
              <div className="text-sm text-muted-foreground">Pending Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{currentWorkload.totalPendingHours}h</div>
              <div className="text-sm text-muted-foreground">Work Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{currentWorkload.averageLeadTime.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Avg Lead Time (days)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{currentWorkload.capacityUtilization.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Capacity Used</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Bottlenecks */}
      {currentWorkload.bottleneckStages.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Current Bottlenecks
            </CardTitle>
            <CardDescription>
              Stages that are currently overloaded and may delay production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentWorkload.bottleneckStages.map((stage, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <div className="font-medium">{stage.stageName}</div>
                    <div className="text-sm text-muted-foreground">{stage.pendingJobs} jobs in queue</div>
                  </div>
                  <Badge variant="destructive">
                    {stage.queueDays.toFixed(1)} days
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Analysis */}
      {capacityImpact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Adding {newJobsCount} New Jobs - Impact Analysis
            </CardTitle>
            <CardDescription>
              How these new jobs will affect your production timeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Overall Impact */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Total Additional Production Time</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                +{capacityImpact.totalImpactDays.toFixed(1)} days
              </div>
              <div className="text-sm text-blue-700">
                Across all production stages
              </div>
            </div>

            {/* Stage-by-Stage Impact */}
            <div className="space-y-3">
              <h4 className="font-medium">Impact by Stage</h4>
              {capacityImpact.stageImpacts.map((impact, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{impact.stageName}</div>
                    <div className="text-sm text-muted-foreground">
                      Queue: {impact.currentQueueDays.toFixed(1)} → {impact.newQueueDays.toFixed(1)} days
                    </div>
                  </div>
                  <Badge 
                    variant={impact.additionalDays > 2 ? "destructive" : impact.additionalDays > 1 ? "secondary" : "default"}
                  >
                    +{impact.additionalDays.toFixed(1)} days
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isCalculating && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-blue-800">Calculating production impact...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
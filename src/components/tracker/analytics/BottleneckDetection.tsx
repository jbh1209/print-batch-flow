
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Target, Clock, Users } from "lucide-react";

interface BottleneckData {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  bottleneck_score: number;
  active_jobs: number;
  avg_duration_hours: number;
  capacity_utilization: number;
  severity: "critical" | "high" | "medium" | "low";
  recommendations: string[];
}

interface BottleneckDetectionProps {
  bottlenecks: BottleneckData[];
  isLoading?: boolean;
}

export const BottleneckDetection = ({ bottlenecks, isLoading }: BottleneckDetectionProps) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-50 text-red-700 border-red-200";
      case "high": return "bg-orange-50 text-orange-700 border-orange-200";
      case "medium": return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "low": return "bg-green-50 text-green-700 border-green-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "low": return <Target className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Bottleneck Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalBottlenecks = bottlenecks.filter(b => b.severity === "critical");
  const highBottlenecks = bottlenecks.filter(b => b.severity === "high");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Bottleneck Detection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticalBottlenecks.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">
              {criticalBottlenecks.length} critical bottleneck{criticalBottlenecks.length > 1 ? 's' : ''} detected that require immediate attention.
            </AlertDescription>
          </Alert>
        )}

        {highBottlenecks.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <Clock className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700">
              {highBottlenecks.length} high-priority bottleneck{highBottlenecks.length > 1 ? 's' : ''} may impact workflow efficiency.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {bottlenecks.map(bottleneck => (
            <div key={bottleneck.stage_id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: bottleneck.stage_color }}
                  />
                  <h4 className="font-medium">{bottleneck.stage_name}</h4>
                  {getSeverityIcon(bottleneck.severity)}
                </div>
                <Badge 
                  variant="outline" 
                  className={getSeverityColor(bottleneck.severity)}
                >
                  {bottleneck.severity}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{bottleneck.active_jobs}</div>
                  <div className="text-xs text-gray-600">Active Jobs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{bottleneck.avg_duration_hours.toFixed(1)}h</div>
                  <div className="text-xs text-gray-600">Avg Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{bottleneck.bottleneck_score.toFixed(1)}</div>
                  <div className="text-xs text-gray-600">Bottleneck Score</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Capacity Utilization</span>
                  <span className="font-medium">{bottleneck.capacity_utilization.toFixed(0)}%</span>
                </div>
                <Progress value={bottleneck.capacity_utilization} className="h-2" />
              </div>

              {bottleneck.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    Recommendations
                  </h5>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {bottleneck.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {bottlenecks.length === 0 && (
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-medium text-green-700 mb-1">No Critical Bottlenecks</h3>
            <p className="text-sm text-green-600">Your workflow is running efficiently!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

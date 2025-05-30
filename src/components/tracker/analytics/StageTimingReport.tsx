
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp, AlertCircle } from "lucide-react";

interface StageTimingData {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  avg_duration_hours: number;
  min_duration_hours: number;
  max_duration_hours: number;
  total_completions: number;
  trend: "up" | "down" | "stable";
  efficiency_rating: "excellent" | "good" | "average" | "poor";
}

interface StageTimingReportProps {
  stages: StageTimingData[];
  isLoading?: boolean;
}

export const StageTimingReport = ({ stages, isLoading }: StageTimingReportProps) => {
  const getEfficiencyColor = (rating: string) => {
    switch (rating) {
      case "excellent": return "bg-green-50 text-green-700 border-green-200";
      case "good": return "bg-blue-50 text-blue-700 border-blue-200";
      case "average": return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "poor": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "down": return <TrendingUp className="h-4 w-4 text-green-500 rotate-180" />;
      default: return <div className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Stage Timing Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Stage Timing Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map(stage => (
            <div key={stage.stage_id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: stage.stage_color }}
                  />
                  <h4 className="font-medium">{stage.stage_name}</h4>
                  {getTrendIcon(stage.trend)}
                </div>
                <Badge 
                  variant="outline" 
                  className={getEfficiencyColor(stage.efficiency_rating)}
                >
                  {stage.efficiency_rating}
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Average</span>
                  <div className="font-medium">{stage.avg_duration_hours.toFixed(1)}h</div>
                </div>
                <div>
                  <span className="text-gray-600">Minimum</span>
                  <div className="font-medium">{stage.min_duration_hours.toFixed(1)}h</div>
                </div>
                <div>
                  <span className="text-gray-600">Maximum</span>
                  <div className="font-medium">{stage.max_duration_hours.toFixed(1)}h</div>
                </div>
                <div>
                  <span className="text-gray-600">Completions</span>
                  <div className="font-medium">{stage.total_completions}</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Duration Range</span>
                  <span>{stage.min_duration_hours.toFixed(1)}h - {stage.max_duration_hours.toFixed(1)}h</span>
                </div>
                <Progress 
                  value={Math.min(100, (stage.avg_duration_hours / stage.max_duration_hours) * 100)} 
                  className="h-2"
                />
              </div>

              {stage.efficiency_rating === "poor" && (
                <div className="flex items-center gap-2 text-orange-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>This stage may need optimization</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

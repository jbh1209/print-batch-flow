
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, RefreshCw, Wrench } from "lucide-react";
import { useWorkflowMonitoring } from "@/hooks/tracker/useWorkflowMonitoring";

interface WorkflowMonitoringWidgetProps {
  enabled?: boolean;
  showActions?: boolean;
  className?: string;
}

export const WorkflowMonitoringWidget: React.FC<WorkflowMonitoringWidgetProps> = ({
  enabled = true,
  showActions = true,
  className = ""
}) => {
  const { alerts, isMonitoring, checkWorkflowIntegrity, autoRepairWorkflows } = useWorkflowMonitoring(enabled);

  const severityColors = {
    low: 'secondary',
    medium: 'outline',
    high: 'destructive'
  } as const;

  const severityIcons = {
    low: <CheckCircle className="h-4 w-4" />,
    medium: <AlertTriangle className="h-4 w-4" />,
    high: <AlertTriangle className="h-4 w-4" />
  };

  const highSeverityCount = alerts.filter(alert => alert.severity === 'high').length;
  const mediumSeverityCount = alerts.filter(alert => alert.severity === 'medium').length;
  const lowSeverityCount = alerts.filter(alert => alert.severity === 'low').length;

  const handleAutoRepair = async () => {
    const repairableAlerts = alerts
      .filter(alert => alert.type === 'missing_stages')
      .map(alert => alert.id);
    
    if (repairableAlerts.length > 0) {
      await autoRepairWorkflows(repairableAlerts);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Workflow Health</span>
          {isMonitoring && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Monitoring
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-red-50 rounded">
            <div className="text-lg font-bold text-red-600">{highSeverityCount}</div>
            <div className="text-xs text-red-600">Critical</div>
          </div>
          <div className="p-2 bg-orange-50 rounded">
            <div className="text-lg font-bold text-orange-600">{mediumSeverityCount}</div>
            <div className="text-xs text-orange-600">Medium</div>
          </div>
          <div className="p-2 bg-blue-50 rounded">
            <div className="text-lg font-bold text-blue-600">{lowSeverityCount}</div>
            <div className="text-xs text-blue-600">Low</div>
          </div>
        </div>

        {/* Recent Alerts */}
        {alerts.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Issues</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                  <Badge variant={severityColors[alert.severity]} className="h-5 px-1">
                    {severityIcons[alert.severity]}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{alert.job_wo_no}</div>
                    <div className="text-muted-foreground truncate">{alert.message}</div>
                  </div>
                </div>
              ))}
            </div>
            {alerts.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{alerts.length - 3} more issues
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <div className="text-sm font-medium text-green-600">All workflows healthy</div>
            <div className="text-xs text-muted-foreground">No issues detected</div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={checkWorkflowIntegrity}
              className="flex-1"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
            {alerts.some(alert => alert.type === 'missing_stages') && (
              <Button
                size="sm"
                onClick={handleAutoRepair}
                className="flex-1"
              >
                <Wrench className="h-3 w-3 mr-1" />
                Auto-Repair
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

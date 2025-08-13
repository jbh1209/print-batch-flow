
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, RefreshCw, Wrench, Clock, Zap } from "lucide-react";
import { useWorkflowMonitoring } from "@/hooks/tracker/useWorkflowMonitoring";
import { formatDistanceToNow } from "@/utils/date-polyfills";

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
  const { alerts, isMonitoring, lastCheck, checkWorkflowIntegrity, autoRepairWorkflows } = useWorkflowMonitoring(enabled);

  const severityColors = {
    low: 'secondary',
    medium: 'outline',
    high: 'destructive',
    critical: 'destructive'
  } as const;

  const severityIcons = {
    low: <CheckCircle className="h-3 w-3" />,
    medium: <Clock className="h-3 w-3" />,
    high: <AlertTriangle className="h-3 w-3" />,
    critical: <AlertTriangle className="h-3 w-3" />
  };

  const criticalCount = alerts.filter(alert => alert.severity === 'critical').length;
  const highCount = alerts.filter(alert => alert.severity === 'high').length;
  const mediumCount = alerts.filter(alert => alert.severity === 'medium').length;
  const autoRepairableCount = alerts.filter(alert => alert.auto_repairable).length;

  const handleAutoRepair = async () => {
    const repairableAlerts = alerts
      .filter(alert => alert.auto_repairable)
      .map(alert => alert.id);
    
    if (repairableAlerts.length > 0) {
      await autoRepairWorkflows(repairableAlerts);
    }
  };

  const getHealthStatus = () => {
    if (criticalCount > 0) return { text: 'Critical Issues', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (highCount > 0) return { text: 'Issues Found', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    if (mediumCount > 0) return { text: 'Minor Issues', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { text: 'Healthy', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  const healthStatus = getHealthStatus();

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Workflow Monitor</span>
          <div className="flex items-center gap-2">
            {isMonitoring && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Checking
              </div>
            )}
            {lastCheck && (
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(lastCheck, { addSuffix: true })}
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className={`p-3 rounded-lg ${healthStatus.bgColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${healthStatus.color}`}>{healthStatus.text}</div>
              <div className="text-sm text-muted-foreground">
                {alerts.length === 0 ? 'All workflows functioning correctly' : `${alerts.length} issue${alerts.length > 1 ? 's' : ''} detected`}
              </div>
            </div>
            {alerts.length === 0 ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertTriangle className={`h-6 w-6 ${criticalCount > 0 ? 'text-red-500' : highCount > 0 ? 'text-orange-500' : 'text-yellow-500'}`} />
            )}
          </div>
        </div>

        {/* Issue Breakdown */}
        {alerts.length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-red-50 rounded">
              <div className="text-lg font-bold text-red-600">{criticalCount + highCount}</div>
              <div className="text-xs text-red-600">High Priority</div>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <div className="text-lg font-bold text-green-600">{autoRepairableCount}</div>
              <div className="text-xs text-green-600">Auto-Fixable</div>
            </div>
          </div>
        )}

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Issues</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                  <Badge variant={severityColors[alert.severity]} className="h-5 px-1 flex items-center gap-1">
                    {severityIcons[alert.severity]}
                    <span className="sr-only">{alert.severity}</span>
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{alert.job_wo_no}</div>
                    <div className="text-muted-foreground truncate">{alert.message}</div>
                  </div>
                  {alert.auto_repairable && (
                    <Zap className="h-3 w-3 text-green-500" />
                  )}
                </div>
              ))}
            </div>
            {alerts.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{alerts.length - 3} more issues
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={checkWorkflowIntegrity}
              disabled={isMonitoring}
              className="flex-1"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isMonitoring ? 'animate-spin' : ''}`} />
              {isMonitoring ? 'Checking...' : 'Check Now'}
            </Button>
            {autoRepairableCount > 0 && (
              <Button
                size="sm"
                onClick={handleAutoRepair}
                className="flex-1"
                disabled={isMonitoring}
              >
                <Wrench className="h-3 w-3 mr-1" />
                Fix {autoRepairableCount}
              </Button>
            )}
          </div>
        )}

        {/* System Status Indicator */}
        <div className="text-xs text-center text-muted-foreground border-t pt-2">
          {enabled ? (
            <span className="flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Live monitoring active
            </span>
          ) : (
            <span>Monitoring disabled</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

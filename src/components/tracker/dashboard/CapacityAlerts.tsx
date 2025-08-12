import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  Bell, 
  TrendingUp, 
  Clock, 
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useFlowBasedScheduling } from "@/hooks/tracker/useFlowBasedScheduling";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CapacityAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  stage: string;
  message: string;
  metric: number;
  threshold: number;
  timestamp: Date;
  isNew: boolean;
}

export const CapacityAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<CapacityAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  
  const { workloadSummary, refreshWorkloadSummary } = useFlowBasedScheduling();

  const generateAlerts = async () => {
    try {
      // Get stage workloads from tracking table
      const { data: workloads, error } = await supabase
        .from('stage_workload_tracking')
        .select(`
          production_stage_id,
          committed_hours,
          available_hours,
          queue_length_hours,
          pending_jobs_count,
          active_jobs_count,
          production_stages(name)
        `)
        .gte('date', new Date().toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const newAlerts: CapacityAlert[] = [];

      // Process workloads for alerts
      (workloads || []).forEach(workload => {
        const stageName = (workload.production_stages as any)?.name || 'Unknown Stage';
        const utilization = ((workload.committed_hours || 0) / (workload.available_hours || 8)) * 100;

        if (utilization > 95) {
          newAlerts.push({
            id: `critical-${workload.production_stage_id}-${Date.now()}`,
            type: 'critical',
            stage: stageName,
            message: `Critical capacity overload: ${utilization.toFixed(1)}% utilization`,
            metric: utilization,
            threshold: 95,
            timestamp: new Date(),
            isNew: true
          });
        } else if (utilization > 80) {
          newAlerts.push({
            id: `warning-${workload.production_stage_id}-${Date.now()}`,
            type: 'warning',
            stage: stageName,
            message: `High capacity usage: ${utilization.toFixed(1)}% utilization`,
            metric: utilization,
            threshold: 80,
            timestamp: new Date(),
            isNew: true
          });
        }

        // Queue length alerts (simplified)
        const queueDays = (workload.queue_length_hours || 0) / 8;
        if (queueDays > 7) {
          newAlerts.push({
            id: `queue-${workload.production_stage_id}-${Date.now()}`,
            type: 'critical',
            stage: stageName,
            message: `Excessive queue length: ${queueDays.toFixed(1)} days to process`,
            metric: queueDays,
            threshold: 7,
            timestamp: new Date(),
            isNew: true
          });
        } else if (queueDays > 3) {
          newAlerts.push({
            id: `queue-warning-${workload.production_stage_id}-${Date.now()}`,
            type: 'warning',
            stage: stageName,
            message: `Growing queue: ${queueDays.toFixed(1)} days to process`,
            metric: queueDays,
            threshold: 3,
            timestamp: new Date(),
            isNew: true
          });
        }
      });

      // Capacity trend info
      if (workloadSummary && workloadSummary.capacityUtilization > 85) {
        newAlerts.push({
          id: `capacity-trend-${Date.now()}`,
          type: 'info',
          stage: 'Overall System',
          message: `High overall capacity: ${workloadSummary.capacityUtilization.toFixed(1)}% system utilization`,
          metric: workloadSummary.capacityUtilization,
          threshold: 85,
          timestamp: new Date(),
          isNew: true
        });
      }

      // Filter out dismissed alerts and mark existing ones as not new
      const filteredAlerts = newAlerts.filter(alert => 
        !dismissedAlerts.has(alert.id.split('-')[0] + '-' + alert.stage)
      );

      setAlerts(prevAlerts => {
        // Keep existing alerts and add new ones
        const existingIds = new Set(prevAlerts.map(a => a.id));
        const trulyNewAlerts = filteredAlerts.filter(a => !existingIds.has(a.id));
        
        return [
          ...prevAlerts.map(a => ({ ...a, isNew: false })),
          ...trulyNewAlerts
        ];
      });

      setLastCheck(new Date());

      // Show toast for new critical alerts
      const newCriticalAlerts = filteredAlerts.filter(a => a.type === 'critical');
      if (newCriticalAlerts.length > 0) {
        toast.error(`${newCriticalAlerts.length} critical capacity alert(s) detected`);
      }

    } catch (error) {
      console.error('Error generating capacity alerts:', error);
    }
  };

  const dismissAlert = (alertId: string, stage: string) => {
    const dismissKey = alertId.split('-')[0] + '-' + stage;
    setDismissedAlerts(prev => new Set([...prev, dismissKey]));
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const getAlertIcon = (type: CapacityAlert['type']) => {
    switch (type) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'info':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getAlertColor = (type: CapacityAlert['type']) => {
    switch (type) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-amber-200 bg-amber-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
    }
  };

  // Auto-refresh alerts every 3 minutes
  useEffect(() => {
    generateAlerts();
    const interval = setInterval(generateAlerts, 180000);
    return () => clearInterval(interval);
  }, [workloadSummary, dismissedAlerts]);

  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;
  const newAlertsCount = alerts.filter(a => a.isNew).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="flex items-center gap-2">
                Capacity Alerts
                {newAlertsCount > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {newAlertsCount} new
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Real-time capacity monitoring and bottleneck alerts
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {criticalCount} critical
            </Badge>
            <Badge variant="secondary">
              {warningCount} warnings
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Alert Summary */}
        {alerts.length === 0 ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>All systems normal</strong> - No capacity alerts detected. 
              Production is running smoothly.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {alerts
              .sort((a, b) => {
                // Sort by: new alerts first, then by severity, then by timestamp
                if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
                
                const severityOrder = { critical: 0, warning: 1, info: 2 };
                if (a.type !== b.type) return severityOrder[a.type] - severityOrder[b.type];
                
                return b.timestamp.getTime() - a.timestamp.getTime();
              })
              .map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-2 transition-all ${getAlertColor(alert.type)} ${
                    alert.isNew ? 'ring-2 ring-offset-2 ring-blue-300' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{alert.stage}</h4>
                          {alert.isNew && (
                            <Badge variant="secondary" className="text-xs">
                              NEW
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Threshold: {alert.threshold}%</span>
                          <span>Current: {alert.metric.toFixed(1)}%</span>
                          <span>{alert.timestamp.toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlert(alert.id, alert.stage)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Last Check Info */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Last checked: {lastCheck.toLocaleTimeString()} • 
          Auto-refresh every 3 minutes
        </div>
      </CardContent>
    </Card>
  );
};

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DynamicReschedulingEngine, ProductionChange, ScheduleConflict } from '@/services/dynamicReschedulingEngine';
import { Zap, Clock, AlertTriangle, Activity, TrendingUp, Bell } from 'lucide-react';
import { toast } from 'sonner';

interface RealTimeMonitorProps {
  onChangeDetected: (changes: ProductionChange[]) => void;
  onConflictDetected: (conflicts: ScheduleConflict[]) => void;
}

export const RealTimeProductionMonitor: React.FC<RealTimeMonitorProps> = ({
  onChangeDetected,
  onConflictDetected
}) => {
  const [engine] = useState(() => DynamicReschedulingEngine.getInstance());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<Array<{
    id: string;
    type: 'change' | 'conflict' | 'resolution';
    message: string;
    timestamp: string;
    severity: 'info' | 'warning' | 'error';
  }>>([]);
  const [monitoringStats, setMonitoringStats] = useState({
    changesDetected: 0,
    conflictsResolved: 0,
    autoRecommendations: 0,
    lastCheckTime: ''
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isMonitoring) {
      interval = setInterval(async () => {
        await performMonitoringCycle();
      }, 15000); // Check every 15 seconds for demo purposes
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring]);

  const performMonitoringCycle = async () => {
    try {
      // Detect production changes
      const changes = await engine.detectProductionChanges();
      if (changes.length > 0) {
        onChangeDetected(changes);
        addAlert({
          type: 'change',
          message: `${changes.length} production change(s) detected`,
          severity: 'info'
        });
        
        setMonitoringStats(prev => ({
          ...prev,
          changesDetected: prev.changesDetected + changes.length,
          lastCheckTime: new Date().toLocaleTimeString()
        }));
      }

      // Detect schedule conflicts
      const conflicts = await engine.detectScheduleConflicts();
      if (conflicts.length > 0) {
        onConflictDetected(conflicts);
        const criticalConflicts = conflicts.filter(c => c.severity === 'critical').length;
        
        addAlert({
          type: 'conflict',
          message: `${conflicts.length} schedule conflict(s) found${criticalConflicts > 0 ? ` (${criticalConflicts} critical)` : ''}`,
          severity: criticalConflicts > 0 ? 'error' : 'warning'
        });
      }

      // Update last check time
      setMonitoringStats(prev => ({
        ...prev,
        lastCheckTime: new Date().toLocaleTimeString()
      }));

    } catch (error) {
      console.error('Error in monitoring cycle:', error);
      addAlert({
        type: 'conflict',
        message: 'Monitoring error occurred',
        severity: 'error'
      });
    }
  };

  const addAlert = (alert: Omit<typeof recentAlerts[0], 'id' | 'timestamp'>) => {
    const newAlert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };
    
    setRecentAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    
    // Show toast notification
    const toastFn = alert.severity === 'error' ? toast.error : 
                    alert.severity === 'warning' ? toast.warning : toast.info;
    toastFn(alert.message);
  };

  const handleStartMonitoring = async () => {
    try {
      await engine.startMonitoring();
      setIsMonitoring(true);
      addAlert({
        type: 'resolution',
        message: 'Real-time monitoring started',
        severity: 'info'
      });
    } catch (error) {
      toast.error('Failed to start monitoring');
    }
  };

  const handleStopMonitoring = () => {
    engine.stopMonitoring();
    setIsMonitoring(false);
    addAlert({
      type: 'resolution',
      message: 'Real-time monitoring stopped',
      severity: 'info'
    });
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'change': return <TrendingUp className="h-4 w-4" />;
      case 'conflict': return <AlertTriangle className="h-4 w-4" />;
      case 'resolution': return <Zap className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-destructive';
      case 'warning': return 'text-warning';
      default: return 'text-primary';
    }
  };

  return (
    <div className="space-y-4">
      {/* Monitor Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Activity className={`h-5 w-5 ${isMonitoring ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
              <span>Real-Time Production Monitor</span>
            </CardTitle>
            <Button
              onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
              variant={isMonitoring ? "destructive" : "default"}
              size="sm"
            >
              {isMonitoring ? 'Stop' : 'Start'} Monitoring
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{monitoringStats.changesDetected}</div>
              <div className="text-xs text-muted-foreground">Changes Detected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{monitoringStats.conflictsResolved}</div>
              <div className="text-xs text-muted-foreground">Conflicts Resolved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{monitoringStats.autoRecommendations}</div>
              <div className="text-xs text-muted-foreground">Auto Recommendations</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium">{monitoringStats.lastCheckTime || 'Not started'}</div>
              <div className="text-xs text-muted-foreground">Last Check</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Alerts Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Live Alerts</span>
            {recentAlerts.length > 0 && (
              <Badge variant="secondary">{recentAlerts.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No alerts yet. {isMonitoring ? 'Monitoring for changes...' : 'Start monitoring to see alerts.'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentAlerts.map((alert) => (
                <Alert key={alert.id} className="py-2">
                  <div className={`${getAlertColor(alert.severity)}`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <AlertDescription className="ml-2">
                    <div className="flex items-center justify-between">
                      <span>{alert.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monitoring Status */}
      {isMonitoring && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-success">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                Live monitoring active - Checking for production changes every 15 seconds
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap } from 'lucide-react';
import { ScheduleInitializationService } from '@/services/scheduleInitializationService';
import { toast } from 'sonner';

interface ScheduleInitializationPanelProps {
  onScheduleInitialized?: () => void;
}

export const ScheduleInitializationPanel: React.FC<ScheduleInitializationPanelProps> = ({
  onScheduleInitialized
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    timestamp: Date;
  } | null>(null);

  const handleInitialize = async (forceMode = false) => {
    setIsInitializing(true);
    try {
      console.log(`🚀 Starting schedule initialization (force: ${forceMode})`);
      
      const success = await ScheduleInitializationService.initializeAllSchedules(forceMode);
      
      const result = {
        success,
        message: success 
          ? `Schedules ${forceMode ? 'force ' : ''}initialized successfully`
          : `Failed to ${forceMode ? 'force ' : ''}initialize schedules`,
        timestamp: new Date()
      };
      
      setLastResult(result);
      
      if (success) {
        toast.success(result.message);
        onScheduleInitialized?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Schedule initialization error:', error);
      
      setLastResult({
        success: false,
        message: errorMessage,
        timestamp: new Date()
      });
      
      toast.error(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRegenerate = async (forceMode = false) => {
    if (!confirm(`${forceMode ? 'Force regenerate' : 'Regenerate'} all schedules? This will delete ALL existing schedules first.`)) {
      return;
    }
    
    setIsInitializing(true);
    try {
      console.log(`🔄 Starting schedule regeneration (force: ${forceMode})`);
      
      const success = await ScheduleInitializationService.regenerateAllSchedules(forceMode);
      
      const result = {
        success,
        message: success 
          ? `Schedules ${forceMode ? 'force ' : ''}regenerated successfully`
          : `Failed to ${forceMode ? 'force ' : ''}regenerate schedules`,
        timestamp: new Date()
      };
      
      setLastResult(result);
      
      if (success) {
        toast.success(result.message);
        onScheduleInitialized?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Schedule regeneration error:', error);
      
      setLastResult({
        success: false,
        message: errorMessage,
        timestamp: new Date()
      });
      
      toast.error(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Schedule Initialization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastResult && (
          <Alert variant={lastResult.success ? "default" : "destructive"}>
            {lastResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription className="flex items-center justify-between">
              <span>{lastResult.message}</span>
              <Badge variant={lastResult.success ? "secondary" : "destructive"}>
                {lastResult.timestamp.toLocaleTimeString()}
              </Badge>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => handleInitialize(false)}
            disabled={isInitializing}
            className="w-full"
          >
            {isInitializing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Initialize Schedules
          </Button>

          <Button
            variant="destructive"
            onClick={() => handleInitialize(true)}
            disabled={isInitializing}
            className="w-full"
          >
            {isInitializing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Force Initialize
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleRegenerate(false)}
            disabled={isInitializing}
            className="w-full"
          >
            {isInitializing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Regenerate All
          </Button>

          <Button
            variant="destructive"
            onClick={() => handleRegenerate(true)}
            disabled={isInitializing}
            className="w-full"
          >
            {isInitializing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            Force Regenerate
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Initialize:</strong> Create schedules from current jobs</p>
          <p><strong>Force Initialize:</strong> Create empty schedules even without jobs</p>
          <p><strong>Regenerate:</strong> Clear all schedules and recreate</p>
          <p><strong>Force Regenerate:</strong> Nuclear option - clear everything and force recreate</p>
        </div>
      </CardContent>
    </Card>
  );
};
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchStatusMonitorProps {
  batchId: string;
  onStatusUpdate?: () => void;
}

interface BatchIntegrityResult {
  is_valid: boolean;
  error_count: number;
  missing_references: number;
  orphaned_jobs: number;
  issues: any[];
}

export const BatchStatusMonitor: React.FC<BatchStatusMonitorProps> = ({ 
  batchId, 
  onStatusUpdate 
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [integrity, setIntegrity] = useState<BatchIntegrityResult | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const runIntegrityCheck = async () => {
    setIsChecking(true);
    try {
      console.log(`🔍 Running integrity check for batch ${batchId}`);
      
      const { data, error } = await supabase
        .rpc('validate_batch_integrity', { p_batch_id: batchId });

      if (error) {
        console.error('❌ Integrity check failed:', error);
        toast.error(`Integrity check failed: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const result = data[0] as BatchIntegrityResult;
        setIntegrity(result);
        setLastCheck(new Date());
        
        console.log('📊 Integrity check results:', result);
        
        if (result.is_valid) {
          toast.success('Batch integrity check passed');
        } else {
          toast.warning(`Batch has ${result.error_count} integrity issues`);
        }
      }
    } catch (error) {
      console.error('❌ Integrity check error:', error);
      toast.error('Failed to run integrity check');
    } finally {
      setIsChecking(false);
    }
  };

  const repairBatch = async () => {
    try {
      console.log(`🔧 Attempting to validate batch ${batchId}`);
      
      const { data, error } = await supabase
        .rpc('validate_batch_simple', { p_batch_id: batchId });

      if (error) {
        console.error('❌ Validation failed:', error);
        toast.error(`Validation failed: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const result = data[0];
        
        if (result.is_valid) {
          toast.success(`Batch is valid with ${result.reference_count} references`);
        } else {
          toast.warning(`Batch validation: ${result.message}`);
        }
        
        await runIntegrityCheck(); // Re-check after validation
        onStatusUpdate?.();
      }
    } catch (error) {
      console.error('❌ Validation error:', error);
      toast.error('Failed to validate batch');
    }
  };

  const getStatusIcon = () => {
    if (isChecking) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (!integrity) return <AlertTriangle className="h-4 w-4" />;
    return integrity.is_valid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (isChecking) return 'text-blue-500';
    if (!integrity) return 'text-yellow-500';
    return integrity.is_valid ? 'text-green-500' : 'text-red-500';
  };

  const getHealthScore = () => {
    if (!integrity) return 0;
    if (integrity.is_valid) return 100;
    
    // Calculate health score based on issues
    const totalPossibleIssues = integrity.missing_references + integrity.orphaned_jobs + integrity.error_count;
    if (totalPossibleIssues === 0) return 100;
    
    return Math.max(0, 100 - (totalPossibleIssues * 10));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className={getStatusColor()}>
                {getStatusIcon()}
              </span>
              Batch Health Monitor
            </CardTitle>
            <CardDescription>
              Real-time batch integrity and status monitoring
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runIntegrityCheck}
            disabled={isChecking}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Check Status
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Health Score</span>
            <span className="font-medium">{getHealthScore()}%</span>
          </div>
          <Progress value={getHealthScore()} className="w-full" />
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={integrity?.is_valid ? "default" : "destructive"}>
            {isChecking ? 'Checking...' : 
             !integrity ? 'Not Checked' :
             integrity.is_valid ? 'Healthy' : 'Issues Detected'}
          </Badge>
          {lastCheck && (
            <span className="text-xs text-muted-foreground">
              Last checked: {lastCheck.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Issues Alert */}
        {integrity && !integrity.is_valid && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">
                  {integrity.error_count} integrity issue(s) detected:
                </div>
                {integrity.missing_references > 0 && (
                  <div>• {integrity.missing_references} missing batch references</div>
                )}
                {integrity.orphaned_jobs > 0 && (
                  <div>• {integrity.orphaned_jobs} orphaned job references</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Issues Details */}
        {integrity?.issues && integrity.issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Detailed Issues:</h4>
            <div className="space-y-1">
              {integrity.issues.map((issue, index) => (
                <div key={index} className="text-xs bg-muted p-2 rounded">
                  <span className="font-medium">{issue.type}:</span> {issue.message}
                  {issue.count && <span className="ml-2 text-muted-foreground">({issue.count})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Repair Actions */}
        {integrity && !integrity.is_valid && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={repairBatch}
              className="flex-1"
            >
              Re-validate Batch
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
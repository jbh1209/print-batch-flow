import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  CheckCircle, 
  AlertTriangle, 
  PrinterIcon, 
  Clock, 
  Zap 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProofWorkflowIndicatorProps {
  jobs: any[];
  onBatchPrintReady?: () => void;
  compact?: boolean;
}

export const ProofWorkflowIndicator: React.FC<ProofWorkflowIndicatorProps> = ({
  jobs,
  onBatchPrintReady,
  compact = false
}) => {
  // Calculate workflow metrics
  const metrics = React.useMemo(() => {
    const result = {
      total: jobs.length,
      proofsSent: 0,
      proofsOverdue: 0,
      readyForProduction: 0,
      needsUrgentAttention: 0,
      avgResponseTime: 0
    };

    let totalResponseTimes: number[] = [];

    jobs.forEach(job => {
      const isProofStage = job.current_stage_name?.toLowerCase().includes('proof');
      
      if (job.current_stage_status === 'completed' && isProofStage) {
        result.readyForProduction++;
      } else if (job.proof_emailed_at) {
        result.proofsSent++;
        const elapsed = Date.now() - new Date(job.proof_emailed_at).getTime();
        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        
        totalResponseTimes.push(days);
        
        if (days >= 3) {
          result.proofsOverdue++;
          result.needsUrgentAttention++;
        } else if (days >= 2) {
          result.needsUrgentAttention++;
        }
      }
    });

    if (totalResponseTimes.length > 0) {
      result.avgResponseTime = Math.round(
        totalResponseTimes.reduce((sum, time) => sum + time, 0) / totalResponseTimes.length
      );
    }

    return result;
  }, [jobs]);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {metrics.readyForProduction > 0 && (
          <Badge 
            variant="secondary" 
            className="factory-success text-white font-bold animate-pulse cursor-pointer"
            onClick={onBatchPrintReady}
          >
            <PrinterIcon className="h-3 w-3 mr-1" />
            {metrics.readyForProduction} Ready
          </Badge>
        )}
        {metrics.needsUrgentAttention > 0 && (
          <Badge variant="secondary" className="factory-critical text-white font-bold">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {metrics.needsUrgentAttention} Urgent
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Batch Ready for Production */}
      {metrics.readyForProduction > 0 && (
        <div className="p-4 rounded-lg factory-success border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <h4 className="font-semibold text-green-800">
                  {metrics.readyForProduction} Job{metrics.readyForProduction > 1 ? 's' : ''} Ready for Production
                </h4>
                <p className="text-sm text-green-700">
                  Proofs approved - Ready for batch processing
                </p>
              </div>
            </div>
            {onBatchPrintReady && (
              <Button 
                onClick={onBatchPrintReady}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <PrinterIcon className="h-4 w-4 mr-2" />
                Batch Print Setup
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Overdue Proofs Alert */}
      {metrics.proofsOverdue > 0 && (
        <div className="p-4 rounded-lg factory-critical border-l-4 border-l-red-500 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h4 className="font-semibold text-red-800">
                {metrics.proofsOverdue} Overdue Proof{metrics.proofsOverdue > 1 ? 's' : ''}
              </h4>
              <p className="text-sm text-red-700">
                Client response overdue - Follow up required
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Proofs Summary */}
      {metrics.proofsSent > 0 && (
        <div className="p-4 rounded-lg factory-info border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <div>
              <h4 className="font-semibold text-blue-800">
                {metrics.proofsSent} Proof{metrics.proofsSent > 1 ? 's' : ''} Awaiting Response
              </h4>
              <p className="text-sm text-blue-700">
                Average response time: {metrics.avgResponseTime} day{metrics.avgResponseTime !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Efficiency Indicator */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{metrics.proofsSent}</div>
          <div className="text-xs text-gray-600">Active Proofs</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-2xl font-bold",
            metrics.avgResponseTime <= 2 ? "text-green-600" : "text-orange-600"
          )}>
            {metrics.avgResponseTime}d
          </div>
          <div className="text-xs text-gray-600">Avg Response</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{metrics.readyForProduction}</div>
          <div className="text-xs text-gray-600">Ready to Print</div>
        </div>
      </div>
    </div>
  );
};
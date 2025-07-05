
import { Button } from "@/components/ui/button";
import { Printer, Activity, Bug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BatchStatus } from "@/config/productTypes";
import { BatchStatusMonitor } from "./BatchStatusMonitor";
import { BatchDiagnostics } from "./BatchDiagnostics";
import { useState } from "react";

interface BatchStatusUpdateProps {
  batchId: string;
  currentStatus: BatchStatus;
  onStatusUpdate: () => void;
}

const BatchStatusUpdate = ({ batchId, currentStatus, onStatusUpdate }: BatchStatusUpdateProps) => {
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const sendToPrint = async () => {
    try {
      console.log('🚀 Sending batch to print using enhanced processor:', batchId);
      
      // Import and use enhanced batch processor
      const { sendBatchToPrintEnhanced } = await import('@/utils/batch/enhancedBatchProcessor');
      
      const result = await sendBatchToPrintEnhanced(batchId);
      
      if (result.success) {
        console.log('✅ Enhanced Send to Print completed successfully:', result.masterJobId);
        onStatusUpdate();
      } else {
        console.error('❌ Enhanced Send to Print failed:', result.errors);
        throw new Error(result.errors.join(', '));
      }
    } catch (error) {
      console.error('❌ Error in enhanced send to print:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to send batch to print: ${errorMessage}`);
    }
  };

  // Don't show options for batches that are already completed or cancelled
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          variant="outline" 
          onClick={sendToPrint}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Send to Print
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => setShowMonitoring(!showMonitoring)}
          className="flex items-center gap-2"
        >
          <Activity className="h-4 w-4" />
          {showMonitoring ? 'Hide' : 'Show'} Monitor
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center gap-2"
        >
          <Bug className="h-4 w-4" />
          {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
        </Button>
      </div>

      {/* Monitoring Panel */}
      {showMonitoring && (
        <BatchStatusMonitor 
          batchId={batchId} 
          onStatusUpdate={onStatusUpdate}
        />
      )}

      {/* Diagnostics Panel */}
      {showDiagnostics && (
        <BatchDiagnostics batchId={batchId} />
      )}
    </div>
  );
};

export default BatchStatusUpdate;

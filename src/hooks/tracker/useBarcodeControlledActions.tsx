import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseBarcodeData } from "@/utils/barcodeGenerator";
import { useBatchAwareStageActions } from "./stage-management/useBatchAwareStageActions";
import { useAuth } from "@/hooks/useAuth";

export type JobActionState = 'idle' | 'scanning' | 'working' | 'paused' | 'completing';

export interface BarcodeJobAction {
  jobId: string;
  jobTableName: string;
  stageId: string;
  expectedBarcodeData: string;
  isBatchMaster?: boolean;
  batchName?: string;
  constituentJobIds?: string[];
}

interface ScanResult {
  success: boolean;
  scannedData?: string;
  expectedData?: string;
  error?: string;
}

export const useBarcodeControlledActions = () => {
  const [actionState, setActionState] = useState<JobActionState>('idle');
  const [currentAction, setCurrentAction] = useState<BarcodeJobAction | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  
  const { user } = useAuth();
  const { startStage, completeStage, reworkStage, isProcessing } = useBatchAwareStageActions();

  // Log barcode scan for audit trail
  const logBarcodeScan = useCallback(async (
    jobId: string,
    stageId: string,
    barcodeData: string,
    scanResult: string,
    actionTaken: string
  ) => {
    try {
      await supabase.from('barcode_scan_log').insert({
        job_id: jobId,
        job_table_name: 'production_jobs',
        stage_id: stageId,
        barcode_data: barcodeData,
        scan_result: scanResult,
        action_taken: actionTaken,
        user_id: user?.id || 'unknown'
      });
    } catch (error) {
      console.error('Failed to log barcode scan:', error);
    }
  }, [user?.id]);

  // Verify barcode matches expected job - flexible prefix handling
  const verifyBarcode = useCallback((scannedData: string, expectedData: string): boolean => {
    const cleanScanned = scannedData.trim().toUpperCase();
    const cleanExpected = expectedData.trim().toUpperCase();

    // Extract numeric portion from both (remove any letter prefix like D, W, etc.)
    const scannedNumbers = cleanScanned.replace(/^[A-Z]+/, '');
    const expectedNumbers = cleanExpected.replace(/^[A-Z]+/, '');

    // Compare the numeric portions - this makes it flexible
    // "427310" matches "D427310"
    // "W427310" matches "D427310"
    // "D427310" matches "D427310"
    if (scannedNumbers && expectedNumbers && /^\d+$/.test(scannedNumbers) && /^\d+$/.test(expectedNumbers)) {
      return scannedNumbers === expectedNumbers;
    }

    // Fallback to exact match if no numbers found (backward compatibility)
    return cleanScanned === cleanExpected;
  }, []);

  // Process barcode scan during job actions
  const processBarcodeForAction = useCallback(async (scannedData: string) => {
    if (!currentAction) {
      toast.error("No active job action to process barcode for");
      return false;
    }

    const isValid = verifyBarcode(scannedData, currentAction.expectedBarcodeData);
    
    setScanResult({
      success: isValid,
      scannedData,
      expectedData: currentAction.expectedBarcodeData,
      error: isValid ? undefined : "Barcode does not match expected job"
    });

    // Log the scan attempt
    await logBarcodeScan(
      currentAction.jobId,
      currentAction.stageId,
      scannedData,
      isValid ? 'valid_match' : 'invalid_mismatch',
      actionState === 'scanning' ? 'start_job' : 'complete_job'
    );

    if (isValid) {
      toast.success("Barcode verified - proceeding with action");
      return true;
    } else {
      toast.error("Wrong barcode scanned - please scan the correct job barcode");
      return false;
    }
  }, [currentAction, actionState, verifyBarcode, logBarcodeScan]);

  // Start job with barcode verification
  const startJobWithBarcode = useCallback(async (action: BarcodeJobAction) => {
    setCurrentAction(action);
    setActionState('scanning');
    setScanResult(null);
    
    toast.info("Scan the job barcode to verify you have the correct work order");
    
    return new Promise<boolean>((resolve) => {
      // Set up a temporary scan handler that resolves when barcode is scanned
      const checkForScan = async () => {
        // This will be called by the barcode scanner component
        // For now, we'll return false and let the UI handle the scanning process
        resolve(false);
      };
      
      // Start checking for scans
      checkForScan();
    });
  }, []);

  // Proceed with start after successful barcode scan
  const proceedWithStart = useCallback(async () => {
    if (!currentAction || !scanResult?.success) {
      toast.error("Cannot proceed - barcode verification required");
      return false;
    }

    setActionState('working');
    
    const success = await startStage(
      currentAction.stageId,
      {
        jobId: currentAction.jobId,
        jobTableName: currentAction.jobTableName,
        isBatchMaster: currentAction.isBatchMaster,
        batchName: currentAction.batchName,
        constituentJobIds: currentAction.constituentJobIds
      }
    );

    if (success) {
      await logBarcodeScan(
        currentAction.jobId,
        currentAction.stageId,
        scanResult.scannedData!,
        'successful_start',
        'job_started'
      );
      toast.success("Job started successfully");
      setActionState('idle');
      setCurrentAction(null);
      setScanResult(null);
    } else {
      setActionState('scanning');
    }

    return success;
  }, [currentAction, scanResult, startStage, logBarcodeScan]);

  // Complete job with barcode verification
  const completeJobWithBarcode = useCallback(async (action: BarcodeJobAction, notes?: string) => {
    setCurrentAction(action);
    setActionState('scanning');
    setScanResult(null);
    
    toast.info("Scan the job barcode to verify completion");
    
    return new Promise<boolean>((resolve) => {
      const checkForScan = async () => {
        resolve(false);
      };
      
      checkForScan();
    });
  }, []);

  // Proceed with completion after successful barcode scan
  const proceedWithComplete = useCallback(async (notes?: string) => {
    if (!currentAction || !scanResult?.success) {
      toast.error("Cannot proceed - barcode verification required");
      return false;
    }

    setActionState('completing');
    
    const success = await completeStage(
      currentAction.stageId,
      {
        jobId: currentAction.jobId,
        jobTableName: currentAction.jobTableName,
        isBatchMaster: currentAction.isBatchMaster,
        batchName: currentAction.batchName,
        constituentJobIds: currentAction.constituentJobIds
      },
      notes
    );

    if (success) {
      await logBarcodeScan(
        currentAction.jobId,
        currentAction.stageId,
        scanResult.scannedData!,
        'successful_completion',
        'job_completed'
      );
      toast.success("Job completed successfully");
      setActionState('idle');
      setCurrentAction(null);
      setScanResult(null);
    } else {
      setActionState('scanning');
    }

    return success;
  }, [currentAction, scanResult, completeStage, logBarcodeScan]);

  // Hold/pause job
  const holdJob = useCallback(async () => {
    if (actionState !== 'working') {
      toast.error("No active job to hold");
      return false;
    }

    setActionState('paused');
    toast.info("Job held - scan barcode again to resume");
    return true;
  }, [actionState]);

  // Resume job from hold
  const resumeJob = useCallback(async () => {
    if (actionState !== 'paused') {
      toast.error("No paused job to resume");
      return false;
    }

    setActionState('working');
    toast.success("Job resumed");
    return true;
  }, [actionState]);

  // Cancel current action
  const cancelAction = useCallback(() => {
    setActionState('idle');
    setCurrentAction(null);
    setScanResult(null);
    console.log('Barcode action cancelled and state reset');
  }, []);

  // Reset all state when component unmounts or action completes
  const resetState = useCallback(() => {
    setActionState('idle');
    setCurrentAction(null);
    setScanResult(null);
    console.log('Barcode state fully reset');
  }, []);

  return {
    actionState,
    currentAction,
    scanResult,
    isProcessing,
    startJobWithBarcode,
    proceedWithStart,
    completeJobWithBarcode,
    proceedWithComplete,
    holdJob,
    resumeJob,
    cancelAction,
    resetState,
    processBarcodeForAction
  };
};
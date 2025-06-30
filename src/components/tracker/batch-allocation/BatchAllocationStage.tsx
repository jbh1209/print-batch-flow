
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ArrowRight, AlertTriangle } from 'lucide-react';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { BatchCategorySelector } from './BatchCategorySelector';
import { BatchJobForm } from './BatchJobForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { createBatchJobFromProduction } from '@/utils/batch/batchIntegrationService';

interface BatchAllocationStageProps {
  job: AccessibleJob;
  onComplete: () => void;
  onCancel: () => void;
}

export const BatchAllocationStage: React.FC<BatchAllocationStageProps> = ({
  job,
  onComplete,
  onCancel
}) => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setShowJobForm(true);
    setError(null);
  };

  const handleJobCreated = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log(`🔄 Creating ${selectedCategory} batch job for ${job.wo_no}`);

      // Create batch job using the integration service
      const result = await createBatchJobFromProduction({
        productionJobId: job.job_id,
        wo_no: job.wo_no,
        customer: job.customer || 'Unknown',
        qty: job.qty || 1,
        due_date: job.due_date ? new Date(job.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        batchCategory: selectedCategory
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create batch job');
      }

      // Complete the current batch allocation stage
      const { error: stageError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: `Job allocated to ${selectedCategory} batch processing - Batch Job ID: ${result.batchJobId}`
      });

      if (stageError) throw stageError;

      toast.success(`Job successfully allocated to ${selectedCategory} batch processing`);
      onComplete();

    } catch (error) {
      console.error('❌ Error in batch allocation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete batch allocation';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipBatching = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Advance directly to next printing stage without batching
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: 'Batch allocation skipped - proceeding directly to printing'
      });

      if (error) throw error;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success('Batch allocation skipped - job ready for printing');
      onComplete();

    } catch (error) {
      console.error('❌ Error skipping batch allocation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to skip batch allocation';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Batch Allocation
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span><strong>WO:</strong> {job.wo_no}</span>
            <span><strong>Customer:</strong> {job.customer}</span>
            <span><strong>Qty:</strong> {job.qty}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant="outline">Current Stage: Batch Allocation</Badge>
            <Badge variant="secondary">Status: {job.status}</Badge>
          </div>
          
          <p className="text-gray-600 mb-6">
            Choose whether to allocate this job to a batch or proceed directly to printing.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <div>
                  <p className="font-medium">Batch Allocation Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSkipBatching}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Skip Batching
            </Button>
            <Button onClick={onCancel} variant="ghost" disabled={isProcessing}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {!showJobForm && (
        <BatchCategorySelector
          onSelectCategory={handleCategorySelect}
          selectedCategory={selectedCategory}
          disabled={isProcessing}
        />
      )}

      {showJobForm && selectedCategory && (
        <Card>
          <CardHeader>
            <CardTitle>Create {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Batch Job</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Work Order:</span> {job.wo_no}
                </div>
                <div>
                  <span className="font-medium">Customer:</span> {job.customer}
                </div>
                <div>
                  <span className="font-medium">Quantity:</span> {job.qty}
                </div>
                <div>
                  <span className="font-medium">Due Date:</span> {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'Not set'}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleJobCreated}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating Batch Job...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      Create Batch Job
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => setShowJobForm(false)}
                  variant="outline"
                  disabled={isProcessing}
                >
                  Back to Categories
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

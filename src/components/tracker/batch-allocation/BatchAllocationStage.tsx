
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ArrowRight } from 'lucide-react';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { BatchCategorySelector } from './BatchCategorySelector';
import { BatchJobForm } from './BatchJobForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

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

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setShowJobForm(true);
  };

  const handleJobCreated = async () => {
    setIsProcessing(true);
    try {
      // Mark the production job as batch allocated
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({
          batch_category: selectedCategory,
          batch_ready: true,
          batch_allocated_at: new Date().toISOString(),
          batch_allocated_by: user?.id,
          status: 'Batch Allocated',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (updateError) throw updateError;

      // Complete the current batch allocation stage
      const { error: stageError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: `Job allocated to ${selectedCategory} batch category`
      });

      if (stageError) throw stageError;

      toast.success('Job successfully allocated to batch processing');
      onComplete();
    } catch (error) {
      console.error('Error completing batch allocation:', error);
      toast.error('Failed to complete batch allocation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipBatching = async () => {
    setIsProcessing(true);
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
      console.error('Error skipping batch allocation:', error);
      toast.error('Failed to skip batch allocation');
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
            <Button onClick={onCancel} variant="ghost">
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
        <BatchJobForm
          wo_no={job.wo_no}
          customer={job.customer}
          qty={job.qty}
          due_date={job.due_date}
          batchCategory={selectedCategory}
          onJobCreated={handleJobCreated}
          onCancel={() => setShowJobForm(false)}
        />
      )}
    </div>
  );
};

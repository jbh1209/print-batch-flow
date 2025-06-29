
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BatchReadyJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  due_date: string;
  table_name: string;
  paper_type?: string;
  paper_weight?: string;
  size?: string;
  lamination_type?: string;
  batch_ready: boolean;
}

export const BatchAllocationManagement = () => {
  const [jobs, setJobs] = useState<BatchReadyJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [activeTab, setActiveTab] = useState('ready');

  const fetchBatchReadyJobs = async () => {
    try {
      setIsLoading(true);
      
      // Fetch from multiple job tables with proper typing
      const tables = [
        'business_card_jobs',
        'flyer_jobs', 
        'postcard_jobs',
        'sleeve_jobs',
        'sticker_jobs',
        'poster_jobs',
        'cover_jobs',
        'box_jobs'
      ] as const;

      const allJobs: BatchReadyJob[] = [];

      for (const table of tables) {
        try {
          // Use direct table queries instead of dynamic SQL
          const { data, error } = await supabase
            .from(table as any)
            .select('*')
            .eq('status', 'queued')
            .is('batch_id', null);

          if (error) {
            console.error(`Error fetching ${table}:`, error);
            continue;
          }

          // Map the data to our interface with proper typing
          const typedJobs = (data || [])
            .filter((job: any) => job && typeof job === 'object' && job.id)
            .map((job: any) => ({
              id: job.id,
              name: job.name || 'Unnamed Job',
              job_number: job.job_number || 'No Job Number',
              quantity: job.quantity || 0,
              due_date: job.due_date || new Date().toISOString(),
              table_name: table,
              paper_type: job.paper_type,
              paper_weight: job.paper_weight,
              size: job.size,
              lamination_type: job.lamination_type,
              batch_ready: job.batch_ready || false
            } as BatchReadyJob));

          allJobs.push(...typedJobs);
        } catch (tableError) {
          console.error(`Error processing ${table}:`, tableError);
          // Continue with other tables even if one fails
        }
      }

      setJobs(allJobs);
    } catch (error) {
      console.error('Error fetching batch ready jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const markJobsReady = async (jobIds: string[]) => {
    try {
      for (const jobId of jobIds) {
        const job = jobs.find(j => j.id === jobId);
        if (!job) continue;

        await supabase.rpc('mark_job_ready_for_batching', {
          p_job_id: jobId,
          p_job_table_name: job.table_name
        });
      }

      toast.success(`Marked ${jobIds.length} job(s) ready for batching`);
      await fetchBatchReadyJobs();
    } catch (error) {
      console.error('Error marking jobs ready:', error);
      toast.error('Failed to mark jobs ready');
    }
  };

  const createBatchFromJobs = async () => {
    if (selectedJobs.length === 0) {
      toast.error('Please select jobs to batch');
      return;
    }

    try {
      setIsCreatingBatch(true);
      
      // Group jobs by specifications for batch creation
      const selectedJobData = jobs.filter(job => selectedJobs.includes(job.id));
      
      // For now, create a simple batch - you can enhance this later
      const batchName = `Batch ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
      
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchName,
          status: 'pending',
          lamination_type: 'none', // Will be enhanced with specifications
          sheets_required: 1,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Update selected jobs with batch_id using individual table updates
      for (const job of selectedJobData) {
        try {
          // Use direct table updates instead of dynamic SQL
          await supabase
            .from(job.table_name as any)
            .update({ 
              batch_id: batch.id, 
              status: 'batched' 
            })
            .eq('id', job.id);
        } catch (updateError) {
          console.error(`Error updating job ${job.id}:`, updateError);
        }
      }

      toast.success(`Created batch with ${selectedJobs.length} jobs`);
      setSelectedJobs([]);
      await fetchBatchReadyJobs();
      
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create batch');
    } finally {
      setIsCreatingBatch(false);
    }
  };

  useEffect(() => {
    fetchBatchReadyJobs();
  }, []);

  const readyJobs = jobs.filter(job => job.batch_ready);
  const pendingJobs = jobs.filter(job => !job.batch_ready);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Batch Allocation Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">
              Pending Jobs ({pendingJobs.length})
            </TabsTrigger>
            <TabsTrigger value="ready">
              Ready for Batching ({readyJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Jobs awaiting approval for batch allocation
                </p>
                {pendingJobs.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => markJobsReady(pendingJobs.map(j => j.id))}
                  >
                    Mark All Ready
                  </Button>
                )}
              </div>
              
              {isLoading ? (
                <div className="text-center py-8">Loading jobs...</div>
              ) : pendingJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending jobs found
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{job.name}</span>
                          <Badge variant="outline">{job.job_number}</Badge>
                          <Badge>{job.table_name.replace('_jobs', '').replace('_', ' ')}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Qty: {job.quantity} • Due: {format(new Date(job.due_date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => markJobsReady([job.id])}
                      >
                        Mark Ready
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ready" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Jobs ready for batch allocation
                </p>
                {selectedJobs.length > 0 && (
                  <Button
                    onClick={createBatchFromJobs}
                    disabled={isCreatingBatch}
                  >
                    {isCreatingBatch ? 'Creating...' : `Create Batch (${selectedJobs.length})`}
                  </Button>
                )}
              </div>
              
              {readyJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No jobs ready for batching
                </div>
              ) : (
                <div className="space-y-2">
                  {readyJobs.map((job) => (
                    <div key={job.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedJobs([...selectedJobs, job.id]);
                          } else {
                            setSelectedJobs(selectedJobs.filter(id => id !== job.id));
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{job.name}</span>
                          <Badge variant="outline">{job.job_number}</Badge>
                          <Badge>{job.table_name.replace('_jobs', '').replace('_', ' ')}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Qty: {job.quantity} • Due: {format(new Date(job.due_date), 'MMM dd, yyyy')}
                          {job.paper_type && ` • ${job.paper_type}`}
                          {job.paper_weight && ` ${job.paper_weight}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

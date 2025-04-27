
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob, FlyerBatch } from '@/components/batches/types/FlyerTypes';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { format } from 'date-fns';
import { FlyerBatchOverview } from '@/components/flyers/FlyerBatchOverview';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const FlyerBatchDetails = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const batchId = searchParams.get('batchId');
  
  const [batch, setBatch] = useState<FlyerBatch | null>(null);
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (batchId) {
      fetchBatchDetails(batchId);
    }
  }, [batchId]);

  const fetchBatchDetails = async (id: string) => {
    try {
      setIsLoading(true);
      
      // Fetch batch details from the batches table
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', id)
        .single();
      
      if (batchError) throw batchError;
      
      // Convert to FlyerBatch type with explicit type assertion and ensure overview_pdf_url is set
      const flyerBatch: FlyerBatch = {
        ...batchData,
        overview_pdf_url: batchData.overview_pdf_url || null
      };
      
      setBatch(flyerBatch);
      
      // Fetch related jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('flyer_jobs')
        .select('*')
        .eq('batch_id', id);
      
      if (jobsError) throw jobsError;
      
      setJobs(jobsData || []);
    } catch (error) {
      console.error('Error fetching batch details:', error);
      toast.error('Failed to load batch details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!batch) return;
    
    try {
      setIsDeleting(true);
      
      // Update all jobs to remove them from the batch
      const { error: updateError } = await supabase
        .from('flyer_jobs')
        .update({ 
          batch_id: null,
          status: 'queued'
        })
        .eq('batch_id', batch.id);
      
      if (updateError) throw updateError;
      
      // Delete the batch
      const { error: deleteError } = await supabase
        .from('batches')
        .delete()
        .eq('id', batch.id);
      
      if (deleteError) throw deleteError;
      
      toast.success('Batch deleted successfully');
      navigate('/batches/flyers/batches');
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast.error('Failed to delete batch');
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
        <p className="text-gray-500 mb-6">The batch you're looking for doesn't exist or has been deleted.</p>
        <Button onClick={() => navigate('/batches/flyers/batches')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Batches
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            className="mr-4"
            onClick={() => navigate("/batches/flyers/batches")}
          >
            <ArrowLeft size={16} className="mr-1" /> Back to Batches
          </Button>
          <h2 className="text-2xl font-semibold">Batch: {batch.name}</h2>
        </div>
        
        <Button 
          variant="destructive" 
          size="sm"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete Batch
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
            <CardDescription>Basic information about this batch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name:</span>
              <span className="font-medium">{batch.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <span className="font-medium">{batch.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Created:</span>
              <span className="font-medium">{format(new Date(batch.created_at), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Due Date:</span>
              <span className="font-medium">{format(new Date(batch.due_date), 'MMM d, yyyy')}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Paper Information</CardTitle>
            <CardDescription>Paper specifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Paper Type:</span>
              <span className="font-medium">{batch.paper_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Paper Weight:</span>
              <span className="font-medium">{batch.paper_weight}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sheet Size:</span>
              <span className="font-medium">{batch.sheet_size}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Production</CardTitle>
            <CardDescription>Production information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Printer Type:</span>
              <span className="font-medium">{batch.printer_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sheets Required:</span>
              <span className="font-medium">{batch.sheets_required}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Job Count:</span>
              <span className="font-medium">{jobs.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs in Batch</CardTitle>
          <CardDescription>All jobs included in this batch</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No jobs in this batch
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Job #</th>
                    <th className="text-left py-2">Size</th>
                    <th className="text-left py-2">Paper</th>
                    <th className="text-left py-2">Quantity</th>
                    <th className="text-left py-2">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">{job.name}</td>
                      <td className="py-2">{job.job_number}</td>
                      <td className="py-2">{job.size}</td>
                      <td className="py-2">{job.paper_weight} {job.paper_type}</td>
                      <td className="py-2">{job.quantity}</td>
                      <td className="py-2">{format(new Date(job.due_date), 'MMM d, yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Job PDFs Overview */}
      {jobs.length > 0 && (
        <FlyerBatchOverview 
          jobs={jobs} 
          batchName={batch.name} 
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove all jobs from the batch and delete the batch itself.
              Jobs will be returned to the queued status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : 'Delete Batch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FlyerBatchDetails;

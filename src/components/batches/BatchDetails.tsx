
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import {
  FileText,
  Loader2,
  Eye,
  Trash2,
  AlertCircle,
  ArrowLeft,
  Download,
  Clock,
  CalendarIcon,
  Layers,
  CheckCircle2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LaminationType } from "@/components/business-cards/JobsTable";
import JobStatusBadge from "@/components/JobStatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Define the status type to match what's in the database
type BatchStatus = "pending" | "processing" | "completed" | "cancelled";

interface BatchDetails {
  id: string;
  name: string;
  lamination_type: LaminationType;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: BatchStatus;
}

interface Job {
  id: string;
  name: string;
  quantity: number;
  status: string;
  pdf_url: string;
}

interface BatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string; // URL to navigate back to
}

const BatchDetails = ({ batchId, productType, backUrl }: BatchDetailsProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (batchId && user) {
      fetchBatchDetails();
    }
  }, [batchId, user]);

  const fetchBatchDetails = async () => {
    if (!user || !batchId) return;
    
    setIsLoading(true);
    try {
      // Fetch batch details
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", batchId)
        .eq("created_by", user.id)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Batch not found",
          description: "The requested batch could not be found or you don't have permission to view it.",
          variant: "destructive",
        });
        navigate(backUrl);
        return;
      }
      
      setBatch(data as BatchDetails);
      
      // Fetch related jobs based on product type
      let jobsData: Job[] = [];
      
      // Determine which table to query based on product type
      // Currently only business cards have a dedicated table
      if (productType === "Business Cards") {
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        jobsData = jobs || [];
      }
      
      setRelatedJobs(jobsData);
    } catch (error) {
      console.error("Error fetching batch details:", error);
      toast({
        title: "Error loading batch",
        description: "Failed to load batch details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete || !batch) return;
    
    setIsDeleting(true);
    try {
      // First update all jobs in this batch back to queued
      if (productType === "Business Cards") {
        const { error: jobsError } = await supabase
          .from("business_card_jobs")
          .update({ status: "queued", batch_id: null })
          .eq("batch_id", batchToDelete);
        
        if (jobsError) throw jobsError;
      }
      
      // Then delete the batch
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchToDelete);
      
      if (deleteError) throw deleteError;
      
      toast({
        title: "Batch deleted",
        description: "The batch has been deleted and its jobs returned to queue",
      });
      
      // Navigate back
      navigate(backUrl);
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({
        title: "Error deleting batch",
        description: "Failed to delete batch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setBatchToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const handleViewPDF = (url: string | null) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-gray-400" />
        <p>Loading batch details...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
        <p className="text-gray-500 mb-4">The requested batch could not be found or you don't have permission to view it.</p>
        <Button onClick={() => navigate(backUrl)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button
          onClick={() => navigate(backUrl)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Batches
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-batchflow-primary" />
              {batch.name}
            </CardTitle>
            <CardDescription>
              {productType} Batch
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div>
                  <JobStatusBadge status={batch.status} />
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Lamination Type</p>
                <p>{batch.lamination_type === 'none' ? 'None' : 
                  batch.lamination_type.charAt(0).toUpperCase() + batch.lamination_type.slice(1)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Sheets Required</p>
                <p>{batch.sheets_required}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Due Date</p>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  <p>{formatDate(batch.due_date)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Created</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <p>{formatDate(batch.created_at)}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Jobs Count</p>
                <p>{relatedJobs.length || "N/A"}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            {batch.status !== 'completed' && (
              <Button
                variant="destructive"
                onClick={() => setBatchToDelete(batch.id)}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Batch
              </Button>
            )}
            <div className="flex gap-2">
              {batch.front_pdf_url && (
                <Button 
                  variant="outline" 
                  onClick={() => handleViewPDF(batch.front_pdf_url)}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Front PDF
                </Button>
              )}
              {batch.back_pdf_url && (
                <Button 
                  variant="outline" 
                  onClick={() => handleViewPDF(batch.back_pdf_url)}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Back PDF
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Actions</CardTitle>
            <CardDescription>Manage your batch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fix the TypeScript error here - the comparison was incorrectly typed */}
            {batch.status !== 'completed' && (
              <Button 
                className="w-full flex items-center gap-2"
                variant={batch.status === 'pending' ? "default" : "outline"}
                disabled={batch.status === 'completed'}
              >
                <CheckCircle2 className="h-4 w-4" />
                {batch.status === 'pending' ? 'Mark as Processing' : 'Mark as Completed'}
              </Button>
            )}
            
            {(batch.front_pdf_url || batch.back_pdf_url) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Download PDFs</p>
                <div className="flex flex-col gap-2">
                  {batch.front_pdf_url && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleViewPDF(batch.front_pdf_url)}
                      className="flex items-center justify-start gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Front PDF
                    </Button>
                  )}
                  {batch.back_pdf_url && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleViewPDF(batch.back_pdf_url)}
                      className="flex items-center justify-start gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Back PDF
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Related Jobs */}
      {productType === "Business Cards" && relatedJobs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Related Jobs</CardTitle>
            <CardDescription>Jobs included in this batch</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell>{job.quantity}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {job.pdf_url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleViewPDF(job.pdf_url)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View PDF</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!batchToDelete} onOpenChange={(open) => !open && setBatchToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Batch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this batch? This will return all jobs to the queue.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteBatch}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Batch'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchDetails;

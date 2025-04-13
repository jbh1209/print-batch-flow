
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { 
  FileText, 
  Loader2, 
  Eye, 
  Pencil, 
  Trash2, 
  AlertCircle,
  ArrowLeft
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
import JobsHeader from "@/components/business-cards/JobsHeader";

interface Batch {
  id: string;
  name: string;
  lamination_type: LaminationType;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: "pending" | "processing" | "completed" | "cancelled";
}

const BusinessCardBatches = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  const { user } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, [user, batchId]);

  const fetchBatches = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from("batches")
        .select("*")
        .eq("created_by", user.id);
        
      // If batchId is specified, filter to only show that batch
      if (batchId) {
        query = query.eq("id", batchId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) throw error;
      setBatches(data || []);
      
      // If we're looking for a specific batch and didn't find it
      if (batchId && (!data || data.length === 0)) {
        toast({
          title: "Batch not found",
          description: "The requested batch could not be found or you don't have permission to view it.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
      toast({
        title: "Error loading batches",
        description: "Failed to load batch data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      // First update all jobs in this batch back to queued
      const { error: jobsError } = await supabase
        .from("business_card_jobs")
        .update({ status: "queued", batch_id: null })
        .eq("batch_id", batchToDelete);
      
      if (jobsError) throw jobsError;
      
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
      
      // Refresh batch list
      fetchBatches();
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

  return (
    <div>
      <JobsHeader 
        title={batchId ? "Batch Details" : "Business Card Batches"} 
        subtitle={batchId ? "View details for the selected batch" : "View and manage all your business card batches"} 
      />

      {batchId && (
        <Button
          onClick={() => navigate("/batches/all")}
          variant="outline"
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Batches
        </Button>
      )}

      <div className="bg-white rounded-lg border shadow mb-8">
        <div className="border-b p-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'} found
          </div>
          <Button onClick={fetchBatches} variant="outline" size="sm">Refresh</Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lamination</TableHead>
                <TableHead>Sheets</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2">Loading batches...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="bg-gray-100 rounded-full p-3 mb-3">
                        <FileText size={24} className="text-gray-400" />
                      </div>
                      <h3 className="font-medium mb-1">No batches found</h3>
                      <p className="text-sm mb-4">You haven't created any batches yet.</p>
                      <Button onClick={() => navigate("/batches/business-cards/jobs")}>
                        Create a Batch
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell>
                      {batch.lamination_type === 'none' ? 'None' : 
                        batch.lamination_type.charAt(0).toUpperCase() + batch.lamination_type.slice(1)}
                    </TableCell>
                    <TableCell>{batch.sheets_required}</TableCell>
                    <TableCell>{formatDate(batch.due_date)}</TableCell>
                    <TableCell>{formatDate(batch.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {batch.front_pdf_url && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleViewPDF(batch.front_pdf_url)}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBatchToDelete(batch.id)}
                          disabled={batch.status === 'completed'}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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

export default BusinessCardBatches;

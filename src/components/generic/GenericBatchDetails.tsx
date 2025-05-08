
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Trash, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BaseBatch, BaseJob } from '@/config/productTypes';
import { formatDate } from '@/utils/formatters';

interface GenericBatchDetailsProps {
  batch: BaseBatch | null;
  batchId: string;
  isLoading: boolean;
  error: string | null;
  jobs: BaseJob[];
  backUrl: string;
  productType: string;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: (batchId: BaseBatch) => void;
}

const GenericBatchDetails = ({
  batch,
  batchId,
  isLoading,
  error,
  jobs,
  backUrl,
  productType,
  onViewPDF,
  onDeleteBatch
}: GenericBatchDetailsProps) => {
  const navigate = useNavigate();
  const [selectedBatch, setSelectedBatch] = useState<BaseBatch | null>(batch);

  // Update local state when batch prop changes
  useEffect(() => {
    if (batch) {
      setSelectedBatch(batch);
    }
  }, [batch]);

  const handleBack = () => {
    navigate(backUrl);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading batch details...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading batch details</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={handleBack}
        >
          Go Back
        </Button>
      </Alert>
    );
  }

  // Not found state
  if (!selectedBatch) {
    return (
      <Alert variant="default" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Batch not found</AlertTitle>
        <AlertDescription>The requested batch could not be found.</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={handleBack}
        >
          Go Back
        </Button>
      </Alert>
    );
  }

  return (
    <div>
      {/* Back button and header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-2" /> Back to {productType} Batches
        </Button>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{selectedBatch.name}</h1>
            <p className="text-muted-foreground">
              {jobs.length} job{jobs.length !== 1 ? 's' : ''} • 
              Created {formatDate(selectedBatch.created_at)}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onViewPDF(selectedBatch.front_pdf_url)}
              disabled={!selectedBatch.front_pdf_url}
            >
              <FileText className="h-4 w-4 mr-2" />
              View PDF
            </Button>
            
            <Button
              variant="destructive"
              onClick={() => onDeleteBatch(selectedBatch)}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Batch details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Batch Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={selectedBatch.status === 'completed' ? 'success' : 'default'}>
                {selectedBatch.status.charAt(0).toUpperCase() + selectedBatch.status.slice(1)}
              </Badge>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground">Due Date</p>
              <p>{formatDate(selectedBatch.due_date)}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sheets Required</p>
              <p>{selectedBatch.sheets_required}</p>
            </div>
            
            {selectedBatch.lamination_type && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lamination</p>
                <p>{selectedBatch.lamination_type}</p>
              </div>
            )}
            
            {selectedBatch.paper_type && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paper Type</p>
                <p>{selectedBatch.paper_type}</p>
              </div>
            )}
            
            {selectedBatch.paper_weight && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paper Weight</p>
                <p>{selectedBatch.paper_weight}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Jobs included in batch */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs in this Batch</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-muted-foreground">No jobs found in this batch</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div key={job.id} className="border rounded-md p-3">
                    <p className="font-medium">{job.name}</p>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <p>Quantity: {job.quantity}</p>
                      <p>{job.job_number || `Job #${job.id.substring(0, 8)}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GenericBatchDetails;

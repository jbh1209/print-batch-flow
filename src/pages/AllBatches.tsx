
import React from 'react';
import { useBatchesList } from "@/hooks/useBatchesList";
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AllBatches: React.FC = () => {
  const { batches, isLoading, error, getProductUrl, getBatchUrl } = useBatchesList();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading batches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">There was a problem loading batches</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const handleBatchClick = (batchUrl: string) => {
    navigate(batchUrl);
  };
  
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'queued': return 'outline';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Batches</h1>
          <p className="text-muted-foreground">
            View and manage all batches across product types
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        {batches.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-medium">No batches found</h3>
            <p className="text-muted-foreground mt-1">No batches have been created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Product Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>{batch.name}</TableCell>
                    <TableCell>{batch.product_type}</TableCell>
                    <TableCell>{batch.due_date ? format(new Date(batch.due_date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(batch.status)}>
                        {batch.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        onClick={() => handleBatchClick(getBatchUrl(batch))}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllBatches;


import { useState } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Eye, File, Trash2, MoreHorizontal } from "lucide-react";
import { format } from 'date-fns';
import { BaseBatch } from '@/config/productTypes';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

interface GenericBatchesListProps {
  batches: BaseBatch[];
  isLoading: boolean;
  error: string | null;
  batchToDelete: string | null;
  isDeleting: boolean;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: () => Promise<void>;
  onViewBatchDetails: (id: string) => void;
  onSetBatchToDelete: (id: string | null) => void;
  productType: string;
  title: string;
}

export const GenericBatchesList = ({
  batches,
  isLoading,
  error,
  batchToDelete,
  isDeleting,
  onViewPDF,
  onDeleteBatch,
  onViewBatchDetails,
  onSetBatchToDelete,
  productType,
  title
}: GenericBatchesListProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <p>Loading batches...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
        <p>Error: {error}</p>
      </div>
    );
  }
  
  if (batches.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{title} Batches</h1>
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium">No batches found</h3>
          <p className="text-gray-500 mt-2">Create a batch from the jobs page to get started.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{title} Batches</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {batches.map(batch => (
          <Card key={batch.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{batch.name}</CardTitle>
                  <CardDescription>Created: {format(new Date(batch.created_at), 'MMM dd, yyyy')}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewBatchDetails(batch.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {batch.front_pdf_url && (
                      <DropdownMenuItem onClick={() => onViewPDF(batch.front_pdf_url)}>
                        <File className="mr-2 h-4 w-4" />
                        View PDF
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => onSetBatchToDelete(batch.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Batch
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Status:</span>
                  <Badge 
                    variant={
                      batch.status === 'completed' ? 'default' : 
                      batch.status === 'processing' ? 'secondary' : 
                      batch.status === 'sent_to_print' ? 'outline' : 'default'
                    }
                    className={
                      batch.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : 
                      batch.status === 'processing' ? 'bg-yellow-500 hover:bg-yellow-600' : 
                      batch.status === 'sent_to_print' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''
                    }
                  >
                    {batch.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Sheets Required:</span>
                  <span>{batch.sheets_required}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Due Date:</span>
                  <span>{format(new Date(batch.due_date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Lamination:</span>
                  <span className="capitalize">{batch.lamination_type}</span>
                </div>
                {batch.paper_type && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Paper Type:</span>
                    <span>{batch.paper_type}</span>
                  </div>
                )}
                {batch.paper_weight && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Paper Weight:</span>
                    <span>{batch.paper_weight}</span>
                  </div>
                )}
                {batch.sides && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Sides:</span>
                    <span className="capitalize">{batch.sides}</span>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => onViewBatchDetails(batch.id)}
                >
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!batchToDelete} onOpenChange={(open) => !open && onSetBatchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will return all jobs in this batch to the queue.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteBatch} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

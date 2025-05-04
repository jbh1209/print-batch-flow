
import React from 'react';
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

interface BatchListCardProps {
  batch: BaseBatch;
  onViewPDF: (url: string | null) => void;
  onViewBatchDetails: (id: string) => void;
  onSetBatchToDelete: (id: string | null) => void;
}

export const BatchListCard: React.FC<BatchListCardProps> = ({
  batch,
  onViewPDF,
  onViewBatchDetails,
  onSetBatchToDelete
}) => {
  return (
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
          <BatchStatusBadge status={batch.status} />
          <BatchDetailRow label="Sheets Required:" value={batch.sheets_required.toString()} />
          <BatchDetailRow label="Due Date:" value={format(new Date(batch.due_date), 'MMM dd, yyyy')} />
          <BatchDetailRow label="Lamination:" value={batch.lamination_type} capitalize={true} />
          {batch.paper_type && (
            <BatchDetailRow label="Paper Type:" value={batch.paper_type} />
          )}
          {batch.paper_weight && (
            <BatchDetailRow label="Paper Weight:" value={batch.paper_weight} />
          )}
          {batch.sides && (
            <BatchDetailRow label="Sides:" value={batch.sides} capitalize={true} />
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
  );
};

const BatchStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getVariant = () => {
    switch (status) {
      case "completed": return "bg-green-500 hover:bg-green-600";
      case "processing": return "bg-yellow-500 hover:bg-yellow-600";
      case "sent_to_print": return "bg-blue-500 hover:bg-blue-600 text-white";
      default: return "";
    }
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">Status:</span>
      <Badge 
        variant={
          status === 'completed' ? 'default' : 
          status === 'processing' ? 'secondary' : 
          status === 'sent_to_print' ? 'outline' : 'default'
        }
        className={getVariant()}
      >
        {status.replace('_', ' ')}
      </Badge>
    </div>
  );
};

interface BatchDetailRowProps {
  label: string;
  value: string;
  capitalize?: boolean;
}

const BatchDetailRow: React.FC<BatchDetailRowProps> = ({ label, value, capitalize = false }) => {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={capitalize ? 'capitalize' : ''}>{value}</span>
    </div>
  );
};

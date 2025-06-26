
import React, { useEffect, useState } from 'react';
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
import BatchUrgencyIndicator from '@/components/batches/BatchUrgencyIndicator';
import { calculateJobUrgency, getUrgencyBackgroundClass, UrgencyLevel } from "@/utils/dateCalculations";
import { productConfigs } from "@/config/productTypes";

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
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('low');
  const [isLoading, setIsLoading] = useState(true);

  // Determine product type from batch name pattern (DXB-XX-#####)
  const getProductTypeFromBatchName = (name: string): string => {
    const match = name.match(/DXB-([A-Z]+)-\d+/);
    if (match && match[1]) {
      const code = match[1];
      const codeToType: { [key: string]: string } = {
        'BC': 'Business Cards',
        'FL': 'Flyers',
        'PC': 'Postcards',
        'PB': 'Boxes',
        'STK': 'Stickers',
        'COV': 'Covers',
        'POS': 'Posters',
        'SL': 'Sleeves'
      };
      return codeToType[code] || 'Business Cards';
    }
    return 'Business Cards';
  };

  const productType = getProductTypeFromBatchName(batch.name);

  useEffect(() => {
    const calculateUrgency = async () => {
      const normalizedProductType = productType.replace(/\s+/g, '') as keyof typeof productConfigs;
      const config = productConfigs[normalizedProductType] || productConfigs["BusinessCards"];
      const urgency = await calculateJobUrgency(batch.due_date, config);
      setUrgencyLevel(urgency);
      setIsLoading(false);
    };

    calculateUrgency();
  }, [batch.due_date, productType]);
  
  // Get card background based on urgency
  const getCardBackgroundClass = () => {
    if (['completed', 'sent_to_print', 'cancelled'].includes(batch.status)) {
      return 'bg-white'; // Normal background for completed batches
    }
    if (urgencyLevel === 'critical') {
      return 'bg-red-50 border-l-2 border-l-red-500';
    }
    return getUrgencyBackgroundClass(urgencyLevel).replace('border-l-4', 'border-l-2');
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${getCardBackgroundClass()}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <BatchUrgencyIndicator 
              urgencyLevel={urgencyLevel}
              earliestDueDate={batch.due_date}
              productType={productType}
              size="sm"
            />
            <div>
              <CardTitle className={`text-lg ${urgencyLevel === 'critical' ? 'text-red-700 font-bold' : ''}`}>
                {batch.name}
              </CardTitle>
              <CardDescription>
                Created: {format(new Date(batch.created_at), 'MMM dd, yyyy')}
              </CardDescription>
            </div>
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
          <BatchDetailRow 
            label="Due Date:" 
            value={format(new Date(batch.due_date), 'MMM dd, yyyy')} 
            isUrgent={urgencyLevel === 'critical'}
          />
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
  isUrgent?: boolean;
}

const BatchDetailRow: React.FC<BatchDetailRowProps> = ({ label, value, capitalize = false, isUrgent = false }) => {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`${capitalize ? 'capitalize' : ''} ${isUrgent ? 'font-bold text-red-700' : ''}`}>
        {value}
      </span>
    </div>
  );
};

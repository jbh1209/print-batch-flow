
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import BatchUrgencyIndicator from "@/components/batches/BatchUrgencyIndicator";
import { calculateJobUrgency, UrgencyLevel } from "@/utils/dateCalculations";
import { productConfigs } from "@/config/productTypes";

interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: string;
  product_type: string;
  sheets_required: number;
}

interface BatchCardProps {
  batch: BatchSummary;
  getBatchUrl: (batch: BatchSummary) => string;
}

const BatchCard = ({ batch, getBatchUrl }: BatchCardProps) => {
  const navigate = useNavigate();
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('low');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const calculateUrgency = async () => {
      const config = productConfigs[batch.product_type] || productConfigs["Business Cards"];
      const urgency = await calculateJobUrgency(batch.due_date, config);
      setUrgencyLevel(urgency);
      setIsLoading(false);
    };

    calculateUrgency();
  }, [batch.due_date, batch.product_type]);
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  // Get card background color based on status
  const getCardBackgroundColor = () => {
    switch (batch.status) {
      case 'completed':
        return 'bg-green-50 border-green-300 border-l-4';
      case 'sent_to_print':
        return 'bg-blue-50 border-blue-300 border-l-4';
      case 'processing':
        return 'bg-amber-50 border-amber-300 border-l-4';
      case 'cancelled':
        return 'bg-red-50 border-red-300 border-l-4';
      default:
        return 'bg-white';
    }
  };

  const isCompletedOrSent = batch.status === 'completed' || batch.status === 'sent_to_print';

  if (isLoading) {
    return (
      <div className={`rounded-lg shadow border p-6 ${getCardBackgroundColor()}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg shadow border p-6 ${getCardBackgroundColor()}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-2">
          <BatchUrgencyIndicator 
            urgencyLevel={urgencyLevel}
            earliestDueDate={batch.due_date}
            productType={batch.product_type}
          />
          <div>
            <h3 className="font-medium text-lg">{batch.name}</h3>
            <p className="text-sm text-gray-500">{batch.product_type}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium 
          ${batch.status === 'completed' ? 'bg-green-100 text-green-800' : 
          batch.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
          batch.status === 'sent_to_print' ? 'bg-emerald-100 text-emerald-800' :
          batch.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
          'bg-amber-100 text-amber-800'}`}
        >
          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1).replace('_', ' ')}
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <div className="text-gray-500">Due Date:</div>
        <div>{formatDate(batch.due_date)}</div>
        <div className="text-gray-500">Sheets:</div>
        <div>{batch.sheets_required}</div>
      </div>
      
      <Button 
        className={`w-full mt-4 ${isCompletedOrSent ? 'bg-gray-300 hover:bg-gray-400' : ''}`}
        onClick={() => navigate(getBatchUrl(batch))}
      >
        View Batch Details
      </Button>
    </div>
  );
};

export default BatchCard;

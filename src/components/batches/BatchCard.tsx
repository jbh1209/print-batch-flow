
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

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
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-lg">{batch.name}</h3>
          <p className="text-sm text-gray-500">{batch.product_type}</p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium 
          ${batch.status === 'completed' ? 'bg-green-100 text-green-800' : 
          batch.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
          batch.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
          'bg-amber-100 text-amber-800'}`}
        >
          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <div className="text-gray-500">Due Date:</div>
        <div>{formatDate(batch.due_date)}</div>
        <div className="text-gray-500">Sheets:</div>
        <div>{batch.sheets_required}</div>
      </div>
      
      <Button 
        className="w-full mt-4" 
        onClick={() => navigate(getBatchUrl(batch))}
      >
        View Batch Details
      </Button>
    </div>
  );
};

export default BatchCard;

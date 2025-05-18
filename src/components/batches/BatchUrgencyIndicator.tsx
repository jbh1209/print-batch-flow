
import React from 'react';
import { format, isAfter } from 'date-fns';
import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import { UrgencyLevel, getBatchUrgencyColor, getBatchUrgencyIcon } from '@/utils/dateCalculations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { productConfigs } from '@/config/productTypes';

interface BatchUrgencyIndicatorProps {
  urgencyLevel: UrgencyLevel;
  earliestDueDate: string;
  productType: string;
}

const BatchUrgencyIndicator: React.FC<BatchUrgencyIndicatorProps> = ({
  urgencyLevel,
  earliestDueDate,
  productType
}) => {
  // Get the SLA for this product type
  const config = productConfigs[productType] || productConfigs["BusinessCards"];
  const sla = config.slaTargetDays || 3;
  
  // Format the date for display
  const formattedDate = format(new Date(earliestDueDate), 'MMM dd, yyyy');
  
  // Get the icon based on urgency
  const getIcon = () => {
    switch (urgencyLevel) {
      case 'critical':
        return <CircleX className="h-5 w-5 text-red-500" />;
      case 'high':
        return <CircleAlert className="h-5 w-5 text-amber-500" />;
      case 'medium':
        return <CircleAlert className="h-5 w-5 text-yellow-500" />;
      default: // low
        return <CircleCheck className="h-5 w-5 text-green-500" />;
    }
  };

  // Get tooltip message based on urgency
  const getTooltipMessage = () => {
    const isPastDue = isAfter(new Date(), new Date(earliestDueDate));
    
    switch (urgencyLevel) {
      case 'critical':
        return isPastDue 
          ? `Past due (${formattedDate})` 
          : `Due today (${formattedDate})`;
      case 'high':
        return `Due within ${sla} days (${formattedDate})`;
      case 'medium':
        return `Due within ${sla * 2} days (${formattedDate})`;
      default: // low
        return `Due ${formattedDate}`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{getIcon()}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipMessage()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BatchUrgencyIndicator;

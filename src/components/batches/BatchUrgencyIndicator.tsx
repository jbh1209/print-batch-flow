
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { productConfigs } from "@/config/productTypes";
import { UrgencyLevel, getBatchUrgencyColor, getBatchUrgencyIcon } from "@/utils/dateCalculations";
import { CircleCheck, CircleAlert, CircleX, Circle } from "lucide-react";

interface BatchUrgencyIndicatorProps {
  urgencyLevel: UrgencyLevel;
  earliestDueDate: string;
  productType: string;
}

const BatchUrgencyIndicator = ({ urgencyLevel, earliestDueDate, productType }: BatchUrgencyIndicatorProps) => {
  const colorClass = getBatchUrgencyColor(urgencyLevel);
  const iconType = getBatchUrgencyIcon(urgencyLevel);
  const dueDate = new Date(earliestDueDate);
  const today = new Date();
  const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Normalize product type and safely get SLA setting
  const normalizedProductType = productType.replace(/\s+/g, '') as keyof typeof productConfigs;
  const slaTargetDays = productConfigs[normalizedProductType]?.slaTargetDays || 3;
  
  const getTooltipText = () => {
    switch (urgencyLevel) {
      case "critical":
        return daysUntilDue < 0 
          ? `Overdue by ${Math.abs(daysUntilDue)} days` 
          : "Critical - Due immediately";
      case "high":
        return "High priority - Due very soon";
      case "medium":
        return "Medium priority - Due soon";
      case "low":
        return "On track";
      default:
        return "Unknown status";
    }
  };
  
  const renderIcon = () => {
    switch (iconType) {
      case "circle-check":
        return <CircleCheck className={`h-5 w-5 ${colorClass}`} />;
      case "circle-alert":
        return <CircleAlert className={`h-5 w-5 ${colorClass}`} />;
      case "circle-x":
        return <CircleX className={`h-5 w-5 ${colorClass}`} />;
      default:
        return <Circle className={`h-5 w-5 ${colorClass}`} />;
    }
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex items-center">
          {renderIcon()}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {getTooltipText()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Due: {dueDate.toLocaleDateString()} 
            {daysUntilDue >= 0 ? (
              <span> ({daysUntilDue} days remaining)</span>
            ) : (
              <span> ({Math.abs(daysUntilDue)} days ago)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            SLA Target: {slaTargetDays} days
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BatchUrgencyIndicator;

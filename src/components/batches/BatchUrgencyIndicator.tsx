
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { productConfigs } from "@/config/productTypes";
import { UrgencyLevel, getBatchUrgencyColor, getBatchUrgencyIcon } from "@/utils/dateCalculations";
import { CircleCheck, CircleAlert, CircleX, Circle } from "lucide-react";

interface BatchUrgencyIndicatorProps {
  urgencyLevel: UrgencyLevel;
  earliestDueDate: string;
  productType: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const BatchUrgencyIndicator = ({ 
  urgencyLevel, 
  earliestDueDate, 
  productType,
  size = "md",
  showLabel = false
}: BatchUrgencyIndicatorProps) => {
  const colorClass = getBatchUrgencyColor(urgencyLevel);
  const iconType = getBatchUrgencyIcon(urgencyLevel);
  const dueDate = new Date(earliestDueDate);
  const today = new Date();
  const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Normalize product type by removing spaces and safely get SLA setting with a fallback
  const normalizedProductType = productType.replace(/\s+/g, '') as keyof typeof productConfigs;
  const slaTargetDays = productConfigs[normalizedProductType]?.slaTargetDays || 3;
  
  // Enhanced color classes with background for better visibility
  const getEnhancedColorClass = () => {
    switch (urgencyLevel) {
      case "critical":
        return "text-red-600 bg-red-100 border border-red-300 animate-pulse";
      case "high":
        return "text-amber-600 bg-amber-100 border border-amber-300";
      case "medium":
        return "text-yellow-600 bg-yellow-100 border border-yellow-300";
      case "low":
        return "text-emerald-600 bg-emerald-100 border border-emerald-300";
      default:
        return "text-gray-500 bg-gray-100 border border-gray-300";
    }
  };
  
  const getSizeClass = () => {
    switch (size) {
      case "sm":
        return "h-4 w-4";
      case "lg":
        return "h-7 w-7";
      default:
        return "h-5 w-5";
    }
  };
  
  const getTooltipText = () => {
    switch (urgencyLevel) {
      case "critical":
        return daysUntilDue < 0 
          ? `OVERDUE by ${Math.abs(daysUntilDue)} days - URGENT ACTION REQUIRED` 
          : "CRITICAL - Due immediately";
      case "high":
        return "HIGH PRIORITY - Due very soon";
      case "medium":
        return "MEDIUM PRIORITY - Due soon";
      case "low":
        return "ON TRACK - Good timing";
      default:
        return "Unknown status";
    }
  };
  
  const getUrgencyLabel = () => {
    switch (urgencyLevel) {
      case "critical":
        return "OVERDUE";
      case "high":
        return "URGENT";
      case "medium":
        return "SOON";
      case "low":
        return "ON TRACK";
      default:
        return "UNKNOWN";
    }
  };
  
  const renderIcon = () => {
    const iconClass = `${getSizeClass()} ${colorClass}`;
    switch (iconType) {
      case "circle-check":
        return <CircleCheck className={iconClass} />;
      case "circle-alert":
        return <CircleAlert className={iconClass} />;
      case "circle-x":
        return <CircleX className={iconClass} />;
      default:
        return <Circle className={iconClass} />;
    }
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex items-center gap-2">
          <div className={`rounded-full p-1.5 ${getEnhancedColorClass()}`}>
            {renderIcon()}
          </div>
          {showLabel && (
            <span className={`text-xs font-semibold ${colorClass}`}>
              {getUrgencyLabel()}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-bold text-sm">
            {getTooltipText()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Due: {dueDate.toLocaleDateString()} 
            {daysUntilDue >= 0 ? (
              <span> ({daysUntilDue} days remaining)</span>
            ) : (
              <span className="text-red-600 font-bold"> ({Math.abs(daysUntilDue)} days ago)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            SLA Target: {slaTargetDays} business days
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BatchUrgencyIndicator;

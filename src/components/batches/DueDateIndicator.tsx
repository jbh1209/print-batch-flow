
import React from "react";
import { format } from "date-fns";
import { calculateJobUrgency, getUrgencyTextClass } from "@/utils/dateCalculations";
import { productConfigs } from "@/config/productTypes";

interface DueDateIndicatorProps {
  dueDate: string;
  productType?: string;
}

export const DueDateIndicator: React.FC<DueDateIndicatorProps> = ({
  dueDate,
  productType = "BusinessCards"
}) => {
  // Get the appropriate product config (default to BusinessCards if not specified)
  const config = productConfigs[productType as keyof typeof productConfigs] || productConfigs.BusinessCards;
  
  // Calculate urgency level
  const urgency = calculateJobUrgency(dueDate, config);
  
  // Get appropriate text color class based on urgency
  const textColorClass = getUrgencyTextClass(urgency);
  
  // Format the date for display
  const formattedDate = format(new Date(dueDate), "MMM dd, yyyy");
  
  return (
    <span className={`font-medium ${textColorClass}`}>
      {formattedDate}
    </span>
  );
};

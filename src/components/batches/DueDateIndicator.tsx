
import React from 'react';
import { format } from 'date-fns';
import { calculateJobUrgency, getUrgencyTextClass, UrgencyLevel } from '@/utils/dateCalculations';
import { productConfigs } from '@/config/productTypes';

interface DueDateIndicatorProps {
  dueDate: string;
  productType: string;
}

export const DueDateIndicator: React.FC<DueDateIndicatorProps> = ({ dueDate, productType }) => {
  // Get config for this product type
  const config = productConfigs[productType] || { slaTargetDays: 3 };
  
  // Calculate urgency level
  const urgency: UrgencyLevel = calculateJobUrgency(dueDate, config);
  
  // Format date for display
  const formattedDate = format(new Date(dueDate), 'MMM dd, yyyy');
  
  // Get appropriate CSS class based on urgency
  const urgencyClass = getUrgencyTextClass(urgency);
  
  return (
    <span className={`font-medium ${urgencyClass}`}>
      {formattedDate}
    </span>
  );
};

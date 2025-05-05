
import { differenceInDays } from 'date-fns';
import { ProductConfig } from '@/config/productTypes';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export const calculateJobUrgency = (dueDateStr: string, productConfig: ProductConfig): UrgencyLevel => {
  const dueDate = new Date(dueDateStr);
  const today = new Date();
  const daysUntilDue = differenceInDays(dueDate, today);

  // Get SLA target days from the product config, default to 3 days
  const slaTargetDays = productConfig?.slaTargetDays || 3;

  if (daysUntilDue < 0) {
    return 'critical';  // Past due
  } else if (daysUntilDue === 0) {
    return 'critical';  // Due today
  } else if (daysUntilDue <= 1) {
    return 'high';      // Due within 1 day
  } else if (daysUntilDue <= Math.ceil(slaTargetDays / 2)) {
    return 'medium';    // Due within half of SLA target days
  } else {
    return 'low';       // Due in SLA target days or more
  }
};

// Get background color class based on urgency level
export const getUrgencyBackgroundClass = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case 'critical':
      return 'bg-red-50 border-l-4 border-l-red-500';
    case 'high':
      return 'bg-amber-50 border-l-4 border-l-amber-500';
    case 'medium':
      return 'bg-yellow-50 border-l-4 border-l-yellow-500';
    case 'low':
    default:
      return 'bg-white';
  }
};

// Get text color class based on urgency level
export const getUrgencyColor = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case 'critical':
      return 'text-red-700';
    case 'high':
      return 'text-amber-700';
    case 'medium':
      return 'text-yellow-700';
    case 'low':
    default:
      return 'text-green-700';
  }
};

// Get icon type for batch urgency indicators
export const getBatchUrgencyIcon = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case 'critical':
      return 'circle-x';
    case 'high':
      return 'circle-alert';
    case 'medium':
      return 'circle-alert';
    case 'low':
    default:
      return 'circle-check';
  }
};

// Get color class for batch urgency indicators
export const getBatchUrgencyColor = (urgency: UrgencyLevel): string => {
  switch (urgency) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-amber-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
    default:
      return 'text-green-500';
  }
};

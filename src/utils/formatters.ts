
/**
 * Format a date string or Date object into a user-friendly format
 */
export function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return 'Unknown';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Check for invalid date
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Format a number to include comma separators
 */
export function formatNumber(num: number | undefined): string {
  if (num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string | undefined): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a status string with proper capitalization
 */
export function formatStatus(status: string | undefined): string {
  if (!status) return 'Unknown';
  
  return status
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}

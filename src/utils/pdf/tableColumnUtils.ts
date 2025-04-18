
export function calculateColumnWidths(isBusinessCard: boolean): number[] {
  return isBusinessCard 
    ? [150, 80, 70, 80, 100]  // Business card column widths
    : [150, 60, 60, 70, 80];  // Flyer column widths
}

export function calculateHeaderLabels(isBusinessCard: boolean): string[] {
  return [
    "Job Name", 
    "Due Date", 
    "Quantity", 
    isBusinessCard ? "Double-sided" : "Size", 
    "Allocation"
  ];
}

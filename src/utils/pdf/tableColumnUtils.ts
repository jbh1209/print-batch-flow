
export function calculateColumnWidths(isBusinessCard: boolean): number[] {
  if (isBusinessCard) {
    return [150, 80, 70, 80, 100];  // Business card column widths
  }
  return [150, 80, 70, 80, 100];    // Standard column widths for flyers and sleeves
}

export function calculateHeaderLabels(isBusinessCard: boolean): string[] {
  if (isBusinessCard) {
    return ["Job Name", "Due Date", "Quantity", "Double-sided", "Allocation"];
  }
  return ["Job Name", "Due Date", "Quantity", "Stock Type", "Allocation"];
}


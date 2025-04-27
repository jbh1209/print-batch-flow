
export function calculateHeaderLabels(isBusinessCard: boolean = false, isSleeve: boolean = false): string[] {
  if (isBusinessCard) {
    return ["Job Name", "Due Date", "Quantity", "Double-sided", "Allocation"];
  } else if (isSleeve) {
    return ["Job Name", "Due Date", "Quantity", "Stock Type"];
  } else {
    // Default for flyers or other products
    return ["Job Name", "Due Date", "Quantity", "Size", "Type"];
  }
}

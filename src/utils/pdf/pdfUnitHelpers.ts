
// Convert mm to points (1 point = 1/72 inch, 1 inch = 25.4mm)
export const mmToPoints = (mm: number): number => mm * 72 / 25.4;

// Convert points to mm
export const pointsToMm = (pt: number): number => pt * 25.4 / 72;

// Convert inches to points
export const inchesToPoints = (inches: number): number => inches * 72;

// Convert points to inches
export const pointsToInches = (pt: number): number => pt / 72;

// Convert cm to points
export const cmToPoints = (cm: number): number => cm * 72 / 2.54;

// Get standard paper size in points
export const getPaperSizeInPoints = (paperSize: string): { width: number, height: number } => {
  // Sizes defined in mm (width, height)
  const paperSizes: Record<string, [number, number]> = {
    'A3': [297, 420],
    'A4': [210, 297],
    'A5': [148, 210],
    'A6': [105, 148],
    'DL': [99, 210],
    'Letter': [215.9, 279.4],
    'Legal': [215.9, 355.6],
    'Tabloid': [279.4, 431.8]
  };

  if (!paperSizes[paperSize]) {
    console.warn(`Paper size ${paperSize} not found, defaulting to A4`);
    return { width: mmToPoints(210), height: mmToPoints(297) };
  }

  const [width, height] = paperSizes[paperSize];
  return { 
    width: mmToPoints(width), 
    height: mmToPoints(height)
  };
};

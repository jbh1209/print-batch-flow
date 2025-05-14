
// Convert mm to points (1 point = 1/72 inch, 1 inch = 25.4mm)
export const mmToPoints = (mm: number): number => mm * 72 / 25.4;

// Convert points to mm
export const pointsToMm = (pt: number): number => pt * 25.4 / 72;

// Convert inches to points
export const inchesToPoints = (inches: number): number => inches * 72;

// Convert points to inches
export const pointsToInches = (pt: number): number => pt / 72;

// Convert pixels to points (assuming 96 DPI)
export const pixelsToPoints = (px: number): number => px * 72 / 96;

// Convert points to pixels (assuming 96 DPI)
export const pointsToPixels = (pt: number): number => pt * 96 / 72;

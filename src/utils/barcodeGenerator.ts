
import JsBarcode from 'jsbarcode';

export interface BarcodeData {
  wo_no: string;
  job_id: string;
  customer?: string;
  due_date?: string;
}

export const generateBarcodeData = (jobData: BarcodeData): string => {
  // Use just the work order number for a cleaner, scannable barcode
  // This creates fewer lines and can be printed larger on stickers
  return jobData.wo_no;
};

export const generateBarcodeImage = async (data: string): Promise<string> => {
  try {
    // Create a canvas element to generate the barcode
    const canvas = document.createElement('canvas');
    
    // Generate barcode using Code128 format (widely supported)
    JsBarcode(canvas, data, {
      format: "CODE128",
      width: 2,
      height: 100,
      displayValue: true,
      fontSize: 12,
      margin: 10,
      background: "#ffffff",
      lineColor: "#000000"
    });
    
    // Convert canvas to data URL
    const barcodeDataURL = canvas.toDataURL('image/png');
    return barcodeDataURL;
  } catch (error) {
    console.error('Error generating barcode:', error);
    throw new Error('Failed to generate barcode');
  }
};

export const parseBarcodeData = (barcodeData: string): { wo_no: string } | null => {
  try {
    // Parse the barcode - now it's just the work order number
    return {
      wo_no: barcodeData
    };
  } catch (error) {
    console.error('Error parsing barcode data:', error);
    return null;
  }
};

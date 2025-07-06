
import JsBarcode from 'jsbarcode';

export interface BarcodeData {
  wo_no: string;
  job_id: string;
  customer?: string;
  due_date?: string;
}

export const generateBarcodeData = (jobData: BarcodeData): string => {
  // Use only the work order number for shorter, cleaner barcodes
  // This reduces barcode density and improves scanning reliability
  const woNumber = jobData.wo_no.replace(/[^A-Z0-9]/gi, ''); // Remove special characters
  return woNumber;
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

export const parseBarcodeData = (barcodeData: string): { wo_no: string; job_id_partial: string } | null => {
  try {
    // Parse the new simplified barcode format - just the work order number
    const cleanedWoNo = barcodeData.replace(/[^A-Z0-9]/gi, ''); // Remove any special characters
    if (cleanedWoNo && cleanedWoNo.length > 0) {
      return {
        wo_no: cleanedWoNo,
        job_id_partial: '' // No job ID in the new format
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing barcode data:', error);
    return null;
  }
};

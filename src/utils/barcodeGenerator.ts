
import JsBarcode from 'jsbarcode';

export interface BarcodeData {
  wo_no: string;
  job_id: string;
  customer?: string;
  due_date?: string;
}

export const generateBarcodeData = (jobData: BarcodeData): string => {
  // Create a unique barcode using work order number and job ID
  // Format: WO{wo_no}J{first_8_chars_of_job_id}
  const shortJobId = jobData.job_id.substring(0, 8).toUpperCase();
  const woNumber = jobData.wo_no.replace(/[^A-Z0-9]/gi, ''); // Remove special characters
  return `WO${woNumber}J${shortJobId}`;
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
    // Parse the barcode format: WO{wo_no}J{job_id_partial}
    const match = barcodeData.match(/^WO(.+)J([A-Z0-9]{8})$/);
    if (match) {
      return {
        wo_no: match[1],
        job_id_partial: match[2]
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing barcode data:', error);
    return null;
  }
};

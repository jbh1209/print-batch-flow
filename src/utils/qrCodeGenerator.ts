
import QRCode from 'qrcode';

export interface QRCodeData {
  wo_no: string;
  job_id: string;
  customer?: string;
  due_date?: string;
}

export const generateQRCodeData = (jobData: QRCodeData): string => {
  return JSON.stringify({
    wo_no: jobData.wo_no,
    job_id: jobData.job_id,
    customer: jobData.customer,
    due_date: jobData.due_date,
    generated_at: new Date().toISOString()
  });
};

export const generateQRCodeImage = async (data: string): Promise<string> => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

export const parseQRCodeData = (qrData: string): QRCodeData | null => {
  try {
    return JSON.parse(qrData);
  } catch (error) {
    console.error('Error parsing QR code data:', error);
    return null;
  }
};

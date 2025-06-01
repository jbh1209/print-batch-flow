
import { generateQRCodeData, generateQRCodeImage } from './qrCodeGenerator';
import { mmToPoints } from './pdf/pdfUnitHelpers';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface QRLabelData {
  id: string;
  wo_no: string;
  customer?: string;
  due_date?: string;
  status?: string;
  reference?: string;
}

export const generateQRLabelPDF = async (jobs: QRLabelData[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Exact label dimensions: 100mm x 50mm
  const labelWidth = mmToPoints(100);
  const labelHeight = mmToPoints(50);

  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
    const job = jobs[jobIndex];
    
    // Create a new page for each label with exact dimensions
    const currentPage = pdfDoc.addPage([labelWidth, labelHeight]);

    // Generate QR code for this job
    const qrData = generateQRCodeData({
      wo_no: job.wo_no,
      job_id: job.id,
      customer: job.customer,
      due_date: job.due_date
    });

    try {
      const qrCodeDataURL = await generateQRCodeImage(qrData);
      
      // Convert data URL to image bytes
      const qrImageBytes = await fetch(qrCodeDataURL).then(res => res.arrayBuffer());
      const qrImage = await pdfDoc.embedPng(qrImageBytes);
      
      // Draw label border
      currentPage.drawRectangle({
        x: 0,
        y: 0,
        width: labelWidth,
        height: labelHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // Order number at the top (ensure D prefix)
      const orderNumber = job.wo_no.startsWith('D') ? job.wo_no : `D${job.wo_no}`;
      currentPage.drawText(orderNumber, {
        x: labelWidth / 2 - boldFont.widthOfTextAtSize(orderNumber, 14) / 2,
        y: labelHeight - 15,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // QR Code - centered
      const qrSize = mmToPoints(25); // 25mm QR code
      const qrX = (labelWidth - qrSize) / 2;
      const qrY = (labelHeight - qrSize) / 2 - 2;
      
      currentPage.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });

      // Additional info at bottom if available
      let bottomY = 8;
      
      if (job.customer) {
        const customerText = job.customer.length > 30 ? 
          job.customer.substring(0, 27) + '...' : 
          job.customer;
        const customerWidth = font.widthOfTextAtSize(customerText, 8);
        currentPage.drawText(customerText, {
          x: labelWidth / 2 - customerWidth / 2,
          y: bottomY,
          size: 8,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        });
        bottomY -= 10;
      }

      if (job.due_date) {
        const dueDateText = `Due: ${new Date(job.due_date).toLocaleDateString()}`;
        const dueDateWidth = font.widthOfTextAtSize(dueDateText, 7);
        currentPage.drawText(dueDateText, {
          x: labelWidth / 2 - dueDateWidth / 2,
          y: bottomY,
          size: 7,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

    } catch (error) {
      console.error(`Error generating QR code for job ${job.wo_no}:`, error);
      
      // Draw error placeholder with order number
      currentPage.drawRectangle({
        x: 0,
        y: 0,
        width: labelWidth,
        height: labelHeight,
        borderColor: rgb(1, 0, 0),
        borderWidth: 1,
      });
      
      const errorOrderNumber = job.wo_no.startsWith('D') ? job.wo_no : `D${job.wo_no}`;
      currentPage.drawText(errorOrderNumber, {
        x: labelWidth / 2 - boldFont.widthOfTextAtSize(errorOrderNumber, 14) / 2,
        y: labelHeight - 15,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      currentPage.drawText('QR Generation Error', {
        x: labelWidth / 2 - font.widthOfTextAtSize('QR Generation Error', 10) / 2,
        y: labelHeight / 2,
        size: 10,
        font: font,
        color: rgb(1, 0, 0),
      });
    }
  }

  return await pdfDoc.save();
};

export const downloadQRLabelsPDF = async (jobs: QRLabelData[], filename?: string) => {
  try {
    const pdfBytes = await generateQRLabelPDF(jobs);
    
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `qr-labels-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error generating QR labels PDF:', error);
    throw error;
  }
};

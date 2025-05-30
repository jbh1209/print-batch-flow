
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

      // Header with job number (with D prefix)
      const jobNumber = `D${job.wo_no}`;
      currentPage.drawText(jobNumber, {
        x: 10,
        y: labelHeight - 20,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Status badge if available
      if (job.status) {
        const statusText = job.status.toUpperCase();
        const statusWidth = boldFont.widthOfTextAtSize(statusText, 8);
        currentPage.drawRectangle({
          x: labelWidth - statusWidth - 20,
          y: labelHeight - 25,
          width: statusWidth + 10,
          height: 15,
          color: rgb(0.9, 0.9, 0.9),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
        currentPage.drawText(statusText, {
          x: labelWidth - statusWidth - 15,
          y: labelHeight - 22,
          size: 8,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      }

      // QR Code - centered
      const qrSize = mmToPoints(25); // 25mm QR code
      const qrX = (labelWidth - qrSize) / 2;
      const qrY = (labelHeight - qrSize) / 2 - 5;
      
      currentPage.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });

      // Customer info (if available)
      if (job.customer) {
        const customerText = job.customer.length > 25 ? 
          job.customer.substring(0, 22) + '...' : 
          job.customer;
        currentPage.drawText(customerText, {
          x: 10,
          y: 25,
          size: 8,
          font: font,
          color: rgb(0, 0, 0),
        });
      }

      // Due date and reference on bottom
      const bottomY = 10;
      if (job.due_date) {
        const dueDateText = `Due: ${new Date(job.due_date).toLocaleDateString()}`;
        currentPage.drawText(dueDateText, {
          x: 10,
          y: bottomY,
          size: 7,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      if (job.reference) {
        const refText = job.reference.length > 15 ? 
          job.reference.substring(0, 12) + '...' : 
          job.reference;
        currentPage.drawText(refText, {
          x: labelWidth - 60,
          y: bottomY,
          size: 7,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      // Generation timestamp
      const timestamp = new Date().toLocaleDateString();
      currentPage.drawText(timestamp, {
        x: labelWidth - 50,
        y: 5,
        size: 6,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

    } catch (error) {
      console.error(`Error generating QR code for job ${job.wo_no}:`, error);
      
      // Draw error placeholder
      currentPage.drawRectangle({
        x: 0,
        y: 0,
        width: labelWidth,
        height: labelHeight,
        borderColor: rgb(1, 0, 0),
        borderWidth: 1,
      });
      
      currentPage.drawText(`D${job.wo_no}`, {
        x: 10,
        y: labelHeight - 20,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      currentPage.drawText('QR Error', {
        x: 10,
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

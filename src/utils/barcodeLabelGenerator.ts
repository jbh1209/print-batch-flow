
import { generateBarcodeData, generateBarcodeImage } from './barcodeGenerator';
import { mmToPoints } from './pdf/pdfUnitHelpers';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface BarcodeLabelData {
  id: string;
  wo_no: string;
  customer?: string;
  due_date?: string;
  status?: string;
  reference?: string;
}

export const generateBarcodeLabelPDF = async (jobs: BarcodeLabelData[]): Promise<Uint8Array> => {
  console.log('Starting PDF generation for', jobs.length, 'jobs with barcodes');
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Exact label dimensions: 100mm x 50mm
  const labelWidth = mmToPoints(100);
  const labelHeight = mmToPoints(50);

  console.log('Label dimensions:', { labelWidth, labelHeight });

  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
    const job = jobs[jobIndex];
    console.log(`Processing job ${jobIndex + 1}/${jobs.length}: ${job.wo_no}`);
    
    // Create a new page for each label with exact dimensions
    const currentPage = pdfDoc.addPage([labelWidth, labelHeight]);

    // Generate barcode for this job
    const barcodeData = generateBarcodeData({
      wo_no: job.wo_no,
      job_id: job.id,
      customer: job.customer,
      due_date: job.due_date
    });

    try {
      const barcodeDataURL = await generateBarcodeImage(barcodeData);
      
      // Convert data URL to image bytes
      const barcodeImageBytes = await fetch(barcodeDataURL).then(res => res.arrayBuffer());
      const barcodeImage = await pdfDoc.embedPng(barcodeImageBytes);
      
      // Draw label border for visual clarity
      currentPage.drawRectangle({
        x: 0,
        y: 0,
        width: labelWidth,
        height: labelHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // Calculate barcode dimensions and position first
      const barcodeWidth = mmToPoints(70); // 70mm barcode width
      const barcodeHeight = mmToPoints(20); // 20mm barcode height
      const barcodeX = (labelWidth - barcodeWidth) / 2;
      const barcodeY = (labelHeight - barcodeHeight) / 2;

      // Order number just above the barcode (ensure D prefix)
      const orderNumber = job.wo_no.startsWith('D') ? job.wo_no : `D${job.wo_no}`;
      const orderNumberY = barcodeY + barcodeHeight + 8; // 8pt gap above barcode
      currentPage.drawText(orderNumber, {
        x: labelWidth / 2 - boldFont.widthOfTextAtSize(orderNumber, 14) / 2,
        y: orderNumberY,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      // Draw the barcode - centered
      currentPage.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeWidth,
        height: barcodeHeight,
      });

      // Additional info just below barcode
      let bottomY = barcodeY - 8; // Start 8pt below barcode
      
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
      console.error(`Error generating barcode for job ${job.wo_no}:`, error);
      
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
      
      currentPage.drawText('Barcode Generation Error', {
        x: labelWidth / 2 - font.widthOfTextAtSize('Barcode Generation Error', 10) / 2,
        y: labelHeight / 2,
        size: 10,
        font: font,
        color: rgb(1, 0, 0),
      });
    }
  }

  console.log('PDF generation complete, saving document');
  return await pdfDoc.save();
};

export const downloadBarcodeLabelsPDF = async (jobs: BarcodeLabelData[], filename?: string): Promise<boolean> => {
  try {
    console.log('Starting PDF download process for', jobs.length, 'jobs');
    
    const pdfBytes = await generateBarcodeLabelPDF(jobs);
    
    console.log('PDF generated successfully, size:', pdfBytes.length, 'bytes');
    
    // Create blob with PDF content type
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    console.log('Blob created, starting download');
    
    // Create download link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `barcode-labels-${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Make sure the filename ends with .pdf
    if (!link.download.endsWith('.pdf')) {
      link.download += '.pdf';
    }
    
    console.log('Download filename:', link.download);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    console.log('Download triggered successfully');
    return true;
  } catch (error) {
    console.error('Error generating barcode labels PDF:', error);
    throw error;
  }
};

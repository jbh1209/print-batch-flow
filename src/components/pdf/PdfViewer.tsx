
import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getSignedUrl } from '@/utils/pdf/urlUtils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string | null;
  className?: string;
}

const PdfViewer = ({ url, className = '' }: PdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadPDF = async () => {
      if (!url || !canvasRef.current) return;

      try {
        // Get signed URL if needed
        const pdfUrl = await getSignedUrl(url);
        if (!pdfUrl) {
          console.error('Could not get signed URL for PDF');
          return;
        }

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        // Get the first page
        const page = await pdf.getPage(1);

        // Prepare canvas for rendering
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Set viewport and scale
        const viewport = page.getViewport({ scale: 1.0 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

      } catch (error) {
        console.error('Error rendering PDF:', error);
      }
    };

    loadPDF();
  }, [url]);

  if (!url) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <p className="text-gray-500">No PDF available</p>
      </div>
    );
  }

  return (
    <div className={`overflow-auto ${className}`}>
      <canvas ref={canvasRef} className="max-w-full h-auto" />
    </div>
  );
};

export default PdfViewer;

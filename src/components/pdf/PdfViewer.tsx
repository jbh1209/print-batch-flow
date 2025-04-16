
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getSignedUrl } from '@/utils/pdf/signedUrlHelper';
import { loadPdfAsBytes } from '@/utils/pdf/pdfLoaderCore';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string | null;
  className?: string;
}

const PdfViewer = ({ url, className = '' }: PdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPDF = async () => {
      if (!url || !canvasRef.current) return;

      try {
        setIsLoading(true);
        setError(null);
        
        // Get signed URL using helper
        const pdfUrl = await getSignedUrl(url);
        if (!pdfUrl) {
          throw new Error('Could not generate a valid URL for this PDF');
        }

        console.log('Loading PDF from URL:', pdfUrl);

        // Load PDF using our core loader
        const pdfData = await loadPdfAsBytes(pdfUrl, 'preview');
        if (!pdfData) {
          throw new Error('Failed to load PDF data');
        }

        // Load the PDF document using the array buffer
        const pdf = await pdfjsLib.getDocument(pdfData.buffer).promise;
        const page = await pdf.getPage(1);
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');

        // Set viewport with better initial scale
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        console.log('PDF rendered successfully');

      } catch (error) {
        console.error('Error rendering PDF:', error);
        setError(error instanceof Error ? error.message : 'Failed to render PDF');
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [url]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-500">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <div className="flex flex-col items-center text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-gray-500">Try downloading the PDF instead for better results.</p>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <p className="text-gray-500">No PDF available</p>
      </div>
    );
  }

  return (
    <div className={`overflow-auto ${className}`}>
      <canvas ref={canvasRef} className="max-w-full h-auto mx-auto" />
    </div>
  );
};

export default PdfViewer;

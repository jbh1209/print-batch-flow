
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getSignedUrl } from '@/utils/pdf/urlUtils';

// Configure PDF.js to use a local worker from the same library
// This avoids CDN issues with the worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

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
        
        console.log("Attempting to load PDF from:", url);
        
        // Get signed URL if needed
        const pdfUrl = await getSignedUrl(url);
        if (!pdfUrl) {
          console.error('Could not get signed URL for PDF');
          setError('Could not generate a valid URL for this PDF');
          setIsLoading(false);
          return;
        }
        
        console.log("Using signed URL (first 100 chars):", pdfUrl.substring(0, 100));

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        loadingTask.onProgress = (progress) => {
          console.log(`PDF loading: ${progress.loaded} of ${progress.total}`);
        };
        
        const pdf = await loadingTask.promise;
        console.log("PDF loaded successfully with", pdf.numPages, "pages");

        // Get the first page
        const page = await pdf.getPage(1);

        // Prepare canvas for rendering
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;

        // Set viewport and scale with better sizing
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        console.log("Rendering PDF with viewport dimensions:", viewport.width, "x", viewport.height);

        // Render PDF page
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        console.log("PDF rendering completed");

      } catch (error) {
        console.error('Error rendering PDF:', error);
        setError('Failed to render PDF. Please try downloading instead.');
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

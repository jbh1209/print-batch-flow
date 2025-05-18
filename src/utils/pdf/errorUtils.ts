
import { toast } from "sonner";

/**
 * Handles PDF-related errors
 * @param error The error to handle
 */
export const handlePdfError = (error: unknown): void => {
  console.error('PDF operation error:', error);
  
  // Determine the error message to show
  let errorMessage = 'Error processing PDF';
  
  if (error instanceof Error) {
    errorMessage = error.message || errorMessage;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  // Show toast notification
  toast.error("PDF Error", {
    description: errorMessage
  });
};

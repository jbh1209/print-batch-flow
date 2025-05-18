
import { toast } from "sonner";

/**
 * Utility functions for handling PDF-related errors
 */

/**
 * Handles errors that occur during PDF operations
 * @param error Error object or message
 */
export const handlePdfError = (error: unknown): void => {
  console.error("PDF operation error:", error);
  
  let errorMessage = "Failed to access the PDF file.";
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  // Prevent exposing sensitive information in error messages
  if (errorMessage.includes('token') || errorMessage.includes('key')) {
    errorMessage = "Authentication error accessing the PDF. Please try again later.";
  }
  
  toast.error(errorMessage);
};

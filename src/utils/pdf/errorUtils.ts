
import { toast } from "sonner";

export const handlePdfError = (error: unknown): void => {
  console.error("Error accessing PDF:", error);
  
  if (error instanceof Error) {
    console.error("Error details:", error.message);
    
    if (error.message.includes('invalid source image') || error.message.includes('422')) {
      toast.error("PDF format error: The system couldn't process this file");
    } else if (error.message.includes('permission') || error.message.includes('403')) {
      toast.error("Permission denied: You may need to log in again to access this file");
    } else {
      toast.error(`PDF access error: ${error.message}`);
    }
  } else {
    toast.error("Failed to access PDF. Please ensure you're logged in.");
  }
  
  toast.info("If problems persist, try refreshing the page or logging out and back in");
};

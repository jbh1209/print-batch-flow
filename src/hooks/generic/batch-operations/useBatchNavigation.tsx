
import { useNavigate } from "react-router-dom";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { toast } from "sonner";

/**
 * Custom hook for batch navigation functionality
 * Provides methods to view PDFs and navigate to batch details
 */
export function useBatchNavigation(productType: string) {
  const navigate = useNavigate();

  /**
   * Handles viewing a PDF file
   * @param url - The URL of the PDF to view
   */
  const handleViewPDF = (url: string | null) => {
    if (!url) {
      toast.error('No PDF available to view');
      return;
    }
    handlePdfAction(url, 'view');
  };

  /**
   * Navigates to the batch details page
   * @param batchId - The ID of the batch to view
   */
  const handleViewBatchDetails = (batchId: string) => {
    // Format the product type for the URL (lowercase with dashes)
    const formattedProductType = productType.toLowerCase().replace(/ /g, '-');
    const path = `/batches/${formattedProductType}/batches/${batchId}`;
    console.log("Navigating to batch details:", path);
    navigate(path);
  };

  return { 
    handleViewPDF, 
    handleViewBatchDetails 
  };
}

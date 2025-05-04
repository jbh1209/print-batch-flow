
import { useNavigate } from "react-router-dom";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { toast } from "sonner";

export function useBatchNavigation(productType: string) {
  const navigate = useNavigate();

  const handleViewPDF = (url: string | null) => {
    if (!url) {
      toast.error('No PDF available to view');
      return;
    }
    handlePdfAction(url, 'view');
  };

  const handleViewBatchDetails = (batchId: string) => {
    // Make sure we're formatting the URL correctly for the router pattern
    const formattedProductType = productType.toLowerCase().replace(/ /g, '-');
    const path = `/batches/${formattedProductType}/batches/${batchId}`;
    console.log("Navigating to batch details:", path);
    navigate(path);
  };

  return { handleViewPDF, handleViewBatchDetails };
}

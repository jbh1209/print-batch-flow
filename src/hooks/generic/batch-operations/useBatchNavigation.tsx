
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
    const path = `/batches/${productType.toLowerCase().replace(' ', '-')}/batches/${batchId}`;
    console.log("Navigating to batch details:", path);
    navigate(path);
  };

  return { handleViewPDF, handleViewBatchDetails };
}

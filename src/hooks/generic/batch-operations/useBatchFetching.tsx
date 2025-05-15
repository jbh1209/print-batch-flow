import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { BaseBatch, ProductConfig } from "@/config/productTypes";
import { toast } from "sonner";
import { getProductTypeCode, extractProductCodeFromBatchName } from "@/utils/batch/productTypeCodes";
import { BatchStatus } from "@/config/types/baseTypes";

interface BatchFetchingOptions {
  filterByCurrentUser?: boolean;
  specificBatchId?: string | null;
}

export function useBatchFetching(config: ProductConfig, options: BatchFetchingOptions = {}) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BaseBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchBatches = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('batches')
        .select('*');

      if (options.filterByCurrentUser) {
        query = query.eq('created_by', user.id);
      }

      if (options.specificBatchId) {
        query = query.eq('id', options.specificBatchId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Process the batches based on product type
      const productBatches: BaseBatch[] = (data || [])
        .filter((batch) => {
          const productCode = extractProductCodeFromBatchName(batch.name);
          const expectedProductCode = getProductTypeCode(config.productType);
          return productCode === expectedProductCode;
        })
        .map((batch: any) => {
          return {
            id: batch.id,
            name: batch.name,
            status: batch.status as BatchStatus,
            sheets_required: batch.sheets_required || 0,
            front_pdf_url: batch.front_pdf_url,
            back_pdf_url: batch.back_pdf_url,
            overview_pdf_url: batch.overview_pdf_url || null,
            due_date: batch.due_date,
            created_at: batch.created_at,
            lamination_type: batch.lamination_type || "none",
            paper_type: batch.paper_type,
            paper_weight: batch.paper_weight,
            sheet_size: batch.sheet_size,
            printer_type: batch.printer_type,
            created_by: batch.created_by,
            updated_at: batch.updated_at,
            date_created: batch.date_created,
          };
        });

      setBatches(productBatches);

      if (options.specificBatchId && (!data || data.length === 0)) {
        toast.error("Batch not found or you don't have permission to view it.");
        navigate(`/${config.routes.batchesPath}`);
      }
    } catch (err: any) {
      console.error(`Error fetching ${config.productType} batches:`, err);
      setError(`Failed to load ${config.productType} batches: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [user, config.productType, options.filterByCurrentUser, options.specificBatchId]);

  return {
    batches,
    isLoading,
    error,
    fetchBatches,
  };
}

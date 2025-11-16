import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseJobPaperSpecsResult {
  isLoading: boolean;
  error: string | null;
  cover?: string;
  text?: string;
  generic?: string;
  sheetSize?: string;
}

/**
 * Hook to fetch paper specifications from production_jobs table.
 * The matrix parser stores normalized paper specs in paper_specifications JSONB field.
 * This works for all printing stages (HP12000, 7900, T250, large format).
 */
export const useJobPaperSpecs = (jobId: string): UseJobPaperSpecsResult => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobPaperSpecs", jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data: jobData, error: fetchError } = await supabase
        .from("production_jobs")
        .select("paper_specifications, printing_specifications")
        .eq("id", jobId)
        .single();

      if (fetchError) throw fetchError;
      return jobData;
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return { isLoading: true, error: null };
  }

  if (error) {
    return { isLoading: false, error: (error as Error).message };
  }

  if (!data) {
    return { isLoading: false, error: null };
  }

  // Extract normalized paper display
  const paperSpecs = data.paper_specifications as any;
  const printingSpecs = data.printing_specifications as any;

  let cover: string | undefined;
  let text: string | undefined;
  let generic: string | undefined;
  let sheetSize: string | undefined;

  // Helper to normalize any value to a display string
  const normalizeToString = (val: any): string | undefined => {
    if (!val) return undefined;
    if (typeof val === "string") return val.trim() || undefined;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (typeof val === "object" && !Array.isArray(val)) {
      // Flatten object values
      const parts = Object.values(val)
        .filter((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        .map(String)
        .filter(Boolean);
      return parts.length > 0 ? parts.join(" ") : undefined;
    }
    if (Array.isArray(val)) {
      const parts = val
        .filter((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        .map(String)
        .filter(Boolean);
      return parts.length > 0 ? parts.join(" ") : undefined;
    }
    return undefined;
  };

  // Extract paper specs by part (cover/text)
  if (paperSpecs) {
    // Look for parsed_paper field (normalized by matrix parser)
    if (paperSpecs.parsed_paper) {
      generic = normalizeToString(paperSpecs.parsed_paper);
    } else {
      // Fallback: flatten entire paper_specifications
      generic = normalizeToString(paperSpecs);
    }

    // Check for part-specific entries in printing_specifications
    if (printingSpecs && typeof printingSpecs === "object") {
      const keys = Object.keys(printingSpecs);
      
      // Find cover and text keys
      const coverKey = keys.find((k) => k.toLowerCase().includes("cover"));
      const textKey = keys.find((k) => k.toLowerCase().includes("text"));

      // If we have part-specific keys, try to match paper specs to them
      if (coverKey || textKey) {
        // For now, use generic for both parts
        // In future, could match by quantity if paper_specifications has part-specific entries
        cover = generic;
        text = generic;
      }
    }

    // Extract sheet size if present
    if (paperSpecs.sheet_size) {
      sheetSize = normalizeToString(paperSpecs.sheet_size);
    }
  }

  return {
    isLoading: false,
    error: null,
    cover,
    text,
    generic,
    sheetSize,
  };
};

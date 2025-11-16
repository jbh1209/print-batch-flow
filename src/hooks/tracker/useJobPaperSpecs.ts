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

  // Extract paper specs
  if (paperSpecs) {
    // Priority 1: Look for parsed_paper field (normalized by matrix parser)
    if (paperSpecs.parsed_paper && typeof paperSpecs.parsed_paper === "string") {
      generic = paperSpecs.parsed_paper.trim() || undefined;
    } 
    // Priority 2: Extract from object-of-objects structure (e.g., {"HI-Q Titan (Gloss), 350gsm, White, 640x915": {...}})
    else if (typeof paperSpecs === "object" && !Array.isArray(paperSpecs)) {
      const keys = Object.keys(paperSpecs);
      
      // Find key containing "gsm" (case-insensitive) or use first key
      const primaryKey = keys.find((k) => /gsm/i.test(k)) || keys[0];
      
      if (primaryKey) {
        // Try to extract description field if available
        const paperEntry = paperSpecs[primaryKey];
        if (paperEntry && typeof paperEntry === "object" && paperEntry.description && typeof paperEntry.description === "string") {
          generic = paperEntry.description.trim() || undefined;
        } else if (primaryKey.trim()) {
          // Use the key itself as the paper spec
          generic = primaryKey.trim();
        }

        // Extract sheet size from the string (e.g., 640x915)
        if (generic) {
          const sizeMatch = generic.match(/\b(\d{2,4})\s*x\s*(\d{2,4})(\s*mm)?\b/i);
          if (sizeMatch) {
            sheetSize = `${sizeMatch[1]}x${sizeMatch[2]}${sizeMatch[3] || ''}`;
          }
        }
      }

      // Debug log if extraction failed
      if (!generic) {
        console.debug('[useJobPaperSpecs] No paper could be derived', { jobId, keys });
      }
    }

    // Check for part-specific entries in printing_specifications
    if (generic && printingSpecs && typeof printingSpecs === "object") {
      const keys = Object.keys(printingSpecs);
      
      // Find cover and text keys
      const coverKey = keys.find((k) => k.toLowerCase().includes("cover"));
      const textKey = keys.find((k) => k.toLowerCase().includes("text"));

      // Assign generic paper spec to parts if they exist
      if (coverKey || textKey) {
        if (coverKey) cover = generic;
        if (textKey) text = generic;
      }
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

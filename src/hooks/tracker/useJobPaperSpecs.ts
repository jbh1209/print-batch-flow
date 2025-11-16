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

interface PaperMapping {
  key: string;
  formatted: string;
  paperType?: string;
  paperWeight?: string;
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

      // Step 1: Get job data
      const { data: jobData, error: fetchError } = await supabase
        .from("production_jobs")
        .select("paper_specifications, printing_specifications, finishing_specifications")
        .eq("id", jobId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!jobData) return null;

      const paperSpecs = jobData.paper_specifications as any;
      const printingSpecs = jobData.printing_specifications as any;
      const finishingSpecs = jobData.finishing_specifications as any;

      if (!paperSpecs || typeof paperSpecs !== "object" || Array.isArray(paperSpecs)) {
        return { papers: [], printingSpecs, finishingSpecs };
      }

      // Step 2: Get all paper keys
      const paperKeys = Object.keys(paperSpecs).filter(k => k && k.trim());
      
      if (paperKeys.length === 0) {
        return { papers: [], printingSpecs, finishingSpecs };
      }

      // Step 3: Look up mappings for each paper key
      const paperMappings = await Promise.all(
        paperKeys.map(async (paperKey): Promise<PaperMapping> => {
          // Query excel_import_mappings for this paper key
          const { data: mappings } = await supabase
            .from("excel_import_mappings")
            .select(`
              excel_text,
              paper_type:print_specifications!excel_import_mappings_paper_type_specification_id_fkey(display_name),
              paper_weight:print_specifications!excel_import_mappings_paper_weight_specification_id_fkey(display_name)
            `)
            .eq("excel_text", paperKey)
            .maybeSingle();

          // Extract sheet size from paper key
          const sizeMatch = paperKey.match(/\b(\d{2,4})\s*x\s*(\d{2,4})(?:\s*mm)?\b/i);
          const sheetSize = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : undefined;

          if (mappings?.paper_type?.display_name && mappings?.paper_weight?.display_name) {
            return {
              key: paperKey,
              paperType: mappings.paper_type.display_name,
              paperWeight: mappings.paper_weight.display_name,
              formatted: `${mappings.paper_type.display_name} ${mappings.paper_weight.display_name}`,
              sheetSize,
            };
          }

          // Fallback: extract from key itself
          const gsmMatch = paperKey.match(/(\d+)\s*gsm/i);
          const typeMatch = paperKey.match(/\((Gloss|Matt|Silk|Bond)\)/i);
          
          if (gsmMatch && typeMatch) {
            return {
              key: paperKey,
              paperType: typeMatch[1],
              paperWeight: `${gsmMatch[1]}gsm`,
              formatted: `${typeMatch[1]} ${gsmMatch[1]}gsm`,
              sheetSize,
            };
          }

          return {
            key: paperKey,
            formatted: paperKey,
            sheetSize,
          };
        })
      );

      return { 
        papers: paperMappings,
        printingSpecs,
        finishingSpecs
      };
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return { isLoading: true, error: null };
  }

  if (error) {
    return { isLoading: false, error: (error as Error).message };
  }

  if (!data || !data.papers || data.papers.length === 0) {
    return { isLoading: false, error: null };
  }

  const { papers, printingSpecs, finishingSpecs } = data;

  let cover: string | undefined;
  let text: string | undefined;
  let generic: string | undefined;
  let sheetSize: string | undefined;

  // Step 4: Match papers to parts (Cover/Text)
  if (printingSpecs && typeof printingSpecs === "object") {
    const keys = Object.keys(printingSpecs);
    const coverKey = keys.find((k) => k.toLowerCase().includes("cover"));
    const textKey = keys.find((k) => k.toLowerCase().includes("text"));

    if (coverKey && textKey && papers.length > 1) {
      // Multiple papers - need to match to parts
      
      // Strategy 1: Match by keywords in paper key (Gloss/Matt)
      // Check finishing specs for hints (e.g., "Matt film lamination" suggests Cover is Gloss)
      let finishingHint: string | undefined;
      if (finishingSpecs && typeof finishingSpecs === "object") {
        const finishingEntries = Object.entries(finishingSpecs);
        for (const [key, value] of finishingEntries) {
          if (typeof value === "string" && /matt.*lamination/i.test(value)) {
            finishingHint = "matt";
            break;
          } else if (typeof value === "string" && /gloss.*lamination/i.test(value)) {
            finishingHint = "gloss";
            break;
          }
        }
      }

      // Try to match by paper type keywords
      const glossPaper = papers.find(p => /gloss/i.test(p.key) || /gloss/i.test(p.paperType || ""));
      const mattPaper = papers.find(p => /matt/i.test(p.key) || /matt/i.test(p.paperType || ""));

      if (glossPaper && mattPaper) {
        // If we have finishing hint, assign accordingly
        if (finishingHint === "matt") {
          // Matt lamination on cover means cover is likely NOT matt paper
          cover = glossPaper.formatted;
          text = mattPaper.formatted;
          sheetSize = glossPaper.sheetSize || mattPaper.sheetSize;
        } else if (finishingHint === "gloss") {
          cover = mattPaper.formatted;
          text = glossPaper.formatted;
          sheetSize = mattPaper.sheetSize || glossPaper.sheetSize;
        } else {
          // No hint - try to match by sheet size or default assignment
          // Typically larger sheet = cover
          const sizes = papers.map(p => {
            const match = p.sheetSize?.match(/(\d+)x(\d+)/);
            if (match) {
              return { paper: p, area: parseInt(match[1]) * parseInt(match[2]) };
            }
            return { paper: p, area: 0 };
          }).sort((a, b) => b.area - a.area);
          
          if (sizes[0].area > 0 && sizes[1].area > 0 && sizes[0].area !== sizes[1].area) {
            cover = sizes[0].paper.formatted;
            text = sizes[1].paper.formatted;
            sheetSize = sizes[0].paper.sheetSize;
          } else {
            // Default: assign by order
            cover = glossPaper.formatted;
            text = mattPaper.formatted;
            sheetSize = glossPaper.sheetSize || mattPaper.sheetSize;
          }
        }
      } else {
        // Can't distinguish - assign generically
        generic = papers[0].formatted;
        sheetSize = papers[0].sheetSize;
      }
    } else if ((coverKey || textKey) && papers.length === 1) {
      // Single paper - assign to both parts
      const paper = papers[0];
      if (coverKey) cover = paper.formatted;
      if (textKey) text = paper.formatted;
      sheetSize = paper.sheetSize;
    } else if (papers.length === 1) {
      // No part keys but we have paper
      generic = papers[0].formatted;
      sheetSize = papers[0].sheetSize;
    }
  } else {
    // No printing specs - use first paper as generic
    generic = papers[0].formatted;
    sheetSize = papers[0].sheetSize;
  }

  // Debug log if we couldn't match papers properly
  if (!cover && !text && !generic && papers.length > 0) {
    console.debug('[useJobPaperSpecs] Could not match papers to parts', { 
      jobId, 
      paperCount: papers.length,
      hasPrintingSpecs: !!printingSpecs 
    });
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

// Utility functions to parse paper specifications from notes text

export interface ParsedPaperSpecs {
  paperType?: string;
  paperWeight?: string;
  fullPaperSpec?: string;
}

export const parsePaperSpecsFromNotes = (notes?: string): ParsedPaperSpecs => {
  if (!notes) return {};

  // Look for patterns like "Paper: Gloss 300gsm", "Paper: Bond 080gsm", etc.
  const paperPattern = /Paper:\s*([^,\n]+)/i;
  const match = notes.match(paperPattern);
  
  if (!match) return {};

  const fullPaperSpec = match[1].trim();
  
  // Try to split into type and weight
  // Common patterns: "Gloss 300gsm", "Bond 080gsm", "Uncoated 120gsm"
  const typeWeightPattern = /^(.+?)\s+(\d+gsm)$/i;
  const typeWeightMatch = fullPaperSpec.match(typeWeightPattern);
  
  if (typeWeightMatch) {
    return {
      paperType: typeWeightMatch[1].trim(),
      paperWeight: typeWeightMatch[2],
      fullPaperSpec
    };
  }
  
  // If we can't split, return the whole thing as paper type
  return {
    paperType: fullPaperSpec,
    fullPaperSpec
  };
};

export const formatPaperDisplay = (parsedSpecs: ParsedPaperSpecs): string | undefined => {
  if (!parsedSpecs.fullPaperSpec) return undefined;
  
  if (parsedSpecs.paperWeight && parsedSpecs.paperType) {
    return `${parsedSpecs.paperWeight} ${parsedSpecs.paperType}`;
  }
  
  return parsedSpecs.fullPaperSpec;
};
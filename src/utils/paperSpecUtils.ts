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

// --- New: extract paper display directly from specification_details (matrix parser output) ---
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toSimpleTextUtil = (val: unknown): string => {
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (Array.isArray(val)) {
    return val.map(toSimpleTextUtil).filter(Boolean).join(' ');
  }
  if (isRecord(val)) {
    return Object.values(val)
      .filter(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(String)
      .join(' ');
  }
  return '';
};

const combineWeightType = (weight?: string, type?: string): string | undefined => {
  if (weight && type) return `${weight} ${type}`;
  return undefined;
};

export const extractPaperDisplayFromSpecDetails = (details: unknown): string | undefined => {
  if (!details) return undefined;

  if (typeof details === 'string') {
    const t = details.trim();
    return t ? t : undefined;
  }

  if (isRecord(details)) {
    // 1) Direct string field
    const direct = (details['paper_specification'] as unknown) ?? (details['paperSpecification'] as unknown);
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    // 2) Combine weight + type
    const weight = (details['paper_weight'] as unknown) ?? (details['paperWeight'] as unknown);
    const type = (details['paper_type'] as unknown) ?? (details['paperType'] as unknown);
    if (typeof weight === 'string' && typeof type === 'string') {
      const c = combineWeightType(weight, type);
      if (c) return c;
    }

    // 3) Nested paper object
    const paper = details['paper'];
    if (isRecord(paper)) {
      const ps = paper['specification'];
      if (typeof ps === 'string' && ps.trim()) return ps.trim();
      const w2 = paper['weight'];
      const t2 = paper['type'];
      if (typeof w2 === 'string' && typeof t2 === 'string') {
        const c2 = combineWeightType(w2, t2);
        if (c2) return c2;
      }
    }

    // 4) Generic flatten
    const flat = toSimpleTextUtil(details);
    return flat || undefined;
  }

  if (Array.isArray(details)) {
    const flat = details.map(toSimpleTextUtil).filter(Boolean).join(' ');
    return flat || undefined;
  }

  return undefined;
};
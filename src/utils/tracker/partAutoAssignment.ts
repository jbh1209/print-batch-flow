/**
 * Part Auto-Assignment Utility
 * 
 * Handles automatic assignment of parts to stages based on common workflow patterns.
 * Rules:
 * - UV Varnishing → Cover (if both cover & text exist)
 * - Laminating → Cover (if both cover & text exist)
 * - Hunkeler → Text (if both cover & text exist)
 */

interface MultiPartStage {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  part_types: string[];
}

interface AutoAssignmentRule {
  stagePatterns: string[];
  preferredPart: string;
  description: string;
}

const AUTO_ASSIGNMENT_RULES: Record<string, AutoAssignmentRule> = {
  uv_varnish: {
    stagePatterns: ['uv', 'varnish'],
    preferredPart: 'cover',
    description: 'UV Varnishing'
  },
  laminating: {
    stagePatterns: ['laminat'],
    preferredPart: 'cover',
    description: 'Laminating'
  },
  hunkeler: {
    stagePatterns: ['hunkeler'],
    preferredPart: 'text',
    description: 'Hunkeler'
  }
};

/**
 * Normalizes text for pattern matching - lowercase, remove extra spaces
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Checks if a stage name matches any pattern in the rule
 */
function matchesStagePattern(stageName: string, patterns: string[]): boolean {
  const normalized = normalizeText(stageName);
  return patterns.some(pattern => normalized.includes(pattern));
}

/**
 * Finds the part name (case-insensitive) from available parts
 */
function findPartByName(parts: string[], targetPart: string): string | null {
  return parts.find(part => normalizeText(part) === normalizeText(targetPart)) || null;
}

/**
 * Checks if a stage supports a specific part type
 */
function stageSupportsPartType(stage: MultiPartStage, partName: string): boolean {
  return stage.part_types.some(type => normalizeText(type) === normalizeText(partName));
}

/**
 * Automatically assigns parts to stages based on common workflow patterns
 * 
 * @param availableParts - Array of available part names (e.g., ['cover', 'text'])
 * @param multiPartStages - Array of stages that support parts
 * @returns Partial record of part assignments (part_name -> stage_id)
 */
export function autoAssignParts(
  availableParts: string[],
  multiPartStages: MultiPartStage[]
): Record<string, string> {
  const assignments: Record<string, string> = {};
  
  // Only auto-assign if both cover and text exist
  const coverPart = findPartByName(availableParts, 'cover');
  const textPart = findPartByName(availableParts, 'text');
  
  if (!coverPart || !textPart) {
    console.log('🔍 Auto-assignment skipped: Both cover and text must exist', {
      availableParts,
      foundCover: !!coverPart,
      foundText: !!textPart
    });
    return assignments;
  }
  
  console.log('🎯 Auto-assignment conditions met:', {
    coverPart,
    textPart,
    stages: multiPartStages.length
  });
  
  // Process each stage and check against rules
  for (const stage of multiPartStages) {
    for (const [ruleKey, rule] of Object.entries(AUTO_ASSIGNMENT_RULES)) {
      if (matchesStagePattern(stage.stage_name, rule.stagePatterns)) {
        const targetPart = rule.preferredPart === 'cover' ? coverPart : textPart;
        
        // Verify the stage actually supports this part type
        if (stageSupportsPartType(stage, targetPart)) {
          assignments[targetPart] = stage.stage_id;
          console.log(`✅ Auto-assigned: ${targetPart} → ${stage.stage_name} (${rule.description})`);
        } else {
          console.warn(`⚠️ Cannot auto-assign ${targetPart} to ${stage.stage_name}: part type not supported`);
        }
        
        break; // Only match one rule per stage
      }
    }
  }
  
  if (Object.keys(assignments).length > 0) {
    console.log('🎉 Auto-assignment complete:', assignments);
  } else {
    console.log('ℹ️ No auto-assignments made');
  }
  
  return assignments;
}

/**
 * Gets a list of parts that were auto-assigned
 */
export function getAutoAssignedParts(partAssignments: Record<string, string>): string[] {
  // This is a simple implementation - in practice, we track which were auto-assigned
  // For now, we'll just return an empty array and enhance later if needed
  return [];
}

/**
 * Determines which component (cover/text) should handle a given stage
 * Used during Excel import workflow creation
 */
export function determineComponentForStage(
  stageName: string,
  hasCoverAndText: boolean
): 'cover' | 'text' | 'both' | null {
  if (!hasCoverAndText) {
    return 'both'; // If only one component, it handles all stages
  }
  
  // Check each rule to see if this stage matches
  for (const rule of Object.values(AUTO_ASSIGNMENT_RULES)) {
    if (matchesStagePattern(stageName, rule.stagePatterns)) {
      return rule.preferredPart as 'cover' | 'text';
    }
  }
  
  // If no rule matches, both components should get this stage
  return 'both';
}

/**
 * Enhanced Stage System Types and Utilities
 * Provides backward-compatible extensions to the production stage system
 */

import type { ProductionStage } from "./useProductionStages";
import type { JobStageInstance } from "./useJobStageInstances";
import type { StageSpecification } from "./useStageSpecifications";

// Enhanced production stage with timing data
export interface EnhancedProductionStage extends ProductionStage {
  running_speed_per_hour?: number;
  make_ready_time_minutes?: number;
  speed_unit?: 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item';
  specifications?: StageSpecification[];
}

// Enhanced job stage instance with full timing support
export interface EnhancedJobStageInstance extends JobStageInstance {
  stage_specification_id?: string | null;
  quantity?: number | null;
  estimated_duration_minutes?: number | null;
  actual_duration_minutes?: number | null;
  setup_time_minutes?: number | null;
  stage_specification?: StageSpecification | null;
}

// Timing calculation context
export interface TimingContext {
  stage: EnhancedProductionStage;
  specification?: StageSpecification;
  quantity: number;
  useSpecificationOverride?: boolean;
}

// Helper functions for backward compatibility
export const stagingHelpers = {
  // Check if a stage has timing data
  hasTimingData: (stage: ProductionStage): stage is EnhancedProductionStage => {
    return 'running_speed_per_hour' in stage && stage.running_speed_per_hour !== undefined;
  },

  // Check if a job stage instance has timing data
  hasJobTimingData: (jobStage: JobStageInstance): jobStage is EnhancedJobStageInstance => {
    return 'quantity' in jobStage && jobStage.quantity !== undefined;
  },

  // Get effective timing data (specification overrides stage)
  getEffectiveTimingData: (stage: EnhancedProductionStage, specification?: StageSpecification) => {
    return {
      running_speed_per_hour: specification?.running_speed_per_hour || stage.running_speed_per_hour,
      make_ready_time_minutes: specification?.make_ready_time_minutes || stage.make_ready_time_minutes || 10,
      speed_unit: specification?.speed_unit || stage.speed_unit || 'sheets_per_hour',
      source: specification?.running_speed_per_hour ? 'specification' : 'stage'
    };
  },

  // Format timing display
  formatDuration: (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  },

  // Format speed display
  formatSpeed: (speed: number, unit: string): string => {
    switch (unit) {
      case 'sheets_per_hour':
        return `${speed} sheets/hr`;
      case 'items_per_hour':
        return `${speed} items/hr`;
      case 'minutes_per_item':
        return `${speed} min/item`;
      default:
        return `${speed} ${unit}`;
    }
  },

  // Calculate progress percentage
  calculateProgress: (actual: number, estimated: number): number => {
    if (estimated === 0) return 0;
    return Math.min(100, Math.round((actual / estimated) * 100));
  },

  // Determine if timing is accurate (within 20% of estimate)
  isTimingAccurate: (actual: number, estimated: number): boolean => {
    if (estimated === 0) return false;
    const variance = Math.abs(actual - estimated) / estimated;
    return variance <= 0.2; // Within 20%
  },

  // Get timing status for display
  getTimingStatus: (jobStage: EnhancedJobStageInstance): 'not-started' | 'in-progress' | 'completed' | 'overdue' => {
    if (!jobStage.started_at) return 'not-started';
    if (jobStage.status === 'completed') return 'completed';
    
    if (jobStage.estimated_duration_minutes && jobStage.started_at) {
      const startTime = new Date(jobStage.started_at);
      const estimatedEnd = new Date(startTime.getTime() + (jobStage.estimated_duration_minutes * 60000));
      const now = new Date();
      
      if (now > estimatedEnd) return 'overdue';
    }
    
    return 'in-progress';
  }
};

// Export utility functions for common operations
export const timingUtils = {
  // Convert hours to minutes
  hoursToMinutes: (hours: number): number => hours * 60,

  // Convert minutes to hours
  minutesToHours: (minutes: number): number => minutes / 60,

  // Calculate estimated completion time
  getEstimatedCompletionTime: (
    startTime: Date,
    estimatedDurationMinutes: number
  ): Date => {
    return new Date(startTime.getTime() + (estimatedDurationMinutes * 60000));
  },

  // Calculate remaining time
  getRemainingTime: (
    startTime: Date,
    estimatedDurationMinutes: number
  ): number => {
    const now = new Date();
    const estimatedEnd = new Date(startTime.getTime() + (estimatedDurationMinutes * 60000));
    return Math.max(0, estimatedEnd.getTime() - now.getTime()) / 60000; // in minutes
  },

  // Calculate overtime
  getOvertime: (
    startTime: Date,
    estimatedDurationMinutes: number
  ): number => {
    const now = new Date();
    const estimatedEnd = new Date(startTime.getTime() + (estimatedDurationMinutes * 60000));
    return Math.max(0, now.getTime() - estimatedEnd.getTime()) / 60000; // in minutes
  }
};

// Excel import mapping types
export interface ExcelImportMapping {
  id: string;
  excel_text: string;
  production_stage_id: string;
  stage_specification_id?: string | null;
  confidence_score: number;
  is_verified: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Excel import utilities
export const excelUtils = {
  // Normalize Excel text for matching
  normalizeExcelText: (text: string): string => {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  },

  // Extract key components from Excel text
  extractComponents: (text: string): {
    machine?: string;
    size?: string;
    colors?: string;
    sides?: string;
    material?: string;
  } => {
    const normalized = excelUtils.normalizeExcelText(text);
    const components: any = {};

    // Extract machine (HP, Konica, etc.)
    const machineMatch = normalized.match(/(hp|konica|xerox|canon)\s*\d+/);
    if (machineMatch) components.machine = machineMatch[0];

    // Extract size (A4, B2, etc.)
    const sizeMatch = normalized.match(/\b([ab]\d+|sra\d+|\d+x\d+)\b/);
    if (sizeMatch) components.size = sizeMatch[1];

    // Extract colors
    const colorMatch = normalized.match(/(\d+)\s*process\s*colou?rs?/);
    if (colorMatch) components.colors = colorMatch[1];

    // Extract sides
    const sidesMatch = normalized.match(/(one|two|single|double)\s*side/);
    if (sidesMatch) components.sides = sidesMatch[1];

    return components;
  }
};

// Type guards for enhanced types
export const typeGuards = {
  isEnhancedProductionStage: (stage: ProductionStage): stage is EnhancedProductionStage => {
    return stagingHelpers.hasTimingData(stage);
  },

  isEnhancedJobStageInstance: (jobStage: JobStageInstance): jobStage is EnhancedJobStageInstance => {
    return stagingHelpers.hasJobTimingData(jobStage);
  },

  hasStageSpecification: (jobStage: JobStageInstance): jobStage is EnhancedJobStageInstance => {
    return 'stage_specification_id' in jobStage && jobStage.stage_specification_id !== null;
  }
};
/**
 * Phase 1: Universal Null Safety Infrastructure
 * Bulletproof utilities for safe object operations in Excel import
 */

export class SafeObjectUtils {
  /**
   * Safe Object.entries wrapper that handles null/undefined objects
   */
  static safeEntries<T>(obj: Record<string, T> | null | undefined): [string, T][] {
    if (!obj || typeof obj !== 'object') {
      return [];
    }
    
    try {
      return Object.entries(obj);
    } catch (error) {
      console.error('SafeObjectUtils.safeEntries error:', error);
      return [];
    }
  }

  /**
   * Safe Object.keys wrapper
   */
  static safeKeys(obj: Record<string, any> | null | undefined): string[] {
    if (!obj || typeof obj !== 'object') {
      return [];
    }
    
    try {
      return Object.keys(obj);
    } catch (error) {
      console.error('SafeObjectUtils.safeKeys error:', error);
      return [];
    }
  }

  /**
   * Safe property access with fallback
   */
  static safeGet<T>(obj: any, path: string, fallback: T): T {
    if (!obj || typeof obj !== 'object') {
      return fallback;
    }

    try {
      const keys = path.split('.');
      let current = obj;
      
      for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
          return fallback;
        }
        current = current[key];
      }
      
      return current !== undefined ? current : fallback;
    } catch (error) {
      console.error('SafeObjectUtils.safeGet error:', error);
      return fallback;
    }
  }

  /**
   * Safe array access
   */
  static safeArray<T>(arr: T[] | null | undefined): T[] {
    return Array.isArray(arr) ? arr : [];
  }

  /**
   * Safe string conversion
   */
  static safeString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  /**
   * Safe number conversion
   */
  static safeNumber(value: any, fallback: number = 0): number {
    if (value === null || value === undefined) {
      return fallback;
    }
    
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  /**
   * Validate object structure
   */
  static validateStructure(obj: any, requiredFields: string[]): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    try {
      return requiredFields.every(field => obj.hasOwnProperty(field));
    } catch (error) {
      console.error('SafeObjectUtils.validateStructure error:', error);
      return false;
    }
  }

  /**
   * Deep clone with null safety
   */
  static safeClone<T>(obj: T): T | null {
    if (obj === null || obj === undefined) {
      return null;
    }

    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      console.error('SafeObjectUtils.safeClone error:', error);
      return null;
    }
  }

  /**
   * Merge objects safely
   */
  static safeMerge<T>(target: T, source: Partial<T>): T {
    if (!target || typeof target !== 'object') {
      return target;
    }

    if (!source || typeof source !== 'object') {
      return target;
    }

    try {
      return { ...target, ...source };
    } catch (error) {
      console.error('SafeObjectUtils.safeMerge error:', error);
      return target;
    }
  }
}

/**
 * Data structure validators for Excel processing
 */
export class ExcelDataValidator {
  static validateJobData(job: any): boolean {
    const requiredFields = ['wo_no'];
    return SafeObjectUtils.validateStructure(job, requiredFields);
  }

  static validateStageInstance(instance: any): boolean {
    const requiredFields = ['stageId', 'stageName', 'category'];
    return SafeObjectUtils.validateStructure(instance, requiredFields);
  }

  static validateSpecifications(specs: any): boolean {
    if (!specs || typeof specs !== 'object') {
      return false;
    }
    
    // Ensure it's a proper GroupSpecifications object
    return Object.values(specs).every(spec => 
      spec && typeof spec === 'object'
    );
  }

  static validateRowMapping(mapping: any): boolean {
    const requiredFields = ['excelRowIndex', 'groupName', 'category'];
    return SafeObjectUtils.validateStructure(mapping, requiredFields);
  }
}

/**
 * Error boundaries for Excel processing
 */
export class ExcelErrorHandler {
  static withErrorBoundary<T>(
    operation: () => T,
    fallback: T,
    context: string = 'Unknown operation'
  ): T {
    try {
      return operation();
    } catch (error) {
      console.error(`ExcelErrorHandler: ${context}`, error);
      return fallback;
    }
  }

  static async withAsyncErrorBoundary<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: string = 'Unknown async operation'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`ExcelErrorHandler: ${context}`, error);
      return fallback;
    }
  }

  static createSafeFunction<T extends any[], R>(
    fn: (...args: T) => R,
    fallback: R,
    context: string = 'Safe function'
  ): (...args: T) => R {
    return (...args: T) => {
      return this.withErrorBoundary(() => fn(...args), fallback, context);
    };
  }
}
interface DebugEntry {
  timestamp: string;
  component: string;
  action: string;
  data: any;
}

class DebugService {
  private entries: DebugEntry[] = [];
  private maxEntries = 100;

  log(component: string, action: string, data: any): void {
    const entry: DebugEntry = {
      timestamp: new Date().toISOString(),
      component,
      action,
      data
    };

    this.entries.unshift(entry);
    
    // Keep only recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    // Console log for development
    console.log(`🔍 [${component}] ${action}:`, data);
  }

  getEntries(component?: string): DebugEntry[] {
    if (component) {
      return this.entries.filter(entry => entry.component === component);
    }
    return this.entries;
  }

  logSpecificationFetch(jobId: string, source: 'unified' | 'legacy' | 'normalized', result: any): void {
    this.log('SpecificationService', `fetch_${source}`, {
      jobId,
      hasData: !!result,
      paperDisplay: result?.paperDisplay || 'none',
      specsCount: result?.specifications?.length || 0
    });
  }

  logParallelStageTransition(jobId: string, fromStage: string, toStages: string[]): void {
    this.log('ParallelStages', 'stage_transition', {
      jobId,
      fromStage,
      toStages,
      timestamp: new Date().toISOString()
    });
  }

  logQtyDisplay(component: string, jobId: string, displayedQty: number, sourceField: string): void {
    this.log('QtyDisplay', 'qty_shown', {
      component,
      jobId,
      displayedQty,
      sourceField
    });
  }

  clear(): void {
    this.entries = [];
    console.log('🗑️ Debug log cleared');
  }
}

export const debugService = new DebugService();

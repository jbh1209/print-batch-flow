
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class ExcelImportDebugger {
  private debugInfo: string[] = [];
  private logLevel: LogLevel = LogLevel.ERROR; // Only show errors during upload
  private consoleEnabled: boolean = false; // Disable console during production uploads
  private batchedMessages: string[] = [];

  constructor(verbose: boolean = false) {
    // Only enable verbose logging if explicitly requested
    if (verbose) {
      this.logLevel = LogLevel.DEBUG;
      this.consoleEnabled = true;
    }
  }

  addDebugInfo(message: string, level: LogLevel = LogLevel.DEBUG) {
    this.debugInfo.push(message);
    
    // Only log errors and critical warnings to console during upload
    if (this.consoleEnabled && level <= this.logLevel) {
      const prefix = this.getLogPrefix(level);
      console.log(prefix, message);
    } else if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      // Batch important messages for later summary
      this.batchedMessages.push(`${this.getLogPrefix(level)} ${message}`);
    }
  }

  addError(message: string) {
    this.addDebugInfo(message, LogLevel.ERROR);
  }

  addWarning(message: string) {
    this.addDebugInfo(message, LogLevel.WARN);
  }

  addInfo(message: string) {
    this.addDebugInfo(message, LogLevel.INFO);
  }

  addSummary(operation: string, count: number, duration?: number) {
    const durationText = duration ? ` (${duration}ms)` : '';
    const message = `✅ ${operation}: ${count} items processed${durationText}`;
    this.addInfo(message);
    
    // Always show summaries in console
    console.log("[Excel Import] ℹ️", message);
  }
  
  flushBatchedMessages() {
    if (this.batchedMessages.length > 0) {
      console.log("[Excel Import] 📋 Summary of important messages:");
      this.batchedMessages.forEach(msg => console.log(msg));
      this.batchedMessages = [];
    }
  }

  private getLogPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return "[Excel Import] ❌";
      case LogLevel.WARN: return "[Excel Import] ⚠️";
      case LogLevel.INFO: return "[Excel Import] ℹ️";
      case LogLevel.DEBUG: return "[Excel Import] 🔍";
      default: return "[Excel Import]";
    }
  }

  getDebugInfo(): string[] {
    return [...this.debugInfo];
  }

  clear() {
    this.debugInfo = [];
    this.batchedMessages = [];
  }

  setVerbose(verbose: boolean) {
    this.logLevel = verbose ? LogLevel.DEBUG : LogLevel.WARN;
    this.consoleEnabled = verbose || process.env.NODE_ENV === 'development';
  }
}

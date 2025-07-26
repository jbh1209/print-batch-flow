
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class ExcelImportDebugger {
  private debugInfo: string[] = [];
  private logLevel: LogLevel = LogLevel.WARN; // Only show warnings and errors by default
  private consoleEnabled: boolean = process.env.NODE_ENV === 'development';

  constructor(verbose: boolean = false) {
    if (verbose) {
      this.logLevel = LogLevel.DEBUG;
      this.consoleEnabled = true;
    }
  }

  addDebugInfo(message: string, level: LogLevel = LogLevel.DEBUG) {
    this.debugInfo.push(message);
    
    if (this.consoleEnabled && level <= this.logLevel) {
      const prefix = this.getLogPrefix(level);
      console.log(prefix, message);
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
    this.addInfo(`✅ ${operation}: ${count} items processed${durationText}`);
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
  }

  setVerbose(verbose: boolean) {
    this.logLevel = verbose ? LogLevel.DEBUG : LogLevel.WARN;
    this.consoleEnabled = verbose || process.env.NODE_ENV === 'development';
  }
}

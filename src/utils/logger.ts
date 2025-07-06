type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
}

class Logger {
  private config: LoggerConfig;
  private levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };

  constructor() {
    const isDevelopment = import.meta.env.DEV;
    this.config = {
      level: isDevelopment ? 'debug' : 'error',
      enableConsole: true
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] <= this.levels[this.config.level];
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog('error') && this.config.enableConsole) {
      console.error(`❌ ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn') && this.config.enableConsole) {
      console.warn(`⚠️ ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info') && this.config.enableConsole) {
      console.info(`ℹ️ ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug') && this.config.enableConsole) {
      console.log(`🔧 ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
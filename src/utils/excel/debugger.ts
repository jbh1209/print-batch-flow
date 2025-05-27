
export class ExcelImportDebugger {
  private debugInfo: string[] = [];

  addDebugInfo(message: string) {
    this.debugInfo.push(message);
    console.log("[Excel Import]", message);
  }

  getDebugInfo(): string[] {
    return [...this.debugInfo];
  }

  clear() {
    this.debugInfo = [];
  }
}


import type { AccessibleJob, UseAccessibleJobsOptions } from './types';

interface PendingRequest {
  promise: Promise<AccessibleJob[]>;
  timestamp: number;
}

interface RequestKey {
  userId: string;
  permissionType: string;
  statusFilter: string | null;
  stageFilter: string | null;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly REQUEST_TIMEOUT = 30 * 1000; // 30 seconds

  private getRequestKey(key: RequestKey): string {
    return `${key.userId}_${key.permissionType}_${key.statusFilter || 'null'}_${key.stageFilter || 'null'}`;
  }

  async deduplicate<T>(
    key: RequestKey,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const requestKey = this.getRequestKey(key);
    const existing = this.pendingRequests.get(requestKey);
    
    // Check if we have a pending request that's not too old
    if (existing) {
      const age = Date.now() - existing.timestamp;
      if (age < this.REQUEST_TIMEOUT) {
        console.log('🔄 Deduplicating request for key:', requestKey);
        return existing.promise as Promise<T>;
      } else {
        // Remove stale request
        this.pendingRequests.delete(requestKey);
      }
    }

    // Create new request
    console.log('🚀 Creating new request for key:', requestKey);
    const promise = requestFn();
    
    this.pendingRequests.set(requestKey, {
      promise: promise as Promise<AccessibleJob[]>,
      timestamp: Date.now()
    });

    // Clean up when request completes
    promise
      .finally(() => {
        this.pendingRequests.delete(requestKey);
      })
      .catch(() => {
        // Error handling is done by the caller
      });

    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }

  getStats() {
    const now = Date.now();
    const requests = Array.from(this.pendingRequests.values());
    
    return {
      totalPending: this.pendingRequests.size,
      staleRequests: requests.filter(r => (now - r.timestamp) > this.REQUEST_TIMEOUT).length
    };
  }
}

// Global deduplicator instance
export const requestDeduplicator = new RequestDeduplicator();

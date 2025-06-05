
import type { AccessibleJob } from './types';

interface CacheEntry {
  data: AccessibleJob[];
  timestamp: number;
  isStale: boolean;
}

interface CacheKey {
  userId: string;
  permissionType: string;
  statusFilter: string | null;
  stageFilter: string | null;
}

class AccessibleJobsCacheManager {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_TIME = 30 * 1000; // 30 seconds

  private getCacheKey(key: CacheKey): string {
    return `${key.userId}_${key.permissionType}_${key.statusFilter || 'null'}_${key.stageFilter || 'null'}`;
  }

  get(key: CacheKey): AccessibleJob[] | null {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return null;
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    // If data is too old, remove it
    if (age > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    // Mark as stale if needed
    if (age > this.STALE_TIME && !entry.isStale) {
      entry.isStale = true;
    }
    
    return entry.data;
  }

  set(key: CacheKey, data: AccessibleJob[]): void {
    const cacheKey = this.getCacheKey(key);
    this.cache.set(cacheKey, {
      data: [...data], // Create a copy to prevent mutations
      timestamp: Date.now(),
      isStale: false
    });
  }

  isStale(key: CacheKey): boolean {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);
    return entry?.isStale ?? true;
  }

  invalidate(userId?: string): void {
    if (userId) {
      // Invalidate all entries for a specific user
      for (const [key] of this.cache) {
        if (key.startsWith(`${userId}_`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate all entries
      this.cache.clear();
    }
  }

  invalidateByPattern(pattern: Partial<CacheKey>): void {
    for (const [key, entry] of this.cache) {
      const [userId, permissionType, statusFilter, stageFilter] = key.split('_');
      
      const matches = (
        (!pattern.userId || userId === pattern.userId) &&
        (!pattern.permissionType || permissionType === pattern.permissionType) &&
        (!pattern.statusFilter || statusFilter === (pattern.statusFilter || 'null')) &&
        (!pattern.stageFilter || stageFilter === (pattern.stageFilter || 'null'))
      );
      
      if (matches) {
        entry.isStale = true;
      }
    }
  }

  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      totalEntries: this.cache.size,
      freshEntries: entries.filter(e => !e.isStale && (now - e.timestamp) <= this.STALE_TIME).length,
      staleEntries: entries.filter(e => e.isStale).length,
      expiredEntries: entries.filter(e => (now - e.timestamp) > this.CACHE_TTL).length
    };
  }
}

// Global cache instance
export const jobsCache = new AccessibleJobsCacheManager();

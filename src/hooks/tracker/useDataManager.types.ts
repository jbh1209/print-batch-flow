
export interface CachedData {
  data: any[];
  timestamp: number;
  isStale: boolean;
}

export interface DataManagerState {
  jobs: any[];
  stages: any[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

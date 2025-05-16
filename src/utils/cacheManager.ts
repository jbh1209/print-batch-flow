
import { QueryClient } from '@tanstack/react-query';

/**
 * Utility for managing React Query cache in the application
 */
export const CacheManager = {
  /**
   * Clear all React Query cache
   */
  clearAllCache: (queryClient: QueryClient) => {
    queryClient.clear();
    console.log('All query cache cleared');
    return true;
  },
  
  /**
   * Clear specific query key cache
   */
  clearCache: (queryClient: QueryClient, queryKey: string[]) => {
    queryClient.removeQueries({ queryKey });
    console.log(`Cache cleared for: ${queryKey.join('.')}`);
    return true;
  },
  
  /**
   * Invalidate and refetch specific query
   */
  invalidateAndRefetch: async (queryClient: QueryClient, queryKey: string[]) => {
    await queryClient.invalidateQueries({ queryKey });
    console.log(`Cache invalidated for: ${queryKey.join('.')}`);
    return true;
  },
  
  /**
   * Get cache status information for a query
   */
  getCacheStatus: (queryClient: QueryClient, queryKey: string[]) => {
    const queryState = queryClient.getQueryState(queryKey);
    
    return {
      isStale: queryState?.isStale || false,
      isFetching: queryState?.fetchStatus === 'fetching',
      dataUpdatedAt: queryState?.dataUpdatedAt ? new Date(queryState.dataUpdatedAt).toISOString() : null,
      status: queryState?.status || 'unknown',
      error: queryState?.error ? String(queryState.error) : null,
      fetchStatus: queryState?.fetchStatus || 'idle'
    };
  }
};

/**
 * Hook for using the cache manager
 */
export const useCacheManager = (queryClient: QueryClient) => {
  return {
    /**
     * Clear all cache
     */
    clearAllCache: () => CacheManager.clearAllCache(queryClient),
    
    /**
     * Clear specific query key cache
     */
    clearCache: (queryKey: string[]) => CacheManager.clearCache(queryClient, queryKey),
    
    /**
     * Invalidate and refetch specific query
     */
    invalidateAndRefetch: (queryKey: string[]) => CacheManager.invalidateAndRefetch(queryClient, queryKey),
    
    /**
     * Get cache status information
     */
    getCacheStatus: (queryKey: string[]) => CacheManager.getCacheStatus(queryClient, queryKey)
  };
};

export default CacheManager;

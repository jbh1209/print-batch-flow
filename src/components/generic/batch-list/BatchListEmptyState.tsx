
import React from 'react';

interface BatchListEmptyStateProps {
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export const BatchListEmptyState: React.FC<BatchListEmptyStateProps> = ({ 
  isLoading, 
  error, 
  onRetry 
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <p>Loading batches...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
        <p>Error: {error}</p>
        {onRetry && (
          <button 
            onClick={onRetry}
            className="mt-2 bg-white border border-red-500 text-red-500 px-3 py-1 rounded hover:bg-red-50"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className="text-center py-8 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-medium">No batches found</h3>
      <p className="text-gray-500 mt-2">Create a batch from the jobs page to get started.</p>
    </div>
  );
};

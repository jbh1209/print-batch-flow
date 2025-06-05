
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Search, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobListLoadingProps {
  message?: string;
  showProgress?: boolean;
}

export const JobListLoading: React.FC<JobListLoadingProps> = ({
  message = "Loading jobs...",
  showProgress = false
}) => {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin mr-3" />
        <div className="text-center">
          <p className="text-lg font-medium">{message}</p>
          {showProgress && (
            <div className="mt-2 w-48 bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface JobErrorStateProps {
  error: any;
  onRetry?: () => void;
  onRefresh?: () => void;
  title?: string;
  showDetails?: boolean;
}

export const JobErrorState: React.FC<JobErrorStateProps> = ({
  error,
  onRetry,
  onRefresh,
  title = "Error Loading Jobs",
  showDetails = false
}) => {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'An unexpected error occurred';

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">{title}</h3>
            <p className="text-red-700 mb-4">{errorMessage}</p>
            
            {showDetails && error?.stack && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
                  Show technical details
                </summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                  {error.stack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-2">
              {onRetry && (
                <Button onClick={onRetry} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              {onRefresh && (
                <Button onClick={onRefresh} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface EmptyJobsStateProps {
  searchQuery?: string;
  filterMode?: string;
  onClearSearch?: () => void;
  title?: string;
  description?: string;
}

export const EmptyJobsState: React.FC<EmptyJobsStateProps> = ({
  searchQuery,
  filterMode,
  onClearSearch,
  title,
  description
}) => {
  const getEmptyStateContent = () => {
    if (searchQuery) {
      return {
        title: "No jobs found",
        description: `No jobs match your search for "${searchQuery}"`,
        action: onClearSearch && (
          <Button onClick={onClearSearch} variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Clear Search
          </Button>
        )
      };
    }

    if (filterMode === 'my-active') {
      return {
        title: "No active jobs",
        description: "You don't have any jobs currently in progress"
      };
    }

    if (filterMode === 'available') {
      return {
        title: "No available jobs",
        description: "There are no jobs available for you to work on right now"
      };
    }

    if (filterMode === 'urgent') {
      return {
        title: "No urgent jobs",
        description: "Great! There are no urgent jobs at the moment"
      };
    }

    return {
      title: title || "No jobs found",
      description: description || "There are no jobs to display"
    };
  };

  const content = getEmptyStateContent();

  return (
    <Card>
      <CardContent className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{content.title}</h3>
        <p className="text-gray-600 mb-4">{content.description}</p>
        {content.action}
      </CardContent>
    </Card>
  );
};

interface ConnectionStatusProps {
  isConnected: boolean;
  lastFetchTime?: number;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  lastFetchTime,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isConnected ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-red-500" />
      )}
      <span className="text-xs text-gray-500">
        {isConnected ? 'Connected' : 'Offline'}
      </span>
      {lastFetchTime && (
        <span className="text-xs text-gray-400">
          Last sync: {new Date(lastFetchTime).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

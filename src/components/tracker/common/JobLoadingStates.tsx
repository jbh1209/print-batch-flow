
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobCardLoadingProps {
  count?: number;
  compact?: boolean;
}

export const JobCardLoading: React.FC<JobCardLoadingProps> = ({ 
  count = 3, 
  compact = false 
}) => {
  const cardHeight = compact ? "h-20" : "h-32";
  
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className={cn("p-4", compact && "p-3")}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-32"></div>
              {!compact && (
                <>
                  <div className="h-3 bg-gray-200 rounded w-40"></div>
                  <div className="flex gap-2 mt-3">
                    <div className="h-8 bg-gray-200 rounded flex-1"></div>
                    <div className="h-8 bg-gray-200 rounded flex-1"></div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

interface JobListLoadingProps {
  message?: string;
  showProgress?: boolean;
}

export const JobListLoading: React.FC<JobListLoadingProps> = ({ 
  message = "Loading jobs...",
  showProgress = false 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 h-full space-y-4">
      <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      <div className="text-center">
        <span className="text-lg font-medium">{message}</span>
        {showProgress && (
          <p className="text-sm text-gray-600 mt-2">
            Fetching real-time updates and accessible jobs
          </p>
        )}
      </div>
    </div>
  );
};

interface JobErrorStateProps {
  error: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  title?: string;
}

export const JobErrorState: React.FC<JobErrorStateProps> = ({
  error,
  onRetry,
  onRefresh,
  title = "Error Loading Jobs"
}) => {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2 text-red-700">{title}</h2>
        <p className="text-red-600 text-center mb-4">{error}</p>
        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              Try Again
            </Button>
          )}
          {onRefresh && (
            <Button onClick={onRefresh} variant="outline">
              Refresh Data
            </Button>
          )}
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface EmptyJobsStateProps {
  title?: string;
  message?: string;
  searchQuery?: string;
  onClearSearch?: () => void;
  filterMode?: string;
}

export const EmptyJobsState: React.FC<EmptyJobsStateProps> = ({
  title = "No Jobs Available",
  message,
  searchQuery,
  onClearSearch,
  filterMode
}) => {
  const defaultMessage = searchQuery 
    ? `No jobs found matching "${searchQuery}"`
    : filterMode 
    ? `No jobs available in the "${filterMode}" filter.`
    : "No jobs available at the moment.";

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-12">
        <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 text-center mb-4">
          {message || defaultMessage}
        </p>
        {searchQuery && onClearSearch && (
          <Button 
            variant="outline" 
            onClick={onClearSearch}
            className="mt-4"
          >
            Clear Search
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

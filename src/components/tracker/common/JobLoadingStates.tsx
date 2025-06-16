
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface JobListLoadingProps {
  message?: string;
  showProgress?: boolean;
}

export const JobListLoading: React.FC<JobListLoadingProps> = ({ 
  message = "Loading jobs...", 
  showProgress = false 
}) => {
  return (
    <div className="flex items-center justify-center p-8 h-full">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center p-6">
          {showProgress ? (
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-3" />
          ) : (
            <LoadingSpinner />
          )}
          <p className="text-gray-600 text-center">{message}</p>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Checking master queues and permissions...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface JobErrorStateProps {
  error: string;
  onRetry: () => void;
  onRefresh: () => void;
  title?: string;
}

export const JobErrorState: React.FC<JobErrorStateProps> = ({ 
  error, 
  onRetry, 
  onRefresh, 
  title = "Error Loading Jobs" 
}) => {
  return (
    <div className="p-4 h-full flex items-center justify-center">
      <Card className="border-red-200 bg-red-50 w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <AlertTriangle className="h-10 w-10 text-red-500 mb-3" />
          <h2 className="text-lg font-semibold mb-2 text-red-700">{title}</h2>
          <p className="text-red-600 text-center mb-4 text-sm">{error}</p>
          
          <div className="flex gap-2 w-full">
            <Button 
              onClick={onRetry} 
              variant="outline" 
              size="sm" 
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={onRefresh} 
              variant="default" 
              size="sm" 
              className="flex-1"
            >
              Force Refresh
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 mt-3 text-center">
            If this persists, check your permissions or contact an administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

interface EmptyJobStateProps {
  title?: string;
  message?: string;
  onRefresh?: () => void;
  isDtpOperator?: boolean;
}

export const EmptyJobState: React.FC<EmptyJobStateProps> = ({ 
  title = "No Jobs Available",
  message,
  onRefresh,
  isDtpOperator = false
}) => {
  const defaultMessage = isDtpOperator 
    ? "You don't have any DTP or proofing jobs available right now."
    : "You don't have any jobs that you can work on right now.";

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-3" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 text-center text-sm mb-4">
          {message || defaultMessage}
        </p>
        
        {onRefresh && (
          <Button 
            onClick={onRefresh} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Jobs
          </Button>
        )}
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>Jobs may be available in other stages or queues.</p>
          <p>Contact your supervisor if you expect to see jobs here.</p>
        </div>
      </CardContent>
    </Card>
  );
};

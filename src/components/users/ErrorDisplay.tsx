
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface ErrorDisplayProps {
  error: string | null;
  onRetry: () => Promise<void>;
  isRefreshing: boolean;
}

export function ErrorDisplay({ error, onRetry, isRefreshing }: ErrorDisplayProps) {
  if (!error) return null;
  
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{error}</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRetry}
          className="self-start"
          disabled={isRefreshing}
        >
          {isRefreshing ? <Spinner size={16} className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

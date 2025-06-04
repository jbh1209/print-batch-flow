
import React from 'react';
import { AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

interface DataLoadingFallbackProps {
  error?: string;
  componentName?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  showDetails?: boolean;
}

export const DataLoadingFallback: React.FC<DataLoadingFallbackProps> = ({
  error,
  componentName = 'component',
  onRetry,
  onRefresh,
  showDetails = false
}) => {
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-6">
        <Alert className="mb-4 border-orange-200 bg-orange-100">
          <Database className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-orange-800">
                Unable to load data for {componentName}
              </p>
              {error && showDetails && (
                <p className="text-sm text-orange-700 opacity-80">
                  Error: {error}
                </p>
              )}
              <p className="text-sm text-orange-700">
                There may be a temporary connectivity issue or the data source is unavailable.
              </p>
            </div>
          </AlertDescription>
        </Alert>
        
        <div className="flex gap-3">
          {onRetry && (
            <Button onClick={onRetry} variant="outline" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Loading
            </Button>
          )}
          {onRefresh && (
            <Button onClick={onRefresh} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  woNo?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class RowMappingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RowMappingTable error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Row Mapping Display Error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              There was an error displaying the row mappings for work order {this.props.woNo || 'unknown'}.
            </p>
            <p className="text-sm text-muted-foreground">
              Error: {this.state.error?.message || 'Unknown error'}
            </p>
            <Button 
              onClick={this.handleReset} 
              variant="outline" 
              size="sm"
              className="mt-2"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

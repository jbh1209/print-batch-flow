
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  dashboardName?: string;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`DashboardErrorBoundary caught an error in ${this.props.dashboardName || 'dashboard'}:`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Dashboard Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      The {this.props.dashboardName || 'dashboard'} encountered an unexpected error
                    </p>
                    {this.state.error?.message && (
                      <p className="text-sm opacity-80">
                        Error: {this.state.error.message}
                      </p>
                    )}
                    <p className="text-sm">
                      This error has been logged. Please try refreshing the dashboard or navigate to a different section.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-3">
                <Button onClick={this.handleRetry} variant="outline" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Dashboard
                </Button>
                {this.props.onNavigateHome && (
                  <Button onClick={this.props.onNavigateHome} className="flex-1">
                    <Home className="h-4 w-4 mr-2" />
                    Go to Dashboard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

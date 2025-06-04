
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, FileX } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  jobId?: string;
  jobWoNo?: string;
  onErrorRemoveJob?: (jobId: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class JobErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`JobErrorBoundary caught an error for job ${this.props.jobWoNo || this.props.jobId}:`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRemoveJob = () => {
    if (this.props.jobId && this.props.onErrorRemoveJob) {
      this.props.onErrorRemoveJob(this.props.jobId);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 m-2">
          <Alert variant="destructive" className="border-0 bg-transparent p-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-sm">
                  Error loading job {this.props.jobWoNo || this.props.jobId}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <FileX className="h-3 w-3" />
                  <span>Job data corrupted or unavailable</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

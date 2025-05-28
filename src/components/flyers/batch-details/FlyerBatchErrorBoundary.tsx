
import React from 'react';
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class FlyerBatchErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('FlyerBatchErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <FlyerBatchErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

const FlyerBatchErrorFallback = ({ error }: { error?: Error }) => {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-4">
          There was an error loading the batch details. This might be due to a data formatting issue.
        </p>
        {error && (
          <details className="text-sm text-gray-500 mb-4">
            <summary className="cursor-pointer">Error details</summary>
            <pre className="mt-2 text-left bg-gray-100 p-2 rounded">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-2 justify-center">
          <Button 
            variant="outline"
            onClick={() => navigate("/batchflow/batches/flyers/batches")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Batches
          </Button>
          <Button 
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FlyerBatchErrorBoundary;

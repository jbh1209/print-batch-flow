
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ErrorDisplayProps {
  error?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  const navigate = useNavigate();
  
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || 'Job not found'}</p>
            </div>
            <div className="mt-4">
              <Button 
                size="sm" 
                onClick={() => navigate('/batches/business-cards/jobs')}
                className="flex items-center"
              >
                <ArrowLeft size={16} className="mr-2" />
                Back to Jobs
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;

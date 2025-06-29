
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';

interface FormActionsProps {
  isProcessing: boolean;
  isUploading: boolean;
  hasSelectedFile: boolean;
  onCancel: () => void;
}

export const FormActions: React.FC<FormActionsProps> = ({
  isProcessing,
  isUploading,
  hasSelectedFile,
  onCancel
}) => {
  return (
    <div className="flex gap-3">
      <Button
        type="submit"
        disabled={isProcessing || isUploading || !hasSelectedFile}
        className="flex items-center gap-2"
      >
        {(isProcessing || isUploading) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {isUploading ? 'Uploading...' : 'Create Batch Job'}
      </Button>
      <Button 
        type="button" 
        variant="outline" 
        onClick={onCancel}
        disabled={isProcessing || isUploading}
      >
        Cancel
      </Button>
    </div>
  );
};

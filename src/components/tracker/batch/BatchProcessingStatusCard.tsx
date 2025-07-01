
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, ExternalLink, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { completeBatchJobProcessing } from '@/utils/batch/batchIntegrationService';
import { toast } from 'sonner';

interface BatchProcessingStatusCardProps {
  jobId: string;
  woNo: string;
  customer: string;
  batchCategory?: string;
  status: string;
  onStatusUpdate?: () => void;
}

export const BatchProcessingStatusCard: React.FC<BatchProcessingStatusCardProps> = ({
  jobId,
  woNo,
  customer,
  batchCategory,
  status,
  onStatusUpdate
}) => {
  const [isCompleting, setIsCompleting] = React.useState(false);

  const handleCompleteBatchProcessing = async () => {
    setIsCompleting(true);
    try {
      const success = await completeBatchJobProcessing(jobId, '', undefined);
      if (success) {
        toast.success('Batch processing completed successfully');
        onStatusUpdate?.();
      } else {
        toast.error('Failed to complete batch processing');
      }
    } catch (error) {
      console.error('Error completing batch processing:', error);
      toast.error('Error completing batch processing');
    } finally {
      setIsCompleting(false);
    }
  };

  const getBatchStatusInfo = () => {
    switch (status) {
      case 'In Batch Processing':
        return {
          icon: Package,
          text: 'In BatchFlow',
          color: 'text-orange-700 border-orange-300 bg-orange-50',
          badgeColor: 'bg-orange-100 text-orange-800'
        };
      case 'Batch Complete':
        return {
          icon: CheckCircle,
          text: 'Batch Complete',
          color: 'text-green-700 border-green-300 bg-green-50',
          badgeColor: 'bg-green-100 text-green-800'
        };
      default:
        return {
          icon: AlertTriangle,
          text: 'Batch Status Unknown',
          color: 'text-gray-700 border-gray-300 bg-gray-50',
          badgeColor: 'bg-gray-100 text-gray-800'
        };
    }
  };

  const statusInfo = getBatchStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <Card className={`border ${statusInfo.color.split(' ')[1]} ${statusInfo.color.split(' ')[2]}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-5 w-5 ${statusInfo.color.split(' ')[0]}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{statusInfo.text}</h4>
              <Badge className={statusInfo.badgeColor}>
                {status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>WO: {woNo}</div>
              <div>Customer: {customer}</div>
              {batchCategory && (
                <div className="col-span-2">Category: {batchCategory}</div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => window.open('/batch', '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View in BatchFlow
            </Button>
            
            {status === 'In Batch Processing' && (
              <Button
                size="sm"
                onClick={handleCompleteBatchProcessing}
                disabled={isCompleting}
                className="text-xs h-8 bg-green-600 hover:bg-green-700"
              >
                {isCompleting ? (
                  <>
                    <Clock className="h-3 w-3 mr-1 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete Batch
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

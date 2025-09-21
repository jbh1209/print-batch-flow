import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Printer, Package } from 'lucide-react';
import { useHP12000Stages, HP12000StageInstance, HP12000PaperSize } from '@/hooks/tracker/useHP12000Stages';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface HP12000PaperSizeSelectorProps {
  jobId: string;
  onValidationChange?: (isValid: boolean, message?: string) => void;
}

export const HP12000PaperSizeSelector: React.FC<HP12000PaperSizeSelectorProps> = ({
  jobId,
  onValidationChange
}) => {
  const {
    paperSizes,
    hp12000Stages,
    isLoading,
    updateStagePaperSize,
    areAllPaperSizesAssigned,
    getValidationMessage
  } = useHP12000Stages(jobId);

  // Notify parent of validation status changes
  React.useEffect(() => {
    const isValid = areAllPaperSizesAssigned();
    const message = getValidationMessage();
    onValidationChange?.(isValid, message);
  }, [areAllPaperSizesAssigned, getValidationMessage, onValidationChange]);

  const handlePaperSizeChange = async (stageInstanceId: string, paperSizeId: string) => {
    await updateStagePaperSize(stageInstanceId, paperSizeId);
  };

  const getPaperSizeColor = (paperSize: HP12000PaperSize) => {
    return paperSize.name.includes('Large') ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            HP12000 Paper Size Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hp12000Stages.length === 0) {
    return null; // No HP12000 stages in this job
  }

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Printer className="h-5 w-5" />
          HP12000 Paper Size Selection
        </CardTitle>
        <p className="text-sm text-blue-600">
          Select paper sizes for HP12000 printing stages to prevent blanket marking issues.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Paper Size Legend */}
        <div className="flex flex-wrap gap-2 p-3 bg-white rounded-md border">
          <div className="text-sm font-medium text-gray-700">Paper Sizes:</div>
          {paperSizes.map(paperSize => (
            <Badge key={paperSize.id} className={getPaperSizeColor(paperSize)}>
              {paperSize.name}
            </Badge>
          ))}
        </div>

        {/* Stage List */}
        <div className="space-y-3">
          {hp12000Stages.map((stage) => (
            <div key={stage.stage_instance_id} className="p-4 bg-white rounded-md border space-y-3">
              {/* Header with stage name and part assignment */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{stage.stage_name}</span>
                  <Badge variant="outline">Order: {stage.stage_order}</Badge>
                  {stage.part_assignment && (
                    <Badge 
                      variant={stage.part_assignment === 'cover' ? 'default' : 'secondary'} 
                      className="text-xs"
                    >
                      {stage.part_assignment === 'cover' ? 'Cover' : 
                       stage.part_assignment === 'text' ? 'Text' : 
                       stage.part_assignment}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {stage.paper_size_id && (
                    <Badge className={getPaperSizeColor(
                      paperSizes.find(ps => ps.id === stage.paper_size_id)!
                    )}>
                      {stage.paper_size_name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Part specifications */}
              {(stage.part_name || stage.paper_specifications || stage.printing_specifications) && (
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded space-y-1">
                  {stage.part_name && (
                    <p><span className="font-medium text-gray-800">Part:</span> {stage.part_name}</p>
                  )}
                  {stage.paper_specifications && Object.keys(stage.paper_specifications).length > 0 && (
                    <p><span className="font-medium text-gray-800">Paper Specs:</span> {Object.entries(stage.paper_specifications)
                      .map(([key, value]) => `${key}: ${value}`).join(', ')}</p>
                  )}
                  {stage.printing_specifications && Object.keys(stage.printing_specifications).length > 0 && (
                    <p><span className="font-medium text-gray-800">Print Specs:</span> {Object.entries(stage.printing_specifications)
                      .map(([key, value]) => `${key}: ${value}`).join(', ')}</p>
                  )}
                </div>
              )}
              
              {/* Paper size selection */}
              <div className="flex items-center gap-2">
                <Select
                  value={stage.paper_size_id || ''}
                  onValueChange={(value) => handlePaperSizeChange(stage.stage_instance_id, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select paper size" />
                  </SelectTrigger>
                  <SelectContent>
                    {paperSizes.map(paperSize => (
                      <SelectItem key={paperSize.id} value={paperSize.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            paperSize.name.includes('Large') ? 'bg-blue-500' : 'bg-orange-500'
                          }`} />
                          {paperSize.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Validation Status */}
        {!areAllPaperSizesAssigned() && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-sm text-orange-800 font-medium">
              ⚠️ {getValidationMessage()}
            </p>
          </div>
        )}

        {areAllPaperSizesAssigned() && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 font-medium">
              ✅ All HP12000 stages have paper sizes assigned
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
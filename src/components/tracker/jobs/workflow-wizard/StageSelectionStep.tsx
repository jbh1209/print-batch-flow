import React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, FileText, Zap } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface StageSelectionStepProps {
  stages: Stage[];
  selectedStages: string[];
  onStageToggle: (stageId: string, checked: boolean) => void;
  onApplyTemplate: (templateType: 'category' | 'similar') => void;
  onBulkSelect: (action: 'all' | 'none' | 'common') => void;
  jobCategory?: string;
}

export const StageSelectionStep: React.FC<StageSelectionStepProps> = ({
  stages,
  selectedStages,
  onStageToggle,
  onApplyTemplate,
  onBulkSelect,
  jobCategory
}) => {
  const isStageSelected = (stageId: string) => selectedStages.includes(stageId);
  
  const commonStages = stages.filter(stage => 
    stage.name.toLowerCase().includes('printing') ||
    stage.name.toLowerCase().includes('cutting') ||
    stage.name.toLowerCase().includes('finishing')
  );

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span>Quick Setup</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApplyTemplate('category')}
              className="flex items-center space-x-1"
              disabled={!jobCategory}
            >
              <Copy className="h-3 w-3" />
              <span>Apply {jobCategory} Template</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApplyTemplate('similar')}
              className="flex items-center space-x-1"
            >
              <FileText className="h-3 w-3" />
              <span>Copy from Similar Job</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkSelect('common')}
            >
              Common Stages
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkSelect('all')}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkSelect('none')}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stage Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Available Stages ({selectedStages.length} selected)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stages.map(stage => (
              <div key={stage.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <Checkbox
                  checked={isStageSelected(stage.id)}
                  onCheckedChange={(checked) => onStageToggle(stage.id, checked as boolean)}
                />
                <Badge 
                  variant="outline" 
                  style={{ 
                    backgroundColor: `${stage.color}20`, 
                    color: stage.color, 
                    borderColor: `${stage.color}40` 
                  }}
                  className="flex-shrink-0"
                >
                  {stage.name}
                </Badge>
                {stage.description && (
                  <span className="text-sm text-muted-foreground flex-1">{stage.description}</span>
                )}
                {commonStages.includes(stage) && (
                  <Badge variant="secondary" className="text-xs">Common</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedStages.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>{selectedStages.length} stages selected.</strong> You can configure individual stage details in the next step.
          </p>
        </div>
      )}
    </div>
  );
};
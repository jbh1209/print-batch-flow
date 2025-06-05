
import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export interface BulkOperation {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'workflow' | 'management' | 'organization';
  requiresConfirmation: boolean;
}

interface BulkOperationSelectorProps {
  operations: BulkOperation[];
  selectedOperations: string[];
  onOperationToggle: (operationId: string, checked: boolean) => void;
}

export const BulkOperationSelector: React.FC<BulkOperationSelectorProps> = ({
  operations,
  selectedOperations,
  onOperationToggle
}) => {
  const groupedOperations = operations.reduce((acc, operation) => {
    if (!acc[operation.category]) {
      acc[operation.category] = [];
    }
    acc[operation.category].push(operation);
    return acc;
  }, {} as Record<string, BulkOperation[]>);

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'workflow': return 'Workflow Operations';
      case 'management': return 'Management Operations';
      case 'organization': return 'Organization Operations';
      default: return category;
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'workflow': return 'bg-blue-100 text-blue-800';
      case 'management': return 'bg-green-100 text-green-800';
      case 'organization': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Select Operations</Label>
      
      {Object.entries(groupedOperations).map(([category, categoryOps], index) => (
        <div key={category}>
          {index > 0 && <Separator className="my-4" />}
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={getCategoryColor(category)}
              >
                {getCategoryLabel(category)}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {categoryOps.map((operation) => (
                <div 
                  key={operation.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <Checkbox
                    id={operation.id}
                    checked={selectedOperations.includes(operation.id)}
                    onCheckedChange={(checked) => 
                      onOperationToggle(operation.id, checked as boolean)
                    }
                  />
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-gray-500">
                      {operation.icon}
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={operation.id} className="font-medium cursor-pointer">
                        {operation.label}
                        {operation.requiresConfirmation && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Requires Confirmation
                          </Badge>
                        )}
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        {operation.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

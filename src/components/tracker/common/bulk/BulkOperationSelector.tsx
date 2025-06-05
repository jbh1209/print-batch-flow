
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface BulkOperation {
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
  const getOperationsByCategory = () => {
    const categories = ['workflow', 'management', 'organization'] as const;
    return categories.reduce((acc, category) => {
      acc[category] = operations.filter(op => op.category === category);
      return acc;
    }, {} as Record<string, BulkOperation[]>);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      workflow: 'bg-blue-100 text-blue-800',
      management: 'bg-green-100 text-green-800',
      organization: 'bg-purple-100 text-purple-800'
    };
    return colors[category as keyof typeof colors] || colors.workflow;
  };

  const operationsByCategory = getOperationsByCategory();

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Select Operations</Label>
      {Object.entries(operationsByCategory).map(([category, categoryOperations]) => (
        <div key={category} className="space-y-3">
          <Badge className={getCategoryColor(category)} variant="secondary">
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Badge>
          <div className="ml-4 space-y-2">
            {categoryOperations.map((operation) => (
              <div key={operation.id} className="flex items-start space-x-3">
                <Checkbox
                  id={operation.id}
                  checked={selectedOperations.includes(operation.id)}
                  onCheckedChange={(checked) => 
                    onOperationToggle(operation.id, checked as boolean)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label 
                    htmlFor={operation.id} 
                    className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                  >
                    {operation.icon}
                    {operation.label}
                    {operation.requiresConfirmation && (
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                    )}
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {operation.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export type { BulkOperation };

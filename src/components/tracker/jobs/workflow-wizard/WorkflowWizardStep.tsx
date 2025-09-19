import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, AlertCircle } from "lucide-react";

interface WorkflowWizardStepProps {
  stepNumber: number;
  title: string;
  description: string;
  isActive: boolean;
  isCompleted: boolean;
  hasErrors?: boolean;
  children: React.ReactNode;
}

export const WorkflowWizardStep: React.FC<WorkflowWizardStepProps> = ({
  stepNumber,
  title,
  description,
  isActive,
  isCompleted,
  hasErrors = false,
  children
}) => {
  const getStepIcon = () => {
    if (isCompleted) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    if (hasErrors) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    return <Circle className="h-5 w-5 text-gray-400" />;
  };

  const getStepStatus = () => {
    if (isCompleted) return "complete";
    if (hasErrors) return "error";
    if (isActive) return "active";
    return "pending";
  };

  const stepStatus = getStepStatus();

  return (
    <Card className={`transition-all duration-200 ${
      isActive ? 'ring-2 ring-primary border-primary' : 
      isCompleted ? 'border-green-200 bg-green-50/30' :
      hasErrors ? 'border-red-200 bg-red-50/30' :
      'border-gray-200'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          {getStepIcon()}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <Badge variant={
                stepStatus === 'complete' ? 'default' :
                stepStatus === 'error' ? 'destructive' :
                stepStatus === 'active' ? 'default' :
                'outline'
              } className={
                stepStatus === 'complete' ? 'bg-green-600' :
                stepStatus === 'active' ? 'bg-primary' :
                ''
              }>
                Step {stepNumber}
              </Badge>
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      
      {(isActive || isCompleted) && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
};
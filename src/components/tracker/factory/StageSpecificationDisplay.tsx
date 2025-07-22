
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Package, Hash, Palette } from "lucide-react";

interface StageSpecificationDisplayProps {
  stageName: string;
  subSpecification?: string;
  partName?: string;
  quantity?: number;
  paperSpecifications?: string;
  className?: string;
}

export const StageSpecificationDisplay: React.FC<StageSpecificationDisplayProps> = ({
  stageName,
  subSpecification,
  partName,
  quantity,
  paperSpecifications,
  className = ""
}) => {
  // Parse paper specifications from notes if available
  const parsePaperSpecs = (specs?: string) => {
    if (!specs) return null;
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(specs);
      return parsed;
    } catch {
      // If not JSON, treat as plain text
      return specs;
    }
  };

  const paperDetails = parsePaperSpecs(paperSpecifications);

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Stage Specifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stage and Sub-Specification */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm text-gray-700">Stage:</span>
          </div>
          <div className="ml-6">
            <Badge variant="default" className="bg-blue-600">
              {stageName}
            </Badge>
            {subSpecification && (
              <div className="mt-2">
                <span className="text-sm font-medium text-gray-900">
                  {subSpecification}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Part and Quantity */}
        {(partName || quantity) && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              {partName && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm text-gray-700">Part:</span>
                  </div>
                  <Badge variant="outline" className="ml-6 border-green-600 text-green-700">
                    {partName}
                  </Badge>
                </div>
              )}
              
              {quantity && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-sm text-gray-700">Quantity:</span>
                  </div>
                  <Badge variant="outline" className="ml-6 border-orange-600 text-orange-700">
                    {quantity.toLocaleString()}
                  </Badge>
                </div>
              )}
            </div>
          </>
        )}

        {/* Paper Specifications */}
        {paperDetails && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-sm text-gray-700">Paper Specifications:</span>
              </div>
              <div className="ml-6 p-3 bg-gray-50 rounded-md">
                {typeof paperDetails === 'string' ? (
                  <span className="text-sm text-gray-800">{paperDetails}</span>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(paperDetails).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-gray-800 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

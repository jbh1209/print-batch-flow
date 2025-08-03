
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Palette, Package2, Layers } from "lucide-react";
import { useJobSpecificationDisplay } from "@/hooks/useJobSpecificationDisplay";

interface JobSpecificationCardProps {
  jobId: string;
  jobTableName: string;
  className?: string;
  compact?: boolean;
}

export const JobSpecificationCard: React.FC<JobSpecificationCardProps> = ({
  jobId,
  jobTableName,
  className = "",
  compact = false
}) => {
  const { specifications, isLoading, getSpecificationValue } = useJobSpecificationDisplay(jobId, jobTableName);

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-100 rounded-lg h-24 ${className}`} />
    );
  }

  if (specifications.length === 0) {
    return null;
  }

  const mainSpecs = [
    { key: 'size', label: 'Size', icon: Package2 },
    { key: 'paper_type', label: 'Paper', icon: FileText },
    { key: 'paper_weight', label: 'Weight', icon: Layers },
    { key: 'lamination_type', label: 'Lamination', icon: Palette }
  ];

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {mainSpecs.map(({ key, label, icon: Icon }) => {
          const value = getSpecificationValue(key);
          if (value === 'N/A') return null;
          
          return (
            <Badge key={key} variant="outline" className="text-xs">
              <Icon className="h-3 w-3 mr-1" />
              {value}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Job Specifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {mainSpecs.map(({ key, label, icon: Icon }) => {
            const value = getSpecificationValue(key);
            if (value === 'N/A') return null;
            
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Icon className="h-3 w-3" />
                  {label}
                </div>
                <Badge variant="outline" className="text-xs font-medium">
                  {value}
                </Badge>
              </div>
            );
          })}
        </div>
        
        {specifications.length > 4 && (
          <>
            <Separator />
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-700">Additional Specs:</span>
              <div className="flex flex-wrap gap-1">
                {specifications.slice(4).map((spec) => (
                  <Badge key={spec.category} variant="secondary" className="text-xs">
                    {spec.display_name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
